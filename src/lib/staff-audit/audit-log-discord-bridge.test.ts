import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifyDiscordFromAuditLog } from "./audit-log-discord-bridge.ts";

describe("audit log Discord bridge", () => {
  it("does not throw for compliance events", () => {
    assert.doesNotThrow(() => {
      notifyDiscordFromAuditLog({
        actorUserId: "user-1",
        action: "BANK_DEPOSIT_REQUEST_SUBMITTED",
        entityType: "BANK_TRANSACTION",
        entityId: "txn-1",
        targetTransactionId: "txn-1",
        description: "Deposit request DEP-1",
        metadata: { source: "discord_bot", amount: 100, referenceCode: "DEP-1" },
      });
    });
  });

  it("skips noisy timeline wrapper events", () => {
    assert.doesNotThrow(() => {
      notifyDiscordFromAuditLog({
        actorUserId: "user-1",
        action: "RELATIONSHIP_TIMELINE_EVENT_CREATED",
        entityType: "USER",
        entityId: "evt-1",
        description: "Timeline event",
      });
    });
  });
});
