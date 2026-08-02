import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { DiscordOutbox } from "@prisma/client";
import {
  isDiscordTerminalDeliveryEnabled,
  resolveOutboxTargetBot,
} from "@/lib/discord/discord-event-envelope.ts";
import {
  UnknownDiscordEventError,
  resolveDiscordEventDefinition,
} from "@/lib/discord/discord-event-registry.ts";
import { resolveStaffDiscordChannel } from "@/lib/discord/discord-channel-routing.ts";
import {
  buildDueOutboxWhere,
  processDiscordOutboxForBot,
  terminalMayDeliverPayload,
  type DiscordOutboxDeliveryDeps,
  type DiscordOutboxWorkerStore,
} from "./discord-outbox.service.ts";
import {
  resolveTerminalDispatchChannelForTests,
} from "./terminal-discord-dispatch.service.ts";

function makeRow(overrides: Partial<DiscordOutbox> & { id: string; targetBot: string }): DiscordOutbox {
  const now = new Date();
  return {
    eventId: "evt-t1",
    idempotencyKey: `key-${overrides.id}`,
    product: "terminal",
    eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
    channelClass: "staff_ops",
    severity: "INFO",
    correlationId: null,
    actorJson: null,
    subjectJson: null,
    displayPayload: {
      kind: "staff_audit",
      content: "Terminal fee config updated",
      product: "Alta Terminal",
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
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
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

const okDeps: DiscordOutboxDeliveryDeps = {
  dispatchCustomerDm: async () => ({ sent: true }),
  dispatchStaffAudit: async () => ({ sent: true }),
};

describe("Phase 4 Terminal routing", () => {
  const keys = [
    "DISCORD_TERMINAL_DELIVERY",
    "DISCORD_SECRETARY_DELIVERY",
    "DISCORD_PRODUCT_AWARE_ROUTING",
    "DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID",
    "DISCORD_STRICT_EVENT_REGISTRY",
  ] as const;
  const original: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key]!;
    }
  });

  function snap(): void {
    for (const key of keys) original[key] = process.env[key];
  }

  it("routes Terminal staff to terminal when DISCORD_TERMINAL_DELIVERY is on", () => {
    snap();
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    assert.equal(isDiscordTerminalDeliveryEnabled(), true);
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      }),
      "terminal",
    );
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED").deliveryBot, "terminal");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED").ownedByBot, "terminal");
  });

  it("keeps Terminal staff on Bank legacy path when Terminal delivery is off", () => {
    snap();
    delete process.env.DISCORD_TERMINAL_DELIVERY;
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      }),
      "bank",
    );
  });

  it("fail-closes missing Terminal staff channel (no Bank fallback)", () => {
    snap();
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    delete process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID;
    const route = resolveStaffDiscordChannel({ product: "terminal", channelClass: "staff_ops" });
    assert.equal(route.ok, false);
    if (!route.ok) assert.equal(route.reason, "terminal_staff_channel_not_configured");

    const dispatch = resolveTerminalDispatchChannelForTests({
      product: "terminal",
      channelClass: "staff_ops",
    });
    assert.equal(dispatch.channelId, null);
    assert.equal(dispatch.reason, "terminal_staff_channel_not_configured");
  });

  it("does not fall back to Bank when Terminal delivery is enabled and misconfigured", () => {
    snap();
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    delete process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID;
    // Targeting still records terminal — delivery fails closed at dispatch.
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_RECON_CRITICAL",
      }),
      "terminal",
    );
    assert.notEqual(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_RECON_CRITICAL",
      }),
      "bank",
    );
  });

  it("never routes Secretary events to Terminal", () => {
    snap();
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "ops",
        channelClass: "staff_ops",
        eventType: "OPS_JOB_FAILED",
      }),
      "secretary",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "secretary",
        channelClass: "delivery_alert",
        eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      }),
      "secretary",
    );
  });

  it("never routes customer DMs to Terminal", () => {
    snap();
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "customer_dm",
        eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      }),
      "bank",
    );
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_ORDER_FILLED").deliveryBot, "bank");
  });

  it("unknown event types still strict-fail", () => {
    snap();
    process.env.DISCORD_STRICT_EVENT_REGISTRY = "1";
    assert.throws(
      () => resolveDiscordEventDefinition("TOTALLY_UNKNOWN_PHASE4_EVENT"),
      UnknownDiscordEventError,
    );
  });
});

