import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { DiscordOutbox } from "@prisma/client";
import {
  buildDueOutboxWhere,
  deliverDiscordOutboxPayload,
  processDiscordOutboxForBot,
  resetDiscordOutboxHealthForTests,
  secretaryMayDeliverPayload,
  type DiscordOutboxDeliveryDeps,
  type DiscordOutboxWorkerStore,
} from "./discord-outbox.service.ts";
import {
  isDiscordSecretaryDeliveryEnabled,
  resolveOutboxTargetBot,
  resolvePhase3DeliveryBot,
} from "@/lib/discord/discord-event-envelope";
import { resolveDiscordEventDefinition } from "@/lib/discord/discord-event-registry";
import { resolveStaffDiscordChannel } from "@/lib/discord/discord-channel-routing";
import { resolveSecretaryDispatchChannelForTests } from "./secretary-discord-dispatch.service.ts";
import { getSecretaryDiscordBotConfig } from "./secretary-discord-dispatch.service.ts";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy.ts";

function makeRow(overrides: Partial<DiscordOutbox> & { id: string; targetBot: string }): DiscordOutbox {
  const now = new Date();
  return {
    eventId: "evt-1",
    idempotencyKey: `key-${overrides.id}`,
    product: "ops",
    eventType: "OPS_JOB_FAILED",
    channelClass: "staff_ops",
    severity: "WARNING",
    correlationId: null,
    actorJson: null,
    subjectJson: null,
    displayPayload: {
      kind: "staff_audit",
      content: "[WARNING] [Alta Ops] Job failed — System",
      product: "Alta Ops",
      action: "OPS_JOB_FAILED",
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

function memoryStore(rows: DiscordOutbox[]): DiscordOutboxWorkerStore {
  const byId = new Map(rows.map((row) => [row.id, { ...row }]));

  return {
    findDueIds: async (targetBot) =>
      [...byId.values()]
        .filter((row) => row.status === "PENDING" && row.targetBot === targetBot)
        .map((row) => row.id),
    claim: async (id, targetBot) => {
      const row = byId.get(id);
      if (!row || row.status !== "PENDING" || row.targetBot !== targetBot) return null;
      row.status = "PROCESSING";
      return { ...row };
    },
    markDeadInvalid: async (row, reason) => {
      const current = byId.get(row.id);
      if (!current) return;
      current.status = "DEAD";
      current.lastError = reason;
      current.attempts += 1;
    },
    finalize: async (row, result) => {
      const current = byId.get(row.id);
      if (!current) return "dead";
      current.attempts += 1;
      if (result.sent) {
        current.status = "SENT";
        current.deliveredAt = new Date();
        current.lastError = null;
        return "sent";
      }
      if (current.attempts >= current.maxAttempts) {
        current.status = "DEAD";
        current.lastError = result.reason ?? "not_sent";
        return "dead";
      }
      current.status = "PENDING";
      current.lastError = result.reason ?? "not_sent";
      return "requeued";
    },
  };
}

describe("Phase 3 outbox target bot resolution", () => {
  const originalSecretary = process.env.DISCORD_SECRETARY_DELIVERY;
  const originalAware = process.env.DISCORD_PRODUCT_AWARE_ROUTING;
  const originalTerminal = process.env.DISCORD_TERMINAL_DELIVERY;

  afterEach(() => {
    if (originalSecretary === undefined) delete process.env.DISCORD_SECRETARY_DELIVERY;
    else process.env.DISCORD_SECRETARY_DELIVERY = originalSecretary;
    if (originalAware === undefined) delete process.env.DISCORD_PRODUCT_AWARE_ROUTING;
    else process.env.DISCORD_PRODUCT_AWARE_ROUTING = originalAware;
    if (originalTerminal === undefined) delete process.env.DISCORD_TERMINAL_DELIVERY;
    else process.env.DISCORD_TERMINAL_DELIVERY = originalTerminal;
  });

  it("keeps Phase 2 bank targeting when Secretary delivery is off", () => {
    delete process.env.DISCORD_SECRETARY_DELIVERY;
    assert.equal(isDiscordSecretaryDeliveryEnabled(), false);
    assert.equal(
      resolveOutboxTargetBot({ product: "ops", channelClass: "staff_ops", eventType: "OPS_JOB_FAILED" }),
      "bank",
    );
  });

  it("routes Secretary staff events to secretary worker only when enabled", () => {
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    assert.equal(resolvePhase3DeliveryBot("ops", "staff_ops", "OPS_JOB_FAILED"), "secretary");
    assert.equal(
      resolveOutboxTargetBot({
        product: "secretary",
        channelClass: "delivery_alert",
        eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      }),
      "secretary",
    );
    assert.equal(resolveDiscordEventDefinition("STAFF_AUDIT_MESSAGE_FAILED").deliveryBot, "secretary");
    assert.equal(resolveDiscordEventDefinition("INTERNAL_NOTE_ADDED").ownedByBot, "secretary");
  });

  it("keeps Bank customer DMs on bank even for corporate product", () => {
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "corporate",
        channelClass: "customer_dm",
        eventType: "COMPANY_VERIFIED",
      }),
      "bank",
    );
  });

  it("keeps Terminal events on Bank delivery path when Terminal delivery is off", () => {
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    delete process.env.DISCORD_TERMINAL_DELIVERY;
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "customer_dm",
        eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      }),
      "bank",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      }),
      "bank",
    );
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_ORDER_FILLED").deliveryBot, "bank");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_ORDER_FILLED").ownedByBot, "terminal");
  });

  it("records explicit Terminal bot target only when requested", () => {
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    delete process.env.DISCORD_TERMINAL_DELIVERY;
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
        explicitTerminalBot: true,
      }),
      "terminal",
    );
  });

  it("keeps Bank events on bank", () => {
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "bank",
        channelClass: "customer_dm",
        eventType: "TRANSFER_COMPLETED",
      }),
      "bank",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "bank",
        channelClass: "staff_ops",
        eventType: "BANK_ACCOUNT_FROZEN",
      }),
      "bank",
    );
  });
});

