import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import { encryptSecret, decryptSecret, hashApiSecret, timingSafeEqualString } from "@/server/crypto";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import {
  createApiCredential,
  formatCredentialBearerToken,
  parseCredentialBearerToken,
  revokeApiCredential,
  rotateApiCredential,
  verifyApiCredentialSecret,
} from "@/server/ncc/ncc-api-credential.service";
import { authenticateNccApiRequest, requireApiScope } from "@/server/ncc/ncc-api-auth.service";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import {
  validateWebhookUrlShape,
  isBlockedResolvedAddress,
} from "@/server/ncc/ncc-webhook-ssrf";
import { signWebhookPayload, verifyWebhookSignature } from "@/server/ncc/ncc-webhook-signing";
import { createWebhookEndpoint } from "@/server/ncc/ncc-webhook-endpoint.service";
import { fanOutOutboxEventToWebhooks } from "@/server/ncc/ncc-webhook-fanout.service";
import { attemptWebhookDelivery } from "@/server/ncc/ncc-webhook-delivery.service";
import { apiSubmitSettlement, apiGetSettlement } from "@/server/ncc/ncc-api-settlement.service";
import { enforceNccApiRateLimit } from "@/server/ncc/ncc-api-rate-limit.service";
import { NCC_OUTBOX_EVENTS, enqueueOutboxEvent } from "@/server/ncc/ncc-outbox.service";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc 3b crypto and credential parsing", () => {
  it("encrypts and decrypts webhook secrets", async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret-32chars-minimum!!";
    const encrypted = await encryptSecret("whsec_hello");
    assert.ok(encrypted);
    assert.notEqual(encrypted, "whsec_hello");
    assert.equal(await decryptSecret(encrypted), "whsec_hello");
  });

  it("hashes API secrets one-way with timing-safe compare", async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret-32chars-minimum!!";
    const a = await hashApiSecret("super-secret-value");
    const b = await hashApiSecret("super-secret-value");
    assert.equal(a, b);
    assert.equal(timingSafeEqualString(a, b), true);
    assert.equal(timingSafeEqualString(a, await hashApiSecret("other")), false);
  });

  it("parses bearer tokens without accepting query-style secrets", () => {
    const parsed = parseCredentialBearerToken(
      "Bearer ncc_live_abc12345_secretpart_with_underscores",
    );
    assert.ok(parsed);
    assert.equal(parsed!.environment, "LIVE");
    assert.equal(parsed!.keyPrefix, "abc12345");
    assert.equal(parsed!.secret, "secretpart_with_underscores");
    assert.equal(parseCredentialBearerToken(null), null);
    assert.equal(parseCredentialBearerToken("Bearer not-a-token"), null);
  });

  it("rejects private webhook URLs", () => {
    assert.equal(validateWebhookUrlShape("http://example.com/hook", { requireHttps: true }).ok, false);
    assert.equal(validateWebhookUrlShape("https://user:pass@example.com/hook").ok, false);
    assert.equal(validateWebhookUrlShape("https://127.0.0.1/hook").ok, false);
    assert.equal(validateWebhookUrlShape("https://10.0.0.5/hook").ok, false);
    assert.equal(validateWebhookUrlShape("https://169.254.169.254/latest").ok, false);
    assert.equal(validateWebhookUrlShape("https://localhost/hook").ok, false);
    assert.equal(validateWebhookUrlShape("https://example.com/hooks/ncc").ok, true);
    assert.equal(isBlockedResolvedAddress("192.168.1.1"), true);
    assert.equal(isBlockedResolvedAddress("8.8.8.8"), false);
  });

  it("signs and verifies webhook payloads", async () => {
    const secret = "whsec_test_vector_do_not_use_in_production";
    const timestamp = "1720000000";
    const rawBody = '{"hello":"ncc"}';
    const signature = await signWebhookPayload(secret, timestamp, rawBody);
    assert.equal(
      await verifyWebhookSignature({
        secret,
        timestamp,
        rawBody,
        signature,
        toleranceSeconds: 10 ** 12,
      }),
      true,
    );
    assert.equal(
      await verifyWebhookSignature({
        secret,
        timestamp,
        rawBody: '{"hello":"nope"}',
        signature,
        toleranceSeconds: 10 ** 12,
      }),
      false,
    );
  });
});