describe("Phase 4 Terminal worker isolation", () => {
  it("Bank cannot claim Terminal rows", async () => {
    const store = memoryStore([
      makeRow({ id: "t1", targetBot: "terminal" }),
      makeRow({ id: "b1", targetBot: "bank", product: "bank" }),
    ]);
    const result = await processDiscordOutboxForBot("bank", new Date(), okDeps, store);
    assert.equal(result.processed, 1);
    assert.equal(result.sent, 1);
  });

  it("Secretary cannot claim Terminal rows", async () => {
    const store = memoryStore([
      makeRow({ id: "t1", targetBot: "terminal" }),
      makeRow({ id: "s1", targetBot: "secretary", product: "ops" }),
    ]);
    const result = await processDiscordOutboxForBot("secretary", new Date(), okDeps, store);
    assert.equal(result.processed, 1);
    assert.equal(result.targetBot, "secretary");
  });

  it("Terminal cannot claim Bank/Secretary rows", async () => {
    const store = memoryStore([
      makeRow({ id: "b1", targetBot: "bank", product: "bank" }),
      makeRow({ id: "s1", targetBot: "secretary", product: "ops" }),
      makeRow({ id: "t1", targetBot: "terminal" }),
    ]);
    const result = await processDiscordOutboxForBot("terminal", new Date(), okDeps, store);
    assert.equal(result.processed, 1);
    assert.equal(result.sent, 1);
    assert.equal(result.targetBot, "terminal");
  });

  it("concurrent claim allows only one worker", async () => {
    const row = makeRow({ id: "race-t", targetBot: "terminal" });
    const store = memoryStore([row]);
    const [a, b] = await Promise.all([
      processDiscordOutboxForBot("terminal", new Date(), okDeps, store),
      processDiscordOutboxForBot("terminal", new Date(), okDeps, store),
    ]);
    assert.equal(a.sent + b.sent, 1);
    assert.equal(a.skipped + b.skipped, 1);
  });

  it("retryable failure requeues; permanent failure dead-letters", async () => {
    const failDeps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false, reason: "fail" }),
      dispatchStaffAudit: async () => ({ sent: false, reason: "fail" }),
    };
    const retryStore = memoryStore([
      makeRow({ id: "retry-t", targetBot: "terminal", attempts: 0, maxAttempts: 5 }),
    ]);
    const deadStore = memoryStore([
      makeRow({ id: "dead-t", targetBot: "terminal", attempts: 4, maxAttempts: 5 }),
    ]);
    const retried = await processDiscordOutboxForBot("terminal", new Date(), failDeps, retryStore);
    assert.equal(retried.requeued, 1);
    const dead = await processDiscordOutboxForBot("terminal", new Date(), failDeps, deadStore);
    assert.equal(dead.dead, 1);
  });

  it("Terminal customer-DM payload is rejected/dead-lettered", async () => {
    const store = memoryStore([
      makeRow({
        id: "dm-t",
        targetBot: "terminal",
        channelClass: "customer_dm",
        displayPayload: {
          kind: "customer_dm",
          userId: "u1",
          title: "Filled",
          body: "Order filled",
        },
      }),
    ]);
    const result = await processDiscordOutboxForBot("terminal", new Date(), okDeps, store);
    assert.equal(result.dead, 1);
    assert.equal(
      terminalMayDeliverPayload("terminal", {
        kind: "customer_dm",
        userId: "u1",
        title: "x",
        body: "y",
      }).ok,
      false,
    );
  });

  it("idempotent redelivery remains safe", async () => {
    const store = memoryStore([makeRow({ id: "idem-t", targetBot: "terminal" })]);
    const first = await processDiscordOutboxForBot("terminal", new Date(), okDeps, store);
    const second = await processDiscordOutboxForBot("terminal", new Date(), okDeps, store);
    assert.equal(first.sent, 1);
    assert.equal(second.processed, 0);
  });

  it("buildDueOutboxWhere always scopes by targetBot", () => {
    const where = buildDueOutboxWhere("terminal", new Date());
    assert.equal(where.targetBot, "terminal");
  });
});
