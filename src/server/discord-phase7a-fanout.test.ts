import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { DiscordOutbox } from "@prisma/client";
import {
  buildDestinationIdempotencyKey,
  buildSecretaryCentralAuditDisplayPayload,
  isDiscordSecretaryAuditFanoutEnabled,
  planDiscordFanoutDestinations,
  shouldFanoutSecretaryAuditCopy,
  stripDestinationIdempotencyKey,
} from "@/lib/discord/discord-secretary-audit-fanout.ts";
import {
  listRegisteredDiscordEventDefinitions,
  resolveDiscordEventDefinition,
} from "@/lib/discord/discord-event-registry.ts";
import { buildDueOutboxWhere, processDiscordOutboxForBot } from "@/server/discord-outbox.service.ts";
import type { DiscordOutboxDeliveryDeps, DiscordOutboxWorkerStore } from "@/server/discord-outbox.service.ts";
import { validatePremiumEmbedInput, buildPremiumEmbed } from "@/lib/discord/discord-premium-embed.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeRow(
  overrides: Partial<DiscordOutbox> & { id: string; targetBot: string; idempotencyKey: string },
): DiscordOutbox {
  const now = new Date();
  return {
    eventId: `evt-${overrides.id}`,
    product: "bank",
    eventType: "BANK_ACCOUNT_FROZEN",
    channelClass: "staff_ops",
    severity: "WARNING",
    correlationId: null,
    actorJson: null,
    subjectJson: null,
    displayPayload: {
      kind: "staff_audit",
      content: "Account frozen",
      product: "Alta Bank",
      action: "BANK_ACCOUNT_FROZEN",
    },
    internalRef: null,
    deliveryPolicy: "queued",
    status: "PENDING",
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: null,
    lastError: null,
    deliveredAt: null,
    discordMessageId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as DiscordOutbox;
}

function memoryStore(rows: DiscordOutbox[]): DiscordOutboxWorkerStore & { rows: Map<string, DiscordOutbox> } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    rows: byId,
    findDueIds: async (targetBot) =>
      [...byId.values()]
        .filter((row) => row.status === "PENDING" && row.targetBot === targetBot)
        .map((row) => row.id),
    claim: async (id, targetBot) => {
      const row = byId.get(id);
      if (!row || row.status !== "PENDING" || row.targetBot !== targetBot) return null;
      const claimed = { ...row, status: "PROCESSING" as const };
      byId.set(id, claimed);
      return claimed;
    },
    markDeadInvalid: async (row, reason) => {
      byId.set(row.id, {
        ...row,
        status: "DEAD",
        attempts: row.attempts + 1,
        lastError: reason,
        nextAttemptAt: null,
      });
    },
    finalize: async (row, result) => {
      if (result.sent) {
        byId.set(row.id, {
          ...row,
          status: "SENT",
          attempts: row.attempts + 1,
          deliveredAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        });
        return "sent";
      }
      const attempts = row.attempts + 1;
      if (attempts >= row.maxAttempts) {
        byId.set(row.id, {
          ...row,
          status: "DEAD",
          attempts,
          lastError: result.reason ?? "not_sent",
          nextAttemptAt: null,
        });
        return "dead";
      }
      byId.set(row.id, {
        ...row,
        status: "PENDING",
        attempts,
        lastError: result.reason ?? "not_sent",
        nextAttemptAt: new Date(Date.now() + 60_000),
      });
      return "requeued";
    },
  };
}