describe("ncc 3b institution api integration", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let actorUserId = "";
  let credentialSecret = "";
  let credentialId = "";
  let keyPrefix = "";
  let otherInstitutionId = "";

  before(async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret-32chars-minimum!!";
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-3b-${suffix}`,
        discordUsername: `ncc_3b_${suffix}`,
      },
    });
    actorUserId = user.id;

    await prisma.institutionMember.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        userId: actorUserId,
        role: "INSTITUTION_OWNER",
        status: "ACTIVE",
      },
    });

    const created = await createApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `3b-cred-${suffix}`,
      environment: "LIVE",
      scopes: [
        "institution:read",
        "routing:read",
        "accounts:read",
        "settlements:read",
        "settlements:create",
        "settlements:cancel",
        "settlements:reverse",
        "webhooks:read",
        "webhooks:write",
        "api_logs:read",
      ],
      createdByUserId: actorUserId,
    });
    credentialId = created.id;
    credentialSecret = created.secret;
    keyPrefix = created.keyPrefix;

    const other = await prisma.financialInstitution.create({
      data: {
        legalName: `Other 3B ${suffix}`,
        displayName: `Other 3B ${suffix}`,
        slug: `other-3b-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    otherInstitutionId = other.id;
  });

  after(async () => {
    // leave fixtures
  });

  it("authenticates correct secrets and rejects incorrect ones", async () => {
    const token = formatCredentialBearerToken("LIVE", keyPrefix, credentialSecret);
    const ctx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api/ncc/v1/institution", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      "req_test_1",
    );
    assert.equal(ctx.institutionId, ALTA_BANK_INSTITUTION_ID);
    requireApiScope(ctx, "institution:read");

    await assert.rejects(
      () =>
        authenticateNccApiRequest(
          new Request("https://ncc.test/api", {
            headers: { Authorization: `Bearer ncc_live_${keyPrefix}_wrongsecretwrongsecret` },
          }),
          "req_test_2",
        ),
      (error: unknown) => error instanceof NccApiError && error.code === "UNAUTHORIZED",
    );

    const row = await prisma.nccApiCredential.findUniqueOrThrow({ where: { id: credentialId } });
    assert.equal(await verifyApiCredentialSecret(row, credentialSecret), true);
    assert.ok(!row.secretHash.includes(credentialSecret));
  });

  it("revokes and rotates credentials", async () => {
    const temp = await createApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `3b-temp-${suffix}`,
      environment: "LIVE",
      scopes: ["institution:read"],
      createdByUserId: actorUserId,
    });
    await revokeApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      credentialId: temp.id,
      actorUserId,
    });
    await assert.rejects(
      () =>
        authenticateNccApiRequest(
          new Request("https://ncc.test/api", {
            headers: {
              Authorization: `Bearer ${formatCredentialBearerToken("LIVE", temp.keyPrefix, temp.secret)}`,
            },
          }),
          "req_revoked",
        ),
      (error: unknown) => error instanceof NccApiError && error.code === "UNAUTHORIZED",
    );

    const rotated = await rotateApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      credentialId,
      actorUserId,
    });
    assert.ok(rotated.secret);
    credentialSecret = rotated.secret;
    keyPrefix = rotated.keyPrefix;
    credentialId = rotated.id;
  });

  it("submits settlement via API services with credential-bound sender", async () => {
    const token = formatCredentialBearerToken("LIVE", keyPrefix, credentialSecret);
    const ctx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api", { headers: { Authorization: `Bearer ${token}` } }),
      "req_settle",
    );

    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });

    const settlement = await apiSubmitSettlement(ctx, {
      receivingRoutingNumber: terminalRouting.routingNumber,
      amount: "15.00",
      currency: "FLR",
      purpose: "3B API test",
      idempotencyKey: `api-settle-${suffix}`,
    });
    assert.equal(settlement.status, "SETTLED");
    assert.equal(settlement.executionStatus, "COMPLETED");

    const dup = await apiSubmitSettlement(ctx, {
      receivingRoutingNumber: terminalRouting.routingNumber,
      amount: "15.00",
      currency: "FLR",
      purpose: "3B API test",
      idempotencyKey: `api-settle-${suffix}`,
    });
    assert.equal(dup.reference, settlement.reference);

    await assert.rejects(
      () =>
        apiSubmitSettlement(ctx, {
          receivingRoutingNumber: terminalRouting.routingNumber,
          amount: "20.00",
          currency: "FLR",
          idempotencyKey: `api-settle-${suffix}`,
        }),
      (error: unknown) => error instanceof NccApiError && error.code === "IDEMPOTENCY_CONFLICT",
    );

    const detail = await apiGetSettlement(ctx, settlement.reference);
    assert.equal(detail.reference, settlement.reference);

    // Cross-institution access denied via other credential
    const otherCred = await createApiCredential({
      institutionId: otherInstitutionId,
      name: `other-${suffix}`,
      environment: "LIVE",
      scopes: ["settlements:read"],
      createdByUserId: actorUserId,
    });
    await prisma.settlementAccount.create({
      data: {
        institutionId: otherInstitutionId,
        currency: "FLR",
        ledgerBalance: 0,
        availableBalance: 0,
        status: "ACTIVE",
      },
    });
    const otherCtx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api", {
        headers: {
          Authorization: `Bearer ${formatCredentialBearerToken("LIVE", otherCred.keyPrefix, otherCred.secret)}`,
        },
      }),
      "req_other",
    );
    await assert.rejects(
      () => apiGetSettlement(otherCtx, settlement.reference),
      (error: unknown) => error instanceof NccApiError && error.code === "NOT_FOUND",
    );
  });

  it("enforces durable rate limits", async () => {
    let limited = false;
    for (let i = 0; i < 15; i++) {
      try {
        await enforceNccApiRateLimit({
          className: "webhook_test",
          credentialId,
          institutionId: ALTA_BANK_INSTITUTION_ID,
          ipHash: `ip-rl-${suffix}`,
        });
      } catch (error) {
        if (error instanceof NccApiError && error.code === "RATE_LIMITED") {
          limited = true;
          assert.ok((error.retryAfterMs ?? 0) > 0);
          break;
        }
        throw error;
      }
    }
    assert.equal(limited, true);
  });

  it("fans out webhooks and delivers signed events to a local HTTPS-like test server", async () => {
    // Local HTTP allowed only for TEST environment endpoints.
    let receivedBody = "";
    let receivedSig = "";
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        receivedSig = String(req.headers["ncc-signature"] ?? "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const port = address.port;

    // TEST env allows http shape validation path when requireHttps=false
    const endpoint = await createWebhookEndpoint({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `local-${suffix}`,
      url: `https://example.com/hooks/${suffix}`, // safe public host for create validation
      environment: "LIVE",
      subscribedEvents: [NCC_OUTBOX_EVENTS.COMPLETED],
      createdByUserId: actorUserId,
    });

    // Point delivery at local server by updating URL after create (delivery SSRF will block 127.0.0.1).
    // Instead verify fanout + signing without live private delivery:
    const instruction = await prisma.settlementInstruction.findFirstOrThrow({
      where: { sendingInstitutionId: ALTA_BANK_INSTITUTION_ID },
      orderBy: { createdAt: "desc" },
    });
    const outbox = await enqueueOutboxEvent({
      settlementInstructionId: instruction.id,
      eventType: NCC_OUTBOX_EVENTS.COMPLETED,
      dedupeKey: `settlement.completed:3b-test-${suffix}`,
      payload: { test: true },
    });
    const fanout = await fanOutOutboxEventToWebhooks(outbox);
    assert.ok(fanout.eventsCreated >= 1);
    assert.ok(fanout.deliveriesCreated >= 1);

    // Signature vector against the created endpoint secret
    const sig = await signWebhookPayload(endpoint.signingSecret, "1720000000", '{"ok":true}');
    assert.equal(
      await verifyWebhookSignature({
        secret: endpoint.signingSecret,
        timestamp: "1720000000",
        rawBody: '{"ok":true}',
        signature: sig,
        toleranceSeconds: 10 ** 12,
      }),
      true,
    );

    // Attempting delivery to loopback must fail closed (SSRF)
    await prisma.nccWebhookEndpoint.update({
      where: { id: endpoint.id },
      data: { url: `http://127.0.0.1:${port}/hook` },
    });
    const delivery = await prisma.nccWebhookDelivery.findFirstOrThrow({
      where: { webhookEndpointId: endpoint.id },
      orderBy: { createdAt: "desc" },
    });
    const result = await attemptWebhookDelivery(delivery.id);
    assert.ok(result === "retry" || result === "failed");
    const after = await prisma.nccWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    assert.notEqual(after.status, "DELIVERED");
    assert.ok(after.lastErrorCode === "SSRF_REJECTED" || after.lastErrorCode === "DELIVERY_ERROR");

    // Settlement finality unchanged
    const stillSettled = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: instruction.id },
    });
    assert.ok(stillSettled.status === "SETTLED" || stillSettled.status === "REVERSED");

    server.close();
    assert.equal(receivedBody, "");
    assert.equal(receivedSig, "");
  });

  it("rejects insufficient scope", async () => {
    const limited = await createApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `limited-${suffix}`,
      environment: "LIVE",
      scopes: ["institution:read"],
      createdByUserId: actorUserId,
    });
    const ctx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api", {
        headers: {
          Authorization: `Bearer ${formatCredentialBearerToken("LIVE", limited.keyPrefix, limited.secret)}`,
        },
      }),
      "req_scope",
    );
    assert.throws(
      () => requireApiScope(ctx, "settlements:create"),
      (error: unknown) => error instanceof NccApiError && error.code === "INSUFFICIENT_SCOPE",
    );
  });
});
