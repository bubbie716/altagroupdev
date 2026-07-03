import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildOperatorCustomerNotificationCopy,
  classifyAdjustmentKind,
  formatAccountEndingSuffix,
} from "./customer-operator-notification-copy.ts";
import { detectRestrictionNotificationKinds } from "./account-restriction-notification.ts";
import { sendCustomerOperatorDiscordNotification } from "@/server/customer-operator-notification.service.ts";
import { notifyDiscordFromAuditLog } from "@/lib/staff-audit/audit-log-discord-bridge.ts";

describe("customer operator notification copy", () => {
  it("formats manual credit with account suffix and generic explanation", () => {
    const copy = buildOperatorCustomerNotificationCopy({
      kind: "manual_credit",
      accountNumber: "AB-2000-123482",
      amount: 5000,
    });

    assert.equal(copy.title, "Manual Credit Posted");
    assert.match(copy.body, /manual credit of ƒ5,000\.00/);
    assert.match(copy.body, /ending in 3482/);
    assert.match(copy.body, /This action was completed by Alta Bank\./);
    assert.doesNotMatch(copy.body, /internal/i);
  });

  it("includes customer-facing reason when provided", () => {
    const copy = buildOperatorCustomerNotificationCopy({
      kind: "account_frozen",
      accountNumber: "AB-2000-0004821",
      customerFacingReason: "Additional verification is required.",
    });

    assert.match(copy.body, /Reason:/);
    assert.match(copy.body, /Additional verification is required\./);
    assert.doesNotMatch(copy.body, /This action was completed by Alta Bank\./);
  });

  it("never includes internal staff notes in copy builder input", () => {
    const copy = buildOperatorCustomerNotificationCopy({
      kind: "account_hold_placed",
      accountNumber: "AB-2000-999900",
      amount: 10000,
      customerFacingReason: null,
    });

    assert.doesNotMatch(copy.body, /fraud/i);
    assert.doesNotMatch(copy.body, /staff/i);
    assert.match(copy.body, /Hold Placed|hold has been placed/i);
  });

  it("classifies adjustment kinds from customer descriptions", () => {
    assert.equal(classifyAdjustmentKind("Credit Adjustment · Bonus", "credit"), "manual_credit");
    assert.equal(classifyAdjustmentKind("Debit Adjustment · Recovery", "debit"), "manual_debit");
    assert.equal(classifyAdjustmentKind("Reversal · Credit Adjustment · Bonus", "credit"), "reversal_posted");
    assert.equal(classifyAdjustmentKind("Late Fee · Statement", "debit"), "fee_posted");
    assert.equal(classifyAdjustmentKind("Balance Correction · Entry fix", "credit"), "correction_posted");
  });

  it("extracts account ending suffix from Alta account numbers", () => {
    assert.equal(formatAccountEndingSuffix("AB-2000-123482"), "3482");
  });

  it("detects restriction and withdrawal hold notification kinds", () => {
    const kinds = detectRestrictionNotificationKinds(
      { restrictDeposits: false, restrictWithdrawals: false, restrictTransfers: false },
      { restrictDeposits: true, restrictWithdrawals: true, restrictTransfers: false },
    );
    assert.deepEqual(kinds.sort(), ["account_restricted", "withdrawal_hold_placed"].sort());
  });
});

describe("customer operator Discord delivery", () => {
  const originalBotToken = process.env.DISCORD_BOT_TOKEN;
  const originalBotSecret = process.env.BOT_API_SECRET;

  beforeEach(() => {
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.BOT_API_SECRET;
  });

  afterEach(() => {
    if (originalBotToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = originalBotToken;
    if (originalBotSecret === undefined) delete process.env.BOT_API_SECRET;
    else process.env.BOT_API_SECRET = originalBotSecret;
  });

  it("does not throw when Discord is not configured", async () => {
    const result = await sendCustomerOperatorDiscordNotification({
      userId: "missing-discord-user",
      title: "Manual Credit Posted",
      body: "A manual credit was posted.",
      linkUrl: "/bank/accounts/acc-1",
    });
    assert.equal(result.sent, false);
  });

  it("does not throw when user has no Discord ID", async () => {
    const result = await sendCustomerOperatorDiscordNotification({
      userId: "user-without-discord",
      title: "Account Frozen",
      body: "Your account has been frozen.",
      linkUrl: "/bank/accounts/acc-2",
    });
    assert.equal(result.sent, false);
  });
});

describe("staff audit bridge for operator bank actions", () => {
  it("does not throw for granular bank operator audit events", () => {
    assert.doesNotThrow(() => {
      notifyDiscordFromAuditLog({
        actorUserId: "staff-1",
        action: "BANK_ACCOUNT_FROZEN",
        entityType: "BANK_ACCOUNT",
        entityId: "acc-1",
        targetAccountId: "acc-1",
        targetUserId: "cust-1",
        description: "Froze account AB-2000-123482",
        metadata: { source: "website", status: "FROZEN" },
      });
    });
  });

  it("does not throw for manual credit posted audit events", () => {
    assert.doesNotThrow(() => {
      notifyDiscordFromAuditLog({
        actorUserId: "staff-1",
        action: "BANK_MANUAL_CREDIT_POSTED",
        entityType: "BANK_TRANSACTION",
        entityId: "txn-1",
        targetAccountId: "acc-1",
        targetUserId: "cust-1",
        description: "Credited AB-2000-123482 by ƒ5000",
        metadata: { source: "website", amount: 5000 },
      });
    });
  });
});
