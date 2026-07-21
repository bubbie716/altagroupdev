import { createHmac, randomBytes } from "node:crypto";
import { decryptSecret } from "@/server/crypto";
import { resolvePinnedWebhookDestination } from "@/server/ncc/ncc-webhook-ssrf";
import { pinnedWebhookPost } from "@/server/ncc/ncc-webhook-pinned-http";

export type ExternalConnectorOp =
  | "resolve"
  | "prepareDebit"
  | "commitDebit"
  | "releaseDebit"
  | "credit"
  | "compensateDebit"
  | "queryStatus";

export type ExternalConnectorCallResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; code: string; reason: string; ambiguous?: boolean };

const PATHS: Record<ExternalConnectorOp, string> = {
  resolve: "/v1/accounts/resolve",
  prepareDebit: "/v1/debits/prepare",
  commitDebit: "/v1/debits/commit",
  releaseDebit: "/v1/debits/release",
  credit: "/v1/credits",
  compensateDebit: "/v1/debits/compensate",
  queryStatus: "/v1/operations/status",
};

export async function callExternalConnector(input: {
  baseUrl: string;
  authSecretEncrypted: string | null;
  timeoutMs: number;
  op: ExternalConnectorOp;
  body: Record<string, unknown>;
  requireHttps?: boolean;
}): Promise<ExternalConnectorCallResult> {
  const secret = input.authSecretEncrypted
    ? await decryptSecret(input.authSecretEncrypted)
    : null;
  if (!secret) {
    return { ok: false, code: "CONNECTOR_AUTH_MISSING", reason: "Connector secret not configured" };
  }

  const path = PATHS[input.op];
  const url = `${input.baseUrl.replace(/\/$/, "")}${path}`;

  let destination;
  try {
    destination = await resolvePinnedWebhookDestination(url, {
      requireHttps: input.requireHttps ?? true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL rejected";
    return { ok: false, code: "CONNECTOR_URL_REJECTED", reason: message };
  }

  const rawBody = JSON.stringify(input.body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(8).toString("hex");
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest("hex");

  try {
    const res = await pinnedWebhookPost({
      destination,
      headers: {
        "content-type": "application/json",
        "ncc-timestamp": timestamp,
        "ncc-nonce": nonce,
        "ncc-signature": signature,
      },
      body: rawBody,
      connectTimeoutMs: Math.min(input.timeoutMs, 3000),
      totalTimeoutMs: input.timeoutMs,
      maxResponseBytes: 64_000,
    });

    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(Buffer.from(res.body).toString("utf8") || "{}") as Record<string, unknown>;
    } catch {
      body = {};
    }

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        code: typeof body.code === "string" ? body.code : "CONNECTOR_HTTP_ERROR",
        reason: typeof body.message === "string" ? body.message : `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connector call failed";
    const ambiguous = /TIMEOUT/i.test(message);
    return {
      ok: false,
      code: ambiguous ? "CONNECTOR_TIMEOUT" : "CONNECTOR_UNAVAILABLE",
      reason: message,
      ambiguous,
    };
  }
}