describe("Phase 3 worker isolation (mocked store, no Discord)", () => {
  beforeEach(() => {
    resetDiscordOutboxHealthForTests();
  });

  it("Bank worker never claims Secretary rows", async () => {
    const store = memoryStore([
      makeRow({ id: "s1", targetBot: "secretary", product: "ops" }),
      makeRow({
        id: "b1",
        targetBot: "bank",
        product: "bank",
        eventType: "TRANSFER_COMPLETED",
        displayPayload: {
          kind: "customer_dm",
          userId: "u1",
          title: "Transfer",
          body: "Done",
        },
        channelClass: "customer_dm",
      }),
    ]);

    const bankCalls: string[] = [];
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async (input) => {
        bankCalls.push(`dm:${input.userId}`);
        return { sent: true };
      },
      dispatchStaffAudit: async () => {
        bankCalls.push("staff");
        return { sent: true };
      },
    };

    const result = await processDiscordOutboxForBot("bank", new Date(), deps, store);
    assert.equal(result.processed, 1);
    assert.equal(result.sent, 1);
    assert.deepEqual(bankCalls, ["dm:u1"]);
    assert.ok(!bankCalls.includes("staff"));
  });

  it("Secretary worker never claims Bank or Terminal rows", async () => {
    const store = memoryStore([
      makeRow({ id: "b1", targetBot: "bank", product: "bank" }),
      makeRow({ id: "t1", targetBot: "terminal", product: "terminal" }),
      makeRow({ id: "s1", targetBot: "secretary", product: "ops" }),
    ]);

    const staffContents: string[] = [];
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => {
        throw new Error("Secretary must not DM");
      },
      dispatchStaffAudit: async (content) => {
        staffContents.push(content);
        return { sent: true };
      },
    };

    const result = await processDiscordOutboxForBot("secretary", new Date(), deps, store);
    assert.equal(result.processed, 1);
    assert.equal(result.sent, 1);
    assert.equal(staffContents.length, 1);
  });

  it("concurrent claims: only one worker wins a PENDING row", async () => {
    const row = makeRow({ id: "race-1", targetBot: "secretary" });
    const store = memoryStore([row]);
    let deliveries = 0;
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false }),
      dispatchStaffAudit: async () => {
        deliveries += 1;
        return { sent: true };
      },
    };

    const [a, b] = await Promise.all([
      processDiscordOutboxForBot("secretary", new Date(), deps, store),
      processDiscordOutboxForBot("secretary", new Date(), deps, store),
    ]);

    assert.equal(deliveries, 1);
    assert.equal(a.sent + b.sent, 1);
    assert.equal(a.skipped + b.skipped, 1);
  });

  it("idempotent duplicate delivery deps still finalize once per claim", async () => {
    const store = memoryStore([makeRow({ id: "idem-1", targetBot: "secretary" })]);
    let calls = 0;
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false }),
      dispatchStaffAudit: async () => {
        calls += 1;
        return { sent: true };
      },
    };
    const first = await processDiscordOutboxForBot("secretary", new Date(), deps, store);
    const second = await processDiscordOutboxForBot("secretary", new Date(), deps, store);
    assert.equal(first.sent, 1);
    assert.equal(second.processed, 0);
    assert.equal(calls, 1);
  });

  it("retryable failures requeue; permanent failures dead-letter", async () => {
    const retryRow = makeRow({ id: "retry-1", targetBot: "secretary", attempts: 0, maxAttempts: 5 });
    const deadRow = makeRow({ id: "dead-1", targetBot: "secretary", attempts: 4, maxAttempts: 5 });
    const retryStore = memoryStore([retryRow]);
    const deadStore = memoryStore([deadRow]);
    const failDeps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false }),
      dispatchStaffAudit: async () => ({ sent: false, reason: "channel_not_configured" }),
    };

    const retried = await processDiscordOutboxForBot("secretary", new Date(), failDeps, retryStore);
    assert.equal(retried.requeued, 1);

    const dead = await processDiscordOutboxForBot("secretary", new Date(), failDeps, deadStore);
    assert.equal(dead.dead, 1);
  });

  it("Secretary worker dead-letters customer DM payloads", async () => {
    const store = memoryStore([
      makeRow({
        id: "dm-1",
        targetBot: "secretary",
        channelClass: "customer_dm",
        displayPayload: {
          kind: "customer_dm",
          userId: "u1",
          title: "Secret",
          body: "Should not send",
        },
      }),
    ]);
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => {
        throw new Error("must not deliver customer dm");
      },
      dispatchStaffAudit: async () => {
        throw new Error("must not deliver");
      },
    };
    const result = await processDiscordOutboxForBot("secretary", new Date(), deps, store);
    assert.equal(result.dead, 1);
    assert.equal(secretaryMayDeliverPayload("secretary", {
      kind: "customer_dm",
      userId: "u1",
      title: "x",
      body: "y",
    }).ok, false);
  });

  it("passes channelClass into staff delivery", async () => {
    const classes: Array<string | undefined> = [];
    await deliverDiscordOutboxPayload(
      {
        kind: "staff_audit",
        content: "[WARNING] delivery failed",
        product: "Alta Ops",
      },
      {
        dispatchCustomerDm: async () => ({ sent: false }),
        dispatchStaffAudit: async (_content, options) => {
          classes.push(options?.channelClass);
          return { sent: true };
        },
      },
      { channelClass: "delivery_alert" },
    );
    assert.deepEqual(classes, ["delivery_alert"]);
  });

  it("buildDueOutboxWhere always scopes by targetBot", () => {
    const where = buildDueOutboxWhere("secretary", new Date("2026-01-01T00:00:00Z"));
    assert.equal(where.targetBot, "secretary");
    assert.equal(where.status, "PENDING");
  });
});

