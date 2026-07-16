/**
 * Pin webhook TCP connections to a pre-validated public IP while preserving
 * the original hostname for TLS SNI and the HTTP Host header.
 * Redirects are rejected (fail closed).
 */

import http from "node:http";
import https from "node:https";
import type { PinnedWebhookDestination } from "@/server/ncc/ncc-webhook-ssrf";

export type PinnedHttpResponse = {
  status: number;
  body: Uint8Array;
  headers: http.IncomingHttpHeaders;
};

export type PinnedWebhookPostInput = {
  destination: PinnedWebhookDestination;
  headers: Record<string, string>;
  body: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
  maxResponseBytes: number;
};

type PinnedTransport = (input: PinnedWebhookPostInput) => Promise<PinnedHttpResponse>;

let testTransport: PinnedTransport | null = null;

/** Test-only transport injection — production always uses pinned Node http(s). */
export function setPinnedWebhookTransportForTests(transport: PinnedTransport | null): void {
  testTransport = transport;
}

export async function pinnedWebhookPost(input: PinnedWebhookPostInput): Promise<PinnedHttpResponse> {
  const { destination } = input;
  const url = destination.url;
  const hostHeader = url.host;
  const headersWithHost = { ...input.headers, Host: hostHeader };
  if (testTransport) {
    return testTransport({ ...input, headers: headersWithHost });
  }
  const isHttps = url.protocol === "https:";
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const path = `${url.pathname}${url.search}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const ok = (value: PinnedHttpResponse) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const totalTimer = setTimeout(() => {
      req.destroy();
      fail(new Error("WEBHOOK_DELIVERY_TIMEOUT"));
    }, input.totalTimeoutMs);

    const req = (isHttps ? https : http).request(
      {
        protocol: url.protocol,
        hostname: destination.pinnedAddress,
        port,
        path,
        method: "POST",
        headers: {
          ...headersWithHost,
          "Content-Length": Buffer.byteLength(input.body),
        },
        servername: isHttps ? destination.hostname : undefined,
        lookup: (_hostname, _options, callback) => {
          callback(null, destination.pinnedAddress, destination.family);
        },
        timeout: input.connectTimeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          clearTimeout(totalTimer);
          fail(new Error("WEBHOOK_URL_REJECTED: redirects are not allowed"));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          if (size >= input.maxResponseBytes) return;
          const remaining = input.maxResponseBytes - size;
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          chunks.push(slice);
          size += slice.length;
        });
        res.on("end", () => {
          clearTimeout(totalTimer);
          ok({
            status,
            body: Buffer.concat(chunks),
            headers: res.headers,
          });
        });
        res.on("error", (error) => {
          clearTimeout(totalTimer);
          fail(error);
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      clearTimeout(totalTimer);
      fail(new Error("WEBHOOK_CONNECT_TIMEOUT"));
    });
    req.on("error", (error) => {
      clearTimeout(totalTimer);
      fail(error);
    });
    req.write(input.body);
    req.end();
  });
}