describe("Phase 7A Secretary audit fan-out", () => {
  const keys = [
    "DISCORD_SECRETARY_AUDIT_FANOUT",
    "DISCORD_SECRETARY_DELIVERY",
    "DISCORD_TERMINAL_DELIVERY",
    "DISCORD_PRODUCT_AWARE_ROUTING",
  ] as const;
  const originals = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  });

  it("flag defaults off and preserves single unsuffixed destination", () => {
    delete process.env.DISCORD_SECRETARY_AUDIT_FANOUT;
    assert.equal(isDiscordSecretaryAuditFanoutEnabled(), false);
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:bank-freeze-1",
      product: "bank",
      eventType: "BANK_ACCOUNT_FROZEN",
      channelClass: "staff_ops",
      productTargetBot: "bank",
      displayPayload: { kind: "staff_audit", content: "frozen", action: "BANK_ACCOUNT_FROZEN" },
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.targetBot, "bank");
    assert.equal(plans[0]?.idempotencyKey, "staff-audit:bank-freeze-1");
    assert.equal(plans[0]?.role, "product");
  });

  it("Bank staff event → Bank + Secretary destinations", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:bank-freeze-2",
      product: "bank",
      eventType: "BANK_ACCOUNT_FROZEN",
      channelClass: "staff_ops",
      productTargetBot: "bank",
      displayPayload: { kind: "staff_audit", content: "frozen", action: "BANK_ACCOUNT_FROZEN" },
    });
    assert.equal(plans.length, 2);
    assert.deepEqual(
      plans.map((p) => p.targetBot).sort(),
      ["bank", "secretary"],
    );
    assert.equal(plans.find((p) => p.role === "product")?.idempotencyKey, "staff-audit:bank-freeze-2:destination:bank");
    assert.equal(
      plans.find((p) => p.role === "secretary_audit")?.idempotencyKey,
      "staff-audit:bank-freeze-2:destination:secretary",
    );
    assert.equal(plans.find((p) => p.role === "secretary_audit")?.displayPayload.kind, "staff_audit");
    assert.equal(plans.find((p) => p.role === "secretary_audit")?.product, "ops");
  });

  it("Terminal staff event → Terminal + Secretary destinations", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:term-fee-1",
      product: "terminal",
      eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      channelClass: "staff_ops",
      productTargetBot: "terminal",
      displayPayload: {
        kind: "staff_audit",
        content: "Fee updated",
        product: "Alta Terminal",
        action: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      },
    });
    assert.equal(plans.length, 2);
    assert.ok(plans.some((p) => p.targetBot === "terminal" && p.role === "product"));
    assert.ok(plans.some((p) => p.targetBot === "secretary" && p.role === "secretary_audit"));
  });

  it("Secretary event → Secretary once (no duplicate)", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:ops-job-1",
      product: "ops",
      eventType: "OPS_JOB_FAILED",
      channelClass: "staff_ops",
      productTargetBot: "secretary",
      displayPayload: { kind: "staff_audit", content: "job failed", action: "OPS_JOB_FAILED" },
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.targetBot, "secretary");
    assert.equal(plans[0]?.role, "product");
    assert.equal(plans[0]?.idempotencyKey, "staff-audit:ops-job-1:destination:secretary");
  });

  it("Customer DM → Bank only (never Secretary)", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "customer-dm:u1:DEPOSIT_APPROVED:n1",
      product: "bank",
      eventType: "DEPOSIT_APPROVED",
      channelClass: "customer_dm",
      productTargetBot: "bank",
      displayPayload: {
        kind: "customer_dm",
        userId: "u1",
        title: "Deposit approved",
        body: "Your deposit of ƒ100 was approved.",
      },
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.targetBot, "bank");
    assert.equal(plans[0]?.displayPayload.kind, "customer_dm");
  });

  it("Security event → Secretary security route", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:recon-crit",
      product: "terminal",
      eventType: "TERMINAL_CRYPTO_RECON_CRITICAL",
      channelClass: "security_audit",
      productTargetBot: "terminal",
      displayPayload: { kind: "staff_audit", content: "recon critical", action: "TERMINAL_CRYPTO_RECON_CRITICAL" },
    });
    const secretary = plans.find((p) => p.role === "secretary_audit");
    assert.ok(secretary);
    assert.equal(secretary.channelClass, "security_audit");
  });

  it("Delivery failure → Secretary delivery-alert route", () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    // CUSTOMER_DM_DELIVERY_FAILED is secretary-owned → single destination
    const owned = resolveDiscordEventDefinition("CUSTOMER_DM_DELIVERY_FAILED");
    assert.equal(owned.ownedByBot, "secretary");
    assert.equal(shouldFanoutSecretaryAuditCopy(owned), false);

    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:delivery-fail",
      product: "secretary",
      eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      channelClass: "delivery_alert",
      productTargetBot: "secretary",
      displayPayload: { kind: "staff_audit", content: "dm failed", action: "CUSTOMER_DM_DELIVERY_FAILED" },
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.channelClass, "delivery_alert");
    assert.equal(plans[0]?.targetBot, "secretary");
  });

  it("destination idempotency keys are distinct and stripable", () => {
    const bank = buildDestinationIdempotencyKey("staff-audit:x", "bank");
    const sec = buildDestinationIdempotencyKey("staff-audit:x", "secretary");
    assert.notEqual(bank, sec);
    assert.equal(stripDestinationIdempotencyKey(bank), "staff-audit:x");
    assert.equal(stripDestinationIdempotencyKey(sec), "staff-audit:x");
  });

  it("Secretary payload is redacted and never includes customer DM body", () => {
    const payload = buildSecretaryCentralAuditDisplayPayload({
      originalProduct: "bank",
      eventType: "BANK_ACCOUNT_FROZEN",
      action: "BANK_ACCOUNT_FROZEN",
      severity: "WARNING",
      actorLabel: "ops-user",
      entityType: "BANK_ACCOUNT",
      entityId: "acc_123",
      correlationId: "corr-1",
      internalUrl: "/internal/accounts/acc_123",
      redactedContent: "Token MTQx.abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ and AB-1234-567890",
      originalDestinationBot: "bank",
      originalChannelClass: "staff_ops",
    });
    assert.equal(payload.kind, "staff_audit");
    assert.match(payload.content, /Central audit/i);
    assert.doesNotMatch(payload.content, /MTQx\.abcdefghijklmnopqrstuvwxyz/);
    assert.doesNotMatch(payload.content, /AB-1234-567890/);
    assert.doesNotMatch(payload.content, /Your deposit of/);
    if (payload.embed && Object.keys(payload.embed).length > 0) {
      const footer = (payload.embed.footer as { text?: string } | undefined)?.text ?? "";
      assert.match(footer, /Secretary|operations/i);
      assert.doesNotMatch(footer, /Alta Bank · Newport/);
      assert.doesNotMatch(footer, /Alta Terminal · Newport/);
    }
  });

  it("Bank events never use Terminal branding in Secretary audit", () => {
    const built = buildPremiumEmbed({
      product: "ops",
      eventType: "BANK_ACCOUNT_FROZEN",
      title: "Central audit · Bank account frozen",
      footer: "Alta Secretary · Newport",
    });
    assert.doesNotMatch(built.brand.footer, /Terminal/);
    assert.ok(validatePremiumEmbedInput({
      product: "ops",
      eventType: "BANK_ACCOUNT_FROZEN",
      title: "Central audit · Bank account frozen",
    }).ok);
  });

  it("Terminal events never use Bank branding in Secretary audit", () => {
    const payload = buildSecretaryCentralAuditDisplayPayload({
      originalProduct: "terminal",
      eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      action: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      originalDestinationBot: "terminal",
      originalChannelClass: "staff_ops",
    });
    assert.doesNotMatch(payload.content, /Alta Bank · Newport/);
    const footer = payload.embed
      ? ((payload.embed.footer as { text?: string } | undefined)?.text ?? "")
      : "";
    assert.doesNotMatch(footer, /Alta Bank · Newport/);
  });

  it("workers cannot claim another bot's rows; one destination failure is independent", async () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const bankRow = makeRow({
      id: "b1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:indep:destination:bank",
    });
    const secRow = makeRow({
      id: "s1",
      targetBot: "secretary",
      product: "ops",
      idempotencyKey: "staff-audit:indep:destination:secretary",
      displayPayload: {
        kind: "staff_audit",
        content: "Central audit",
        product: "Alta Ops",
      },
    });
    const store = memoryStore([bankRow, secRow]);

    const bankDeps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: true }),
      dispatchStaffAudit: async () => ({ sent: true }),
    };
    const secDeps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false, reason: "secretary_refuses_customer_dm" }),
      dispatchStaffAudit: async () => ({ sent: false, reason: "channel_not_configured" }),
    };

    const bankResult = await processDiscordOutboxForBot("bank", new Date(), bankDeps, store);
    assert.equal(bankResult.sent, 1);
    assert.equal(store.rows.get("b1")?.status, "SENT");
    assert.equal(store.rows.get("s1")?.status, "PENDING");

    // Bank worker cannot claim secretary row
    const where = buildDueOutboxWhere("bank", new Date());
    assert.equal(where.targetBot, "bank");

    const secResult = await processDiscordOutboxForBot("secretary", new Date(), secDeps, store);
    assert.equal(secResult.sent, 0);
    assert.ok(secResult.requeued === 1 || secResult.dead === 1);
    assert.notEqual(store.rows.get("s1")?.status, "SENT");
    // Bank remains sent
    assert.equal(store.rows.get("b1")?.status, "SENT");
  });

  it("permanent failures dead-letter; retryable requeue", async () => {
    const row = makeRow({
      id: "dead1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:dead:destination:bank",
      attempts: 4,
      maxAttempts: 5,
    });
    const store = memoryStore([row]);
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false }),
      dispatchStaffAudit: async () => ({ sent: false, reason: "permanent_fail" }),
    };
    const result = await processDiscordOutboxForBot("bank", new Date(), deps, store);
    assert.equal(result.dead, 1);
    assert.equal(store.rows.get("dead1")?.status, "DEAD");

    const retryRow = makeRow({
      id: "retry1",
      targetBot: "terminal",
      product: "terminal",
      idempotencyKey: "staff-audit:retry:destination:terminal",
      attempts: 0,
      maxAttempts: 5,
    });
    const store2 = memoryStore([retryRow]);
    const result2 = await processDiscordOutboxForBot(
      "terminal",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "retryable:rate_limit" }),
      },
      store2,
    );
    assert.equal(result2.requeued, 1);
    assert.equal(store2.rows.get("retry1")?.status, "PENDING");
  });

  it("existing unsuffixed outbox rows remain processable", async () => {
    delete process.env.DISCORD_SECRETARY_AUDIT_FANOUT;
    const legacy = makeRow({
      id: "legacy1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:legacy-no-suffix",
    });
    const store = memoryStore([legacy]);
    const result = await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: true }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    assert.equal(result.sent, 1);
    assert.equal(store.rows.get("legacy1")?.status, "SENT");
  });

  it("inventory: every exact registry event has a classification", () => {
    const defs = listRegisteredDiscordEventDefinitions();
    assert.ok(defs.length > 20);
    for (const def of defs) {
      assert.ok(def.classification, `missing classification for ${def.eventType}`);
      const allowed = new Set([
        "customer_notification",
        "product_staff_audit",
        "secretary_system_audit",
        "security_alert",
        "delivery_failure",
        "role_management",
      ]);
      assert.ok(allowed.has(def.classification), `${def.eventType} has unknown class ${def.classification}`);
    }
  });

  it("inventory: staff/system events declare fan-out eligibility explicitly via classification", () => {
    const defs = listRegisteredDiscordEventDefinitions();
    for (const def of defs) {
      if (def.classification === "customer_notification") {
        assert.equal(shouldFanoutSecretaryAuditCopy(def), false);
        continue;
      }
      if (def.ownedByBot === "secretary" || def.deliveryBot === "secretary") {
        assert.equal(
          shouldFanoutSecretaryAuditCopy({ ...def }),
          false,
          `${def.eventType} secretary-owned must not duplicate fan-out`,
        );
        continue;
      }
      // Bank/Terminal staff, security, role — fan-out when flag on
      process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
      assert.equal(
        shouldFanoutSecretaryAuditCopy(def),
        true,
        `${def.eventType} should fan out when flag on`,
      );
      delete process.env.DISCORD_SECRETARY_AUDIT_FANOUT;
      assert.equal(shouldFanoutSecretaryAuditCopy(def), false);
    }
  });

  it("inventory: staff producers still route through sendStaffAuditMessage / outbox fan-out", () => {
    const srcRoot = join(__dirname, "..");
    const bridge = readFileSync(join(srcRoot, "lib/staff-audit/audit-log-discord-bridge.ts"), "utf8");
    assert.match(bridge, /sendStaffAuditMessage/);
    const outbox = readFileSync(join(srcRoot, "server/discord-outbox.service.ts"), "utf8");
    assert.match(outbox, /enqueueDiscordFanout/);
    assert.match(outbox, /secretaryAuditFanoutEnabled/);
    const notify = readFileSync(join(srcRoot, "server/staff-audit-notification.service.ts"), "utf8");
    assert.match(notify, /enqueueStaffAuditOutbox/);
    assert.match(notify, /resolveProductOutboxIdempotencyKey/);
  });
});