describe("Phase 3 Secretary channel routing fail-closed", () => {
  const originalAware = process.env.DISCORD_PRODUCT_AWARE_ROUTING;
  const channelKeys = [
    "DISCORD_STAFF_AUDIT_CHANNEL_ID",
    "DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID",
    "DISCORD_SECURITY_ALERT_CHANNEL_ID",
    "DISCORD_DELIVERY_FAILURE_CHANNEL_ID",
    "DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID",
  ] as const;
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of channelKeys) originals[key] = process.env[key];
  });

  afterEach(() => {
    if (originalAware === undefined) delete process.env.DISCORD_PRODUCT_AWARE_ROUTING;
    else process.env.DISCORD_PRODUCT_AWARE_ROUTING = originalAware;
    for (const key of channelKeys) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  it("missing Secretary staff channel fails closed (no Bank fallback)", () => {
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    delete process.env.DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID;
    process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "bank-channel";
    const route = resolveStaffDiscordChannel({ product: "ops", channelClass: "staff_ops" });
    assert.equal(route.ok, false);
    if (!route.ok) assert.equal(route.reason, "secretary_staff_channel_not_configured");
  });

  it("Secretary dispatch refuses Bank staff channel route key", () => {
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "bank-only";
    delete process.env.DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID;
    // Force product=bank staff_ops which resolves to bank channel — Secretary guard rejects.
    const resolved = resolveSecretaryDispatchChannelForTests({
      product: "bank",
      channelClass: "staff_ops",
    });
    assert.equal(resolved.channelId, null);
  });

  it("uses Secretary-specific channel IDs when configured", () => {
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    process.env.DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID = "sec-staff";
    process.env.DISCORD_DELIVERY_FAILURE_CHANNEL_ID = "sec-delivery";
    process.env.DISCORD_SECURITY_ALERT_CHANNEL_ID = "sec-security";
    process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "bank-staff";

    const staff = resolveStaffDiscordChannel({ product: "corporate", channelClass: "staff_ops" });
    assert.equal(staff.ok, true);
    if (staff.ok) assert.equal(staff.channelId, "sec-staff");

    const delivery = resolveStaffDiscordChannel({
      product: "secretary",
      channelClass: "delivery_alert",
    });
    assert.equal(delivery.ok, true);
    if (delivery.ok) assert.equal(delivery.channelId, "sec-delivery");

    const security = resolveStaffDiscordChannel({
      product: "secretary",
      channelClass: "security_audit",
    });
    assert.equal(security.ok, true);
    if (security.ok) assert.equal(security.channelId, "sec-security");
  });
});

