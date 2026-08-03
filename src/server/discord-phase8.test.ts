import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiscordOutbox } from "@prisma/client";
import {
  listRegisteredDiscordEventTypes,
  resolveDiscordEventDefinition,
  UnknownDiscordEventError,
} from "@/lib/discord/discord-event-registry.ts";
import { ALL_PHASE8_STAFF_EXACT } from "@/lib/discord/discord-event-registry-phase8-exact.ts";
import {
  getDiscordPlatformReadiness,
  isBotReadinessHealthy,
} from "@/lib/discord/discord-config-readiness.ts";
import { assertProductTemplateCoverage } from "@/lib/discord/discord-product-notification-templates.ts";
import {
  buildDueOutboxWhere,
  processDiscordOutboxForBot,
  type DiscordOutboxDeliveryDeps,
  type DiscordOutboxWorkerStore,
} from "@/server/discord-outbox.service.ts";
import {
  STALE_PROCESSING_MS,
  isStaleProcessingRow,
} from "@/server/discord-outbox-ops.service.ts";
import {
  assertRoleOwnedByBot,
  resolveProductRoleConfig,
  roleEventTypeForAction,
} from "@/lib/discord/discord-product-role.ts";
import { SEVERITY_COLORS } from "@/lib/discord/discord-premium-embed.ts";
import { buildProductPremiumNotification } from "@/lib/discord/discord-product-notification-templates.ts";
import { buildStaffAuditPremiumPayload } from "@/server/staff-audit-notification.service.ts";
import { applyDiscordProductRole } from "@/server/discord-product-role.service.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) acc.push(path);
  }
  return acc;
}

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

function memoryStore(rows: DiscordOutbox[]): DiscordOutboxWorkerStore & {
  rows: Map<string, DiscordOutbox>;
} {
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

describe("Phase 8 — event coverage inventory", () => {
  it("registers Phase 8 staff exact events without silent Bank default", () => {
    process.env.DISCORD_STRICT_EVENT_REGISTRY = "1";
    for (const entry of ALL_PHASE8_STAFF_EXACT) {
      const def = resolveDiscordEventDefinition(entry.eventType);
      assert.equal(def.eventType, entry.eventType);
      assert.ok(def.classification);
      assert.ok(def.ownedByBot);
      assert.ok(def.deliveryBot);
      if (entry.partial.product === "terminal") {
        assert.equal(def.product, "terminal");
      }
      if (entry.partial.ownedByBot === "secretary") {
        assert.equal(def.ownedByBot, "secretary");
      }
    }
  });

  it("Discord-bound notification producers do not use unregistered event types", () => {
    process.env.DISCORD_STRICT_EVENT_REGISTRY = "1";
    const exact = new Set(listRegisteredDiscordEventTypes());
    const files = walk(join(srcRoot, "server")).concat(walk(join(srcRoot, "lib")));
    const producerHints =
      /sendStaffAuditMessage|scheduleCreateUserNotification|enqueueStaffAuditOutbox|enqueueCustomerDmOutbox|createUserNotification\(/;
    const typeRe = /(?:type|eventType|action):\s*"([A-Z][A-Z0-9_]{4,})"/g;
    const unknown: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!producerHints.test(src)) continue;
      // Skip inventory/test helpers
      if (file.includes("discord-phase") || file.includes("discord-event-registry")) continue;
      let match: RegExpExecArray | null;
      const re = new RegExp(typeRe);
      while ((match = re.exec(src))) {
        const eventType = match[1]!;
        if (!eventType.includes("_")) continue;
        // UI labels / non-events
        if (["POST", "GET", "PENDING", "ACTIVE", "PERSONAL", "COMPANY"].includes(eventType)) continue;
        try {
          resolveDiscordEventDefinition(eventType);
          // Prefer exact when Discord-bound; prefix-only is flagged for Phase 8 staff bootstrap set.
          if (!exact.has(eventType) && ALL_PHASE8_STAFF_EXACT.some((e) => e.eventType === eventType)) {
            unknown.push(`${eventType} missing exact @ ${file}`);
          }
        } catch (error) {
          if (error instanceof UnknownDiscordEventError) {
            unknown.push(`${eventType} @ ${file.replace(srcRoot + "/", "")}`);
          }
        }
      }
    }

    assert.equal(unknown.length, 0, `unregistered Discord event types:\n${unknown.slice(0, 40).join("\n")}`);
  });

  it("Bank/Terminal premium template coverage remains complete", () => {
    const { missing } = assertProductTemplateCoverage();
    assert.equal(missing.length, 0, missing.join(", "));
  });
});

