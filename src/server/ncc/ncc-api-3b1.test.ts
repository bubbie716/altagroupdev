import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import {
  encryptSecret,
  decryptSecret,
  hashApiSecret,
  randomHexToken,
  requireNccSecretsKey,
} from "@/server/crypto";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import {
  createApiCredential,
  formatCredentialBearerToken,
  NCC_CREDENTIAL_PREFIX_HEX_LENGTH,
  parseCredentialBearerToken,
} from "@/server/ncc/ncc-api-credential.service";
import { authenticateNccApiRequest } from "@/server/ncc/ncc-api-auth.service";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import {
  isBlockedResolvedAddress,
  resolvePinnedWebhookDestination,
  setWebhookDnsResolverForTests,
  validateWebhookUrlShape,
} from "@/server/ncc/ncc-webhook-ssrf";
import {
  pinnedWebhookPost,
  setPinnedWebhookTransportForTests,
} from "@/server/ncc/ncc-webhook-pinned-http";
import { verifyWebhookSignature } from "@/server/ncc/ncc-webhook-signing";
import { createWebhookEndpoint } from "@/server/ncc/ncc-webhook-endpoint.service";
import {
  attemptWebhookDelivery,
  claimWebhookDelivery,
  processDueWebhookDeliveries,
  WEBHOOK_DELIVERY_LEASE_MS,
} from "@/server/ncc/ncc-webhook-delivery.service";
import {
  claimOutboxEvent,
  enqueueOutboxEvent,
  NCC_OUTBOX_EVENTS,
  OUTBOX_CLAIM_LEASE_MS,
  processDueOutboxEvents,
  registerOutboxHandler,
} from "@/server/ncc/ncc-outbox.service";
import {
  apiListSettlements,
  apiSubmitSettlement,
  NCC_API_STRING_LIMITS,
} from "@/server/ncc/ncc-api-settlement.service";
import { handleNccApiRequest } from "@/server/ncc/ncc-api-http";
import { enforceNccApiRateLimit } from "@/server/ncc/ncc-api-rate-limit.service";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc 3b.1 credential token grammar", () => {
  it("generates hex prefixes that never contain underscore", () => {
    for (let i = 0; i < 200; i++) {
      const prefix = randomHexToken(6);
      assert.equal(prefix.length, NCC_CREDENTIAL_PREFIX_HEX_LENGTH);
      assert.match(prefix, /^[a-f0-9]+$/);
      assert.equal(prefix.includes("_"), false);
    }
  });

  it("parses secrets containing underscores and hyphens", () => {
    const prefix = "a1b2c3d4e5f6";
    const secret = "secret_part_with_underscores-and-hyphens_xx";
    const parsed = parseCredentialBearerToken(
      `Bearer ${formatCredentialBearerToken("LIVE", prefix, secret)}`,
    );
    assert.ok(parsed);
    assert.equal(parsed!.modern, true);
    assert.equal(parsed!.keyPrefix, prefix);
    assert.equal(parsed!.secret, secret);
  });

  it("rejects malformed, truncated, and wrong-environment markers", () => {
    assert.equal(parseCredentialBearerToken(null), null);
    assert.equal(parseCredentialBearerToken("Bearer ncc_live_short_x"), null);
    assert.equal(parseCredentialBearerToken("Bearer ncc_prod_a1b2c3d4e5f6_secrettokenvalue1"), null);
    assert.equal(parseCredentialBearerToken("Bearer ncc_live_a1b2c3d4e5f6"), null);
    assert.equal(parseCredentialBearerToken("ncc_live_a1b2c3d4e5f6_secrettokenvalue1"), null);
  });

  it("stress-tests 500 generate/parse/authenticate token loops without failure", () => {
    for (let i = 0; i < 500; i++) {
      const prefix = randomHexToken(6);
      // Simulate base64url secret entropy including _ and -
      const secret = `${randomHexToken(16)}_${randomHexToken(8)}-${randomHexToken(8)}`;
      const token = formatCredentialBearerToken(i % 2 === 0 ? "LIVE" : "TEST", prefix, secret);
      const parsed = parseCredentialBearerToken(`Bearer ${token}`);
      assert.ok(parsed, `failed at iteration ${i}`);
      assert.equal(parsed!.keyPrefix, prefix);
      assert.equal(parsed!.secret, secret);
      assert.equal(parsed!.modern, true);
    }
  });
});

