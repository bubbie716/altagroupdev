import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuditDiscordDisabled,
  notifyDiscordFromAuditLog,
} from "./audit-log-discord-bridge.ts";
import { formatStaffAuditMessage } from "./staff-audit-format.ts";
import { formatSilentNotificationAuditDetail } from "@/lib/internal/operator-notification-options.ts";

describe("audit log Discord bridge", () => {
  it("does not throw for compliance events", () => {
    const prevStaff = process.env.STAFF_AUDIT_DISCORD_DISABLED;
    try {
      process.env.STAFF_AUDIT_DISCORD_DISABLED = "1";
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
    } finally {
      if (prevStaff === undefined) delete process.env.STAFF_AUDIT_DISCORD_DISABLED;
      else process.env.STAFF_AUDIT_DISCORD_DISABLED = prevStaff;
    }
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

  it("disables Discord delivery when UI Lab mode env is on", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVitest = process.env.VITEST;
    const prevStaff = process.env.STAFF_AUDIT_DISCORD_DISABLED;
    const prevUiLab = process.env.VITE_UI_LAB_MODE;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.VITEST;
      delete process.env.STAFF_AUDIT_DISCORD_DISABLED;
      process.env.VITE_UI_LAB_MODE = "true";
      assert.equal(isAuditDiscordDisabled(), true);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevVitest === undefined) delete process.env.VITEST;
      else process.env.VITEST = prevVitest;
      if (prevStaff === undefined) delete process.env.STAFF_AUDIT_DISCORD_DISABLED;
      else process.env.STAFF_AUDIT_DISCORD_DISABLED = prevStaff;
      if (prevUiLab === undefined) delete process.env.VITE_UI_LAB_MODE;
      else process.env.VITE_UI_LAB_MODE = prevUiLab;
    }
  });

  it("notifyDiscordFromAuditLog returns early when Discord is disabled", () => {
    const prevStaff = process.env.STAFF_AUDIT_DISCORD_DISABLED;
    try {
      process.env.STAFF_AUDIT_DISCORD_DISABLED = "1";
      assert.equal(isAuditDiscordDisabled(), true);
      assert.doesNotThrow(() => {
        notifyDiscordFromAuditLog({
          actorUserId: "user-1",
          action: "BANK_DEPOSIT_REQUEST_SUBMITTED",
          entityType: "BANK_TRANSACTION",
          entityId: "txn-early-return",
          description: "Must no-op while Discord is disabled",
          metadata: { amount: 1 },
        });
      });
    } finally {
      if (prevStaff === undefined) delete process.env.STAFF_AUDIT_DISCORD_DISABLED;
      else process.env.STAFF_AUDIT_DISCORD_DISABLED = prevStaff;
    }
  });
});