describe("Phase 8 — outbox reliability", () => {
  const keys = ["DISCORD_SECRETARY_AUDIT_FANOUT", "DISCORD_TERMINAL_DELIVERY"] as const;
  const originals = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  });

  it("competing workers: only one claim succeeds per row", async () => {
    const row = makeRow({
      id: "compete-1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:compete-1",
    });
    const store = memoryStore([row]);
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: true }),
      dispatchStaffAudit: async () => ({ sent: true }),
    };

    const [a, b] = await Promise.all([
      processDiscordOutboxForBot("bank", new Date(), deps, store),
      processDiscordOutboxForBot("bank", new Date(), deps, store),
    ]);
    assert.equal(a.sent + b.sent, 1);
    assert.equal(store.rows.get("compete-1")?.status, "SENT");
  });

  it("same event processed twice: second claim skips SENT/PROCESSING", async () => {
    const row = makeRow({
      id: "dup-1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:dup-1",
      status: "SENT",
    });
    const store = memoryStore([row]);
    const result = await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: true }),
        dispatchStaffAudit: async () => {
          throw new Error("should not deliver twice");
        },
      },
      store,
    );
    assert.equal(result.processed, 0);
  });

  it("failed Secretary destination does not unwind successful Bank product row", async () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const bank = makeRow({
      id: "fan-b",
      targetBot: "bank",
      idempotencyKey: "staff-audit:fan:destination:bank",
    });
    const sec = makeRow({
      id: "fan-s",
      targetBot: "secretary",
      product: "ops",
      idempotencyKey: "staff-audit:fan:destination:secretary",
      displayPayload: { kind: "staff_audit", content: "Central audit", product: "Alta Ops" },
    });
    const store = memoryStore([bank, sec]);
    await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: true }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    await processDiscordOutboxForBot(
      "secretary",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false, reason: "secretary_refuses_customer_dm" }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "channel_not_configured" }),
      },
      store,
    );
    assert.equal(store.rows.get("fan-b")?.status, "SENT");
    assert.notEqual(store.rows.get("fan-s")?.status, "SENT");
  });

  it("workers cannot claim another bot's rows", () => {
    assert.equal(buildDueOutboxWhere("bank", new Date()).targetBot, "bank");
    assert.equal(buildDueOutboxWhere("terminal", new Date()).targetBot, "terminal");
  });

  it("retryable failure requeues; permanent failure dead-letters at max attempts", async () => {
    const retryRow = makeRow({
      id: "retry-p8",
      targetBot: "bank",
      idempotencyKey: "staff-audit:retry-p8",
    });
    const store = memoryStore([retryRow]);
    const r1 = await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "temporary_outage" }),
      },
      store,
    );
    assert.equal(r1.requeued, 1);
    assert.equal(store.rows.get("retry-p8")?.status, "PENDING");
    assert.ok(store.rows.get("retry-p8")?.nextAttemptAt);

    const deadRow = makeRow({
      id: "dead-p8",
      targetBot: "bank",
      idempotencyKey: "staff-audit:dead-p8",
      attempts: 4,
      maxAttempts: 5,
    });
    const store2 = memoryStore([deadRow]);
    const r2 = await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "permanent" }),
      },
      store2,
    );
    assert.equal(r2.dead, 1);
  });

  it("retry after temporary bot downtime eventually succeeds", async () => {
    const row = makeRow({
      id: "downtime-1",
      targetBot: "bank",
      idempotencyKey: "staff-audit:downtime-1",
    });
    const store = memoryStore([row]);
    await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "bot_unreachable" }),
      },
      store,
    );
    assert.equal(store.rows.get("downtime-1")?.status, "PENDING");
    // Make due again
    store.rows.set("downtime-1", {
      ...store.rows.get("downtime-1")!,
      nextAttemptAt: null,
    });
    await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: true }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    assert.equal(store.rows.get("downtime-1")?.status, "SENT");
  });

  it("missing channel configuration fails closed without marking SENT", async () => {
    const row = makeRow({
      id: "nochan-1",
      targetBot: "secretary",
      product: "ops",
      idempotencyKey: "staff-audit:nochan-1",
    });
    const store = memoryStore([row]);
    await processDiscordOutboxForBot(
      "secretary",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false, reason: "secretary_refuses_customer_dm" }),
        dispatchStaffAudit: async () => ({ sent: false, reason: "channel_not_configured" }),
      },
      store,
    );
    assert.notEqual(store.rows.get("nochan-1")?.status, "SENT");
  });

  it("product + Secretary fan-out both succeed independently", async () => {
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";
    const bank = makeRow({
      id: "fan-ok-b",
      targetBot: "bank",
      idempotencyKey: "staff-audit:fan-ok:destination:bank",
    });
    const sec = makeRow({
      id: "fan-ok-s",
      targetBot: "secretary",
      product: "ops",
      idempotencyKey: "staff-audit:fan-ok:destination:secretary",
    });
    const store = memoryStore([bank, sec]);
    await processDiscordOutboxForBot(
      "bank",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: true }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    await processDiscordOutboxForBot(
      "secretary",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    assert.equal(store.rows.get("fan-ok-b")?.status, "SENT");
    assert.equal(store.rows.get("fan-ok-s")?.status, "SENT");
  });

  it("stale PROCESSING recovery predicate and constant", () => {
    assert.ok(STALE_PROCESSING_MS >= 5 * 60_000);
    const now = new Date("2026-08-03T12:00:00.000Z");
    const fresh = {
      status: "PROCESSING",
      updatedAt: new Date(now.getTime() - 60_000),
    };
    const stale = {
      status: "PROCESSING",
      updatedAt: new Date(now.getTime() - STALE_PROCESSING_MS - 1),
    };
    assert.equal(isStaleProcessingRow(fresh, now), false);
    assert.equal(isStaleProcessingRow(stale, now), true);
    assert.equal(isStaleProcessingRow({ status: "PENDING", updatedAt: stale.updatedAt }, now), false);
  });

  it("Secretary and Terminal refuse customer_dm payloads (dispatch contract)", async () => {
    const dmPayload = {
      kind: "customer_dm" as const,
      content: "hi",
    };
    const sec = makeRow({
      id: "sec-dm",
      targetBot: "secretary",
      idempotencyKey: "dm:sec",
      displayPayload: dmPayload,
      channelClass: "customer_dm",
    });
    const term = makeRow({
      id: "term-dm",
      targetBot: "terminal",
      idempotencyKey: "dm:term",
      displayPayload: dmPayload,
      channelClass: "customer_dm",
    });
    const store = memoryStore([sec, term]);
    await processDiscordOutboxForBot(
      "secretary",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false, reason: "secretary_refuses_customer_dm" }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    await processDiscordOutboxForBot(
      "terminal",
      new Date(),
      {
        dispatchCustomerDm: async () => ({ sent: false, reason: "terminal_refuses_customer_dm" }),
        dispatchStaffAudit: async () => ({ sent: true }),
      },
      store,
    );
    assert.notEqual(store.rows.get("sec-dm")?.status, "SENT");
    assert.notEqual(store.rows.get("term-dm")?.status, "SENT");
  });
});