describe("Phase 3 config + privacy + OAuth unchanged", () => {
  it("Secretary bot config is absent without Secretary token (no fake healthy)", () => {
    const prev = process.env.DISCORD_SECRETARY_BOT_TOKEN;
    const prevGuild = process.env.DISCORD_SECRETARY_GUILD_ID;
    try {
      delete process.env.DISCORD_SECRETARY_BOT_TOKEN;
      delete process.env.DISCORD_SECRETARY_GUILD_ID;
      assert.equal(getSecretaryDiscordBotConfig(), null);
    } finally {
      if (prev === undefined) delete process.env.DISCORD_SECRETARY_BOT_TOKEN;
      else process.env.DISCORD_SECRETARY_BOT_TOKEN = prev;
      if (prevGuild === undefined) delete process.env.DISCORD_SECRETARY_GUILD_ID;
      else process.env.DISCORD_SECRETARY_GUILD_ID = prevGuild;
    }
  });

  it("safe payload masking still redacts account numbers", () => {
    const sanitized = sanitizeStaffAuditDetails("From AB-1234-567890 to merchant");
    assert.equal(sanitized, "From AB-1234-**90 to merchant");
  });

  it("unknown events still strict-fail in test mode", () => {
    assert.throws(() => resolveDiscordEventDefinition("TOTALLY_UNKNOWN_EVENT_PHASE3"));
  });
});
