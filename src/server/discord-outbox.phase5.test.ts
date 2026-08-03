import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DiscordOutbox } from "@prisma/client";
import {
  deliverDiscordOutboxPayload,
  processDiscordOutboxForBot,
  staffBotMayDeliverPayload,
  type DiscordOutboxDeliveryDeps,
  type DiscordOutboxWorkerStore,
} from "./discord-outbox.service.ts";

function makeRow(overrides: Partial<DiscordOutbox> & { id: string; targetBot: string }): DiscordOutbox {
  const now = new Date();
  return {
    eventId: "evt-r1",
    idempotencyKey: `key-${overrides.id}`,
    product: "bank",
    eventType: "BANK_CLIENT_ROLE_GRANTED",
    channelClass: "role_mgmt",
    severity: "ACTION",
    correlationId: null,
    actorJson: null,
    subjectJson: null,
    displayPayload: {
      kind: "role_mgmt",
      action: "grant",
      productRole: "bank_client",
      discordUserId: "d1",
      roleId: "role-bank",
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

describe("Phase 5 role outbox isolation", () => {
  it("Bank worker processes bank_client role rows only", async () => {
    const roleCalls: string[] = [];
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false, reason: "no_dm" }),
      dispatchStaffAudit: async () => ({ sent: false, reason: "no_staff" }),
      dispatchRoleMgmt: async (payload) => {
        roleCalls.push(payload.productRole);
        return { sent: true };
      },
    };
    const store = memoryStore([
      makeRow({ id: "r1", targetBot: "bank" }),
      makeRow({
        id: "r2",
        targetBot: "terminal",
        product: "terminal",
        eventType: "TERMINAL_INVESTOR_ROLE_GRANTED",
        displayPayload: {
          kind: "role_mgmt",
          action: "grant",
          productRole: "terminal_investor",
          discordUserId: "d2",
          roleId: "role-term",
        },
      }),
    ]);
    const result = await processDiscordOutboxForBot("bank", new Date(), deps, store);
    assert.equal(result.sent, 1);
    assert.deepEqual(roleCalls, ["bank_client"]);
  });

  it("rejects foreign role payloads for Terminal/Secretary workers", () => {
    assert.equal(
      staffBotMayDeliverPayload("terminal", {
        kind: "role_mgmt",
        action: "grant",
        productRole: "bank_client",
        discordUserId: "d1",
        roleId: "r1",
      }).ok,
      false,
    );
    assert.equal(
      staffBotMayDeliverPayload("secretary", {
        kind: "role_mgmt",
        action: "grant",
        productRole: "terminal_investor",
        discordUserId: "d1",
        roleId: "r1",
      }).ok,
      false,
    );
  });

  it("never treats role_mgmt as customer_dm delivery", async () => {
    let dm = 0;
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => {
        dm += 1;
        return { sent: true };
      },
      dispatchStaffAudit: async () => ({ sent: false }),
      dispatchRoleMgmt: async () => ({ sent: true }),
    };
    const result = await deliverDiscordOutboxPayload(
      {
        kind: "role_mgmt",
        action: "grant",
        productRole: "bank_client",
        discordUserId: "d1",
        roleId: "r1",
      },
      deps,
    );
    assert.equal(result.sent, true);
    assert.equal(dm, 0);
  });

  it("retryable role failure requeues", async () => {
    const deps: DiscordOutboxDeliveryDeps = {
      dispatchCustomerDm: async () => ({ sent: false }),
      dispatchStaffAudit: async () => ({ sent: false }),
      dispatchRoleMgmt: async () => ({ sent: false, reason: "retryable:rate_limited" }),
    };
    const store = memoryStore([makeRow({ id: "retry-r", targetBot: "bank", attempts: 0 })]);
    const result = await processDiscordOutboxForBot("bank", new Date(), deps, store);
    assert.equal(result.requeued, 1);
  });
});