describe("Phase 8 — role sync reliability", () => {
  const keys = [
    "DISCORD_BANK_CLIENT_ROLE_ID",
    "DISCORD_BANK_GUILD_ID",
    "DISCORD_BANK_BOT_TOKEN",
    "DISCORD_TERMINAL_INVESTOR_ROLE_ID",
    "DISCORD_TERMINAL_GUILD_ID",
    "DISCORD_TERMINAL_BOT_TOKEN",
  ] as const;
  const originals = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  });

  it("fails closed when Bank role/guild missing", async () => {
    delete process.env.DISCORD_BANK_CLIENT_ROLE_ID;
    delete process.env.DISCORD_BANK_GUILD_ID;
    const result = await applyDiscordProductRole({
      productRole: "bank_client",
      action: "grant",
      discordUserId: "u1",
      requiredTargetBot: "bank",
      skipEligibilityCheck: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /not_configured|missing|disabled/);
  });

  it("cross-product isolation: Terminal bot cannot grant Bank client", async () => {
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "role-bank";
    process.env.DISCORD_BANK_GUILD_ID = "guild-bank";
    process.env.DISCORD_BANK_BOT_TOKEN = "Bot.fake";
    const result = await applyDiscordProductRole({
      productRole: "bank_client",
      action: "grant",
      discordUserId: "u1",
      requiredTargetBot: "terminal",
      skipEligibilityCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "cross_product_role_refused");
  });

  it("assertRoleOwnedByBot refuses Bank applying Terminal investor", () => {
    process.env.DISCORD_TERMINAL_INVESTOR_ROLE_ID = "term-role";
    process.env.DISCORD_TERMINAL_GUILD_ID = "term-guild";
    const result = assertRoleOwnedByBot("terminal_investor", "bank");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "cross_product_role_refused");
  });

  it("role event types are registered exactly", () => {
    process.env.DISCORD_STRICT_EVENT_REGISTRY = "1";
    for (const action of ["grant", "revoke", "reconcile"] as const) {
      for (const role of ["bank_client", "terminal_investor", "secretary_staff"] as const) {
        const eventType = roleEventTypeForAction(role, action);
        const def = resolveDiscordEventDefinition(eventType);
        assert.equal(def.eventType, eventType);
        assert.ok(def.ownedByBot);
      }
    }
  });

  it("resolveProductRoleConfig never returns another product's role id", () => {
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "bank-role";
    process.env.DISCORD_BANK_GUILD_ID = "bank-guild";
    process.env.DISCORD_TERMINAL_INVESTOR_ROLE_ID = "term-role";
    process.env.DISCORD_TERMINAL_GUILD_ID = "term-guild";
    const bank = resolveProductRoleConfig("bank_client");
    const term = resolveProductRoleConfig("terminal_investor");
    assert.equal(bank?.roleId, "bank-role");
    assert.equal(term?.roleId, "term-role");
    assert.notEqual(bank?.roleId, term?.roleId);
    assert.notEqual(bank?.guildId, term?.guildId);
  });
});