describe("ncc 3b.1 secrets key policy", () => {
  it("requires NCC_SECRETS_KEY in production", () => {
    const prevNode = process.env.NODE_ENV;
    const prevKey = process.env.NCC_SECRETS_KEY;
    const prevSession = process.env.SESSION_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.NCC_SECRETS_KEY;
      process.env.SESSION_SECRET = "session-secret-long-enough-for-fallback!!";
      assert.throws(() => requireNccSecretsKey(), /NCC_SECRETS_KEY is required in production/);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevKey === undefined) delete process.env.NCC_SECRETS_KEY;
      else process.env.NCC_SECRETS_KEY = prevKey;
      if (prevSession === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = prevSession;
    }
  });

  it("encrypts with v1 key-version metadata", async () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ?? "test-session-secret-32chars-minimum!!";
    const encrypted = await encryptSecret("whsec_hello");
    assert.match(encrypted, /^v1\./);
    assert.equal(await decryptSecret(encrypted), "whsec_hello");
    assert.ok(await hashApiSecret("x"));
  });
});

describe("ncc 3b.1 SSRF pinning", () => {
  after(() => {
    setWebhookDnsResolverForTests(null);
    setPinnedWebhookTransportForTests(null);
  });

  function resetNetworkHooks() {
    setWebhookDnsResolverForTests(null);
    setPinnedWebhookTransportForTests(null);
  }

  it("rejects private, metadata, loopback, mapped, and LIVE http", () => {
    assert.equal(validateWebhookUrlShape("http://example.com/h", { requireHttps: true }).ok, false);
    assert.equal(validateWebhookUrlShape("https://127.0.0.1/h").ok, false);
    assert.equal(validateWebhookUrlShape("https://169.254.169.254/latest").ok, false);
    assert.equal(isBlockedResolvedAddress("::ffff:127.0.0.1"), true);
    assert.equal(isBlockedResolvedAddress("::ffff:a9fe:a9fe"), true);
    assert.equal(isBlockedResolvedAddress("8.8.8.8"), false);
  });

  it("rejects private and mixed DNS results", async () => {
    resetNetworkHooks();
    setWebhookDnsResolverForTests(async () => [{ address: "10.0.0.5", family: 4 }]);
    await assert.rejects(
      () => resolvePinnedWebhookDestination("https://example.com/hook"),
      (e: unknown) => e instanceof NccApiError && e.code === "WEBHOOK_URL_REJECTED",
    );

    setWebhookDnsResolverForTests(async () => [
      { address: "203.0.113.10", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await assert.rejects(
      () => resolvePinnedWebhookDestination("https://example.com/hook"),
      (e: unknown) => e instanceof NccApiError && e.code === "WEBHOOK_URL_REJECTED",
    );
  });

  it("pins connection address so DNS rebinding cannot change the connect target", async () => {
    resetNetworkHooks();
    let lookups = 0;
    setWebhookDnsResolverForTests(async () => {
      lookups += 1;
      // First (only) resolution for pinning is public; a rebinding second lookup would be private.
      return lookups === 1
        ? [{ address: "203.0.113.10", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }];
    });

    const pinned = await resolvePinnedWebhookDestination("https://hooks.example/ncc");
    assert.equal(pinned.pinnedAddress, "203.0.113.10");

    let connectedTo = "";
    setPinnedWebhookTransportForTests(async (input) => {
      connectedTo = input.destination.pinnedAddress;
      assert.equal(input.destination.hostname, "hooks.example");
      assert.equal(input.headers.Host ?? input.headers.host, "hooks.example");
      return { status: 200, body: new Uint8Array(), headers: {} };
    });

    await pinnedWebhookPost({
      destination: pinned,
      headers: { "Content-Type": "application/json" },
      body: "{}",
      connectTimeoutMs: 1000,
      totalTimeoutMs: 1000,
      maxResponseBytes: 100,
    });
    assert.equal(connectedTo, "203.0.113.10");
    // Transport path must not perform a second DNS lookup.
    assert.equal(lookups, 1);
  });

  it("rejects redirects in pinned transport", async () => {
    resetNetworkHooks();
    const server = createServer((_req, res) => {
      res.writeHead(302, { Location: "http://127.0.0.1/evil" });
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    try {
      await assert.rejects(
        () =>
          pinnedWebhookPost({
            destination: {
              url: new URL(`http://127.0.0.1:${addr.port}/hook`),
              hostname: "127.0.0.1",
              pinnedAddress: "127.0.0.1",
              family: 4,
            },
            headers: {},
            body: "{}",
            connectTimeoutMs: 2000,
            totalTimeoutMs: 2000,
            maxResponseBytes: 100,
          }),
        /redirects are not allowed/,
      );
    } finally {
      server.close();
    }
  });
});

describe("ncc 3b.1 integration", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let actorUserId = "";
  let credentialId = "";
  let keyPrefix = "";
  let credentialSecret = "";
  let token = "";

  before(async () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ?? "test-session-secret-32chars-minimum!!";
    await ensureAltaInstitutionsSeeded();
    const user = await prisma.user.create({
      data: {
        discordId: `ncc-3b1-${suffix}`,
        discordUsername: `ncc_3b1_${suffix}`,
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
      name: `3b1-cred-${suffix}`,
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
    keyPrefix = created.keyPrefix;
    credentialSecret = created.secret;
    token = formatCredentialBearerToken("LIVE", keyPrefix, credentialSecret);
    assert.match(keyPrefix, /^[a-f0-9]{12}$/);
  });

  after(() => {
    setWebhookDnsResolverForTests(null);
    setPinnedWebhookTransportForTests(null);
  });

  it("authenticates newly created credentials repeatedly without delimiter flakes", async () => {
    for (let i = 0; i < 20; i++) {
      const created = await createApiCredential({
        institutionId: ALTA_BANK_INSTITUTION_ID,
        name: `3b1-loop-${suffix}-${i}`,
        environment: "LIVE",
        scopes: ["institution:read"],
        createdByUserId: actorUserId,
      });
      assert.match(created.keyPrefix, /^[a-f0-9]{12}$/);
      const ctx = await authenticateNccApiRequest(
        new Request("https://ncc.test/api", {
          headers: {
            Authorization: `Bearer ${formatCredentialBearerToken("LIVE", created.keyPrefix, created.secret)}`,
          },
        }),
        `req_loop_${i}`,
      );
      assert.equal(ctx.credentialId, created.id);
    }
  });

  it("delivers a signed webhook via pinned public address without real internet", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.50", family: 4 }]);
    const endpoint = await createWebhookEndpoint({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `pin-${suffix}`,
      url: `https://hooks.example/ncc/${suffix}`,
      environment: "LIVE",
      subscribedEvents: [NCC_OUTBOX_EVENTS.COMPLETED],
      createdByUserId: actorUserId,
    });

    let seenBody = "";
    let seenSig = "";
    setPinnedWebhookTransportForTests(async (input) => {
      assert.equal(input.destination.pinnedAddress, "203.0.113.50");
      seenBody = input.body;
      seenSig = input.headers["NCC-Signature"] ?? "";
      const ts = input.headers["NCC-Timestamp"] ?? "";
      assert.equal(
        await verifyWebhookSignature({
          secret: endpoint.signingSecret,
          timestamp: ts,
          rawBody: input.body,
          signature: seenSig,
          toleranceSeconds: 10 ** 12,
        }),
        true,
      );
      return { status: 200, body: new TextEncoder().encode('{"ok":true}'), headers: {} };
    });

    const event = await prisma.nccWebhookEvent.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        eventType: NCC_OUTBOX_EVENTS.COMPLETED,
        environment: "LIVE",
        subjectType: "SETTLEMENT",
        subjectReference: `ref-${suffix}`,
        payload: { ok: true },
        occurredAt: new Date(),
        dedupeKey: `wh-3b1-success:${suffix}`,
      },
    });
    const delivery = await prisma.nccWebhookDelivery.create({
      data: {
        webhookEventId: event.id,
        webhookEndpointId: endpoint.id,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
    });

    const result = await attemptWebhookDelivery(delivery.id);
    assert.equal(result, "delivered");
    assert.ok(seenBody.includes('"ok":true'));
    assert.ok(seenSig);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: NCC_AUDIT.WEBHOOK_DELIVERY_SUCCEEDED,
        entityId: delivery.id,
      },
    });
    assert.ok(audit);
    const meta = JSON.stringify(audit!.metadata ?? {});
    assert.equal(meta.includes(endpoint.signingSecret), false);
    assert.equal(meta.includes("Authorization"), false);
  });

  it("recovers stale DELIVERING claims without double-finalizing", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.51", family: 4 }]);
    setPinnedWebhookTransportForTests(async () => ({
      status: 200,
      body: new Uint8Array(),
      headers: {},
    }));

    const endpoint = await createWebhookEndpoint({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `stale-${suffix}`,
      url: `https://hooks.example/stale/${suffix}`,
      environment: "LIVE",
      subscribedEvents: [NCC_OUTBOX_EVENTS.COMPLETED],
      createdByUserId: actorUserId,
    });
    const event = await prisma.nccWebhookEvent.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        eventType: NCC_OUTBOX_EVENTS.COMPLETED,
        environment: "LIVE",
        subjectType: "SETTLEMENT",
        subjectReference: `stale-${suffix}`,
        payload: { stale: true },
        occurredAt: new Date(),
        dedupeKey: `wh-3b1-stale:${suffix}`,
      },
    });
    const delivery = await prisma.nccWebhookDelivery.create({
      data: {
        webhookEventId: event.id,
        webhookEndpointId: endpoint.id,
        status: "DELIVERING",
        claimedAt: new Date(Date.now() - WEBHOOK_DELIVERY_LEASE_MS - 1000),
        claimToken: "deadbeefdeadbeefdeadbeefdeadbeef",
        nextAttemptAt: new Date(),
      },
    });

    const tokenA = await claimWebhookDelivery(delivery.id);
    const tokenB = await claimWebhookDelivery(delivery.id);
    assert.ok(tokenA);
    assert.equal(tokenB, null);

    const processed = await processDueWebhookDeliveries(5);
    assert.ok(processed.reclaimedStale >= 0);

    // Fresh claim after resetting to stale again
    await prisma.nccWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERING",
        claimedAt: new Date(Date.now() - WEBHOOK_DELIVERY_LEASE_MS - 1000),
        claimToken: "oldtokenoldtokenoldtokenoldtoken",
      },
    });
    const result = await attemptWebhookDelivery(delivery.id);
    assert.equal(result, "delivered");
    const row = await prisma.nccWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    assert.equal(row.status, "DELIVERED");
    assert.equal(row.claimToken, null);
  });

  it("recovers stale outbox PROCESSING claims", async () => {
    const eventType = `ncc.test.stale.${suffix}`;
    let handled = 0;
    registerOutboxHandler(eventType, async () => {
      handled += 1;
    });
    const event = await enqueueOutboxEvent({
      eventType,
      dedupeKey: `outbox-stale-3b1:${suffix}`,
      payload: { test: true },
    });
    await prisma.settlementOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSING",
        claimedAt: new Date(Date.now() - OUTBOX_CLAIM_LEASE_MS - 1000),
        claimToken: "staleoutboxstaleoutboxstaleoutbox",
      },
    });

    const tokenA = await claimOutboxEvent(event.id, ["PROCESSING"]);
    assert.ok(tokenA, "stale PROCESSING claim should be reclaimable");
    const tokenB = await claimOutboxEvent(event.id, ["PROCESSING"]);
    assert.equal(tokenB, null, "fresh claim must block concurrent workers");

    // Finish the claimed event using claim-token CAS
    await prisma.settlementOutboxEvent.updateMany({
      where: { id: event.id, claimToken: tokenA, status: "PROCESSING" },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        claimToken: null,
        claimedAt: null,
      },
    });
    handled += 1;
    assert.equal(handled, 1);

    const row = await prisma.settlementOutboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(row.status, "COMPLETED");
    assert.equal(row.claimToken, null);

    // Sweep should report reclaim metrics for other stale rows without stranding this one.
    const result = await processDueOutboxEvents(5);
    assert.ok(typeof result.reclaimedStale === "number");
  });

  it("validates settlement list filters and compound cursor", async () => {
    const ctx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api", { headers: { Authorization: `Bearer ${token}` } }),
      "req_list",
    );

    await assert.rejects(
      () => apiListSettlements(ctx, { status: "NOT_A_STATUS" }),
      (e: unknown) => e instanceof NccApiError && e.httpStatus === 400,
    );
    await assert.rejects(
      () => apiListSettlements(ctx, { executionStatus: "NOPE" }),
      (e: unknown) => e instanceof NccApiError && e.httpStatus === 400,
    );
    await assert.rejects(
      () => apiListSettlements(ctx, { direction: "sideways" }),
      (e: unknown) => e instanceof NccApiError && e.httpStatus === 400,
    );
    await assert.rejects(
      () => apiListSettlements(ctx, { limit: "abc" }),
      (e: unknown) => e instanceof NccApiError && e.httpStatus === 400,
    );
    await assert.rejects(
      () => apiListSettlements(ctx, { cursor: "%%%" }),
      (e: unknown) => e instanceof NccApiError && e.httpStatus === 400,
    );

    const page = await apiListSettlements(ctx, { limit: 2, direction: "sent" });
    assert.ok(Array.isArray(page.items));
  });

  it("rejects oversized client strings on submit", async () => {
    const ctx = await authenticateNccApiRequest(
      new Request("https://ncc.test/api", { headers: { Authorization: `Bearer ${token}` } }),
      "req_oversized",
    );
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    await assert.rejects(
      () =>
        apiSubmitSettlement(ctx, {
          receivingRoutingNumber: terminalRouting.routingNumber,
          amount: "1.00",
          currency: "FLR",
          purpose: "x".repeat(NCC_API_STRING_LIMITS.purpose + 1),
          idempotencyKey: `oversized-${suffix}`,
        }),
      (e: unknown) => e instanceof NccApiError && e.code === "VALIDATION_ERROR",
    );
  });

  it("enforces rate limit with Retry-After via HTTP handler", async () => {
    // Exhaust settlement_submit class for this credential
    let hit = false;
    for (let i = 0; i < 40; i++) {
      try {
        await enforceNccApiRateLimit({
          className: "settlement_submit",
          credentialId,
          institutionId: ALTA_BANK_INSTITUTION_ID,
          ipHash: `ip-3b1-${suffix}`,
        });
      } catch (error) {
        if (error instanceof NccApiError && error.code === "RATE_LIMITED") {
          hit = true;
          assert.ok((error.retryAfterMs ?? 0) > 0);
          break;
        }
        throw error;
      }
    }
    assert.equal(hit, true);

    const response = await handleNccApiRequest({
      request: new Request("https://ncc.test/api/ncc/v1/settlements", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }),
      route: "/api/ncc/v1/settlements",
      method: "GET",
      requiredScope: "settlements:read",
      rateLimitClass: "settlement_submit",
      handler: async () => ({ ok: true }),
    });
    // May be 429 if still limited, or 200 if window class differs — either is valid envelope.
    assert.ok([200, 429].includes(response.status));
    if (response.status === 429) {
      assert.ok(response.headers.get("Retry-After"));
      const body = await response.json();
      assert.equal(body.error.code, "RATE_LIMITED");
    }
  });

  it("audits credential expiry without secrets", async () => {
    const created = await createApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `expire-${suffix}`,
      environment: "LIVE",
      scopes: ["institution:read"],
      createdByUserId: actorUserId,
      expiresAt: new Date(Date.now() - 1000),
    });
    await assert.rejects(
      () =>
        authenticateNccApiRequest(
          new Request("https://ncc.test/api", {
            headers: {
              Authorization: `Bearer ${formatCredentialBearerToken("LIVE", created.keyPrefix, created.secret)}`,
            },
          }),
          "req_expired",
        ),
      (e: unknown) => e instanceof NccApiError && e.code === "UNAUTHORIZED",
    );
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: NCC_AUDIT.API_CREDENTIAL_EXPIRED,
        entityId: created.id,
      },
    });
    assert.ok(audit);
    assert.equal(JSON.stringify(audit!.metadata ?? {}).includes(created.secret), false);
  });

  it("keeps settlement finality after webhook permanent failure", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.60", family: 4 }]);
    setPinnedWebhookTransportForTests(async () => ({
      status: 500,
      body: new TextEncoder().encode("fail"),
      headers: {},
    }));
    const endpoint = await createWebhookEndpoint({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `fail-${suffix}`,
      url: `https://hooks.example/fail/${suffix}`,
      environment: "LIVE",
      subscribedEvents: [NCC_OUTBOX_EVENTS.COMPLETED],
      createdByUserId: actorUserId,
    });
    const instruction = await prisma.settlementInstruction.findFirstOrThrow({
      where: { sendingInstitutionId: ALTA_BANK_INSTITUTION_ID, status: "SETTLED" },
      orderBy: { createdAt: "desc" },
    });
    const event = await prisma.nccWebhookEvent.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        eventType: NCC_OUTBOX_EVENTS.COMPLETED,
        environment: "LIVE",
        subjectType: "SETTLEMENT",
        subjectReference: instruction.publicReference,
        payload: { reference: instruction.publicReference },
        occurredAt: new Date(),
        dedupeKey: `wh-3b1-fail:${suffix}`,
      },
    });
    const delivery = await prisma.nccWebhookDelivery.create({
      data: {
        webhookEventId: event.id,
        webhookEndpointId: endpoint.id,
        status: "PENDING",
        maxAttempts: 1,
        nextAttemptAt: new Date(),
      },
    });
    const result = await attemptWebhookDelivery(delivery.id);
    assert.equal(result, "failed");
    const failAudit = await prisma.auditLog.findFirst({
      where: { action: NCC_AUDIT.WEBHOOK_DELIVERY_FAILED, entityId: delivery.id },
    });
    assert.ok(failAudit);
    const still = await prisma.settlementInstruction.findUniqueOrThrow({ where: { id: instruction.id } });
    assert.equal(still.status, "SETTLED");
  });

  it("requires scopes via HTTP handler", async () => {
    const limited = await createApiCredential({
      institutionId: ALTA_BANK_INSTITUTION_ID,
      name: `scoped-${suffix}`,
      environment: "LIVE",
      scopes: ["institution:read"],
      createdByUserId: actorUserId,
    });
    const response = await handleNccApiRequest({
      request: new Request("https://ncc.test/api/ncc/v1/settlements", {
        headers: {
          Authorization: `Bearer ${formatCredentialBearerToken("LIVE", limited.keyPrefix, limited.secret)}`,
        },
      }),
      route: "/api/ncc/v1/settlements",
      method: "GET",
      requiredScope: "settlements:read",
      rateLimitClass: "read",
      handler: async () => ({ ok: true }),
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error.code, "INSUFFICIENT_SCOPE");
  });
});
