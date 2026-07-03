import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifyDiscordFromAuditLog } from "./audit-log-discord-bridge.ts";
import { formatStaffAuditMessage } from "./staff-audit-format.ts";
import { formatSilentNotificationAuditDetail } from "@/lib/internal/operator-notification-options.ts";

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

  it("skips deal room sync audit rows mirrored via dedicated staff messages", () => {
    assert.doesNotThrow(() => {
      notifyDiscordFromAuditLog({
        actorUserId: "user-1",
        action: "DEAL_ROOM_DISCORD_MESSAGE_SYNCED_TO_WEBSITE",
        entityType: "ALTA_CARD",
        entityId: "app-1",
        targetUserId: "user-1",
        description: "Discord channel message synced to Secure Deal Room.",
        metadata: { source: "DISCORD", messageId: "msg-1" },
      });
    });
  });

  it("includes silent notification in staff audit details", () => {
    const silentDetail = formatSilentNotificationAuditDetail({
      silentNotification: true,
      amount: 5000,
      reason: "Verification hold",
    });
    assert.equal(silentDetail, "Silent — customer not notified");

    const message = formatStaffAuditMessage({
      product: "Alta Bank",
      action: "Account frozen",
      actorLabel: "Carter Townshend",
      details: [
        "ƒ5,000.00",
        "Reason: Verification hold",
        silentDetail,
      ].join(" · "),
      severity: "WARNING",
    });

    assert.match(message, /Silent — customer not notified/);
  });
});