describe("Phase 8 — premium embed severity + snapshots", () => {
  const original = process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS;
  afterEach(() => {
    if (original === undefined) delete process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS;
    else process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = original;
  });

  it("staff audit severity overrides registry template color when premium on", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const bank = buildStaffAuditPremiumPayload({
      product: "Alta Bank",
      action: "Transfer completed",
      eventType: "TRANSFER_COMPLETED",
      actorLabel: "Ops",
      details: "ƒ10.00",
      severity: "ACTION",
      dedupeKey: "xfer-p8",
      internalUrl: "/internal/bank",
    });
    assert.equal(bank.embed.color, SEVERITY_COLORS.ACTION);
  });

  it("representative Bank and Terminal templates snapshot fields", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const deposit = buildProductPremiumNotification({
      eventType: "DEPOSIT_APPROVED",
      audience: "customer",
      title: "Deposit completed",
      body: "Your deposit settled.",
      metadata: { amountLabel: "ƒ25.00", status: "Completed" },
    });
    assert.ok(deposit);
    assert.equal(deposit.product, "bank");
    assert.match(String(deposit.embed.footer ? (deposit.embed.footer as { text: string }).text : ""), /Alta Bank/);

    const fill = buildProductPremiumNotification({
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      audience: "staff",
      title: "Crypto order filled",
      body: "Fill recorded",
      severity: "ACTION",
      metadata: { status: "Filled", orderId: "ord-1" },
    });
    assert.ok(fill);
    assert.equal(fill.product, "terminal");
    assert.equal(fill.embed.color, SEVERITY_COLORS.ACTION);
    assert.doesNotMatch(String((fill.embed.footer as { text: string }).text), /Alta Bank/);
  });
});

describe("Phase 8 — configuration readiness", () => {
  it("never claims healthy when Bank channel is missing", () => {
    const prev = process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    const readiness = getDiscordPlatformReadiness();
    const bank = readiness.bots.find((b) => b.bot === "bank");
    assert.ok(bank);
    assert.ok(bank.state === "blocked" || bank.state === "not_configured");
    assert.equal(isBotReadinessHealthy(bank), false);
    if (prev === undefined) delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    else process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = prev;
  });

  it("detects cross-routing channel collisions", () => {
    process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "channel-same";
    process.env.DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID = "channel-same";
    const readiness = getDiscordPlatformReadiness();
    assert.ok(
      readiness.crossRoutingWarnings.includes("bank_staff_channel_matches_secretary_staff_channel"),
    );
    delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    delete process.env.DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID;
  });
});

describe("Phase 8 — ops panel wiring", () => {
  it("ops panel and server functions exist with UI Lab gates", () => {
    const panel = readFileSync(join(srcRoot, "components/internal/internal-discord-ops-panel.tsx"), "utf8");
    assert.match(panel, /Discord operations/);
    assert.match(panel, /Refresh health/);
    assert.match(panel, /assertNotUiLabMutation|useUiLabMutationGate/);
    assert.match(panel, /Escape|keydown/);
    assert.match(panel, /Replay/);
    assert.match(panel, /Promise\.allSettled/);
    assert.match(panel, /Role synchronization is unavailable/);
    assert.match(panel, /unavailableLabel\("Discord delivery"\)/);
    assert.doesNotMatch(panel, /\{unavailableLabel\}/);
    const fns = readFileSync(join(srcRoot, "lib/internal/discord-ops.functions.ts"), "utf8");
    assert.match(fns, /retryDiscordOutboxRow/);
    assert.match(fns, /replayDiscordOutboxRow/);
    assert.match(fns, /assertNotUiLabMutation/);
  });
});
