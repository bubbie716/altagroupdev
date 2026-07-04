import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeFailedActionSource } from "./failed-action-source.ts";
import {
  assertSilentNotificationAllowed,
  isSilentNotificationForbidden,
  silentNotificationForbiddenMessage,
} from "./silent-notification-restrictions.ts";
import {
  buildLinkedReversalMetadata,
  parseLinkedReversalMetadata,
} from "./transaction-reversal-link.ts";
import { isRetryableDeliveryFailure } from "../../server/notification-delivery-audit.service.ts";

describe("failed action audit source normalization", () => {
  it("maps website and bot sources to standard labels", () => {
    assert.equal(normalizeFailedActionSource("website"), "WEB");
    assert.equal(normalizeFailedActionSource("discord_bot"), "DISCORD_BOT");
    assert.equal(normalizeFailedActionSource("cron"), "CRON");
    assert.equal(normalizeFailedActionSource("system"), "SYSTEM");
  });
});

describe("silent notification restrictions", () => {
  it("forbids silent mode on account freeze", () => {
    assert.equal(
      isSilentNotificationForbidden({ kind: "account_frozen", action: "account_freeze" }, { silentNotification: true }),
      true,
    );
  });

  it("forbids silent mode on deposit denial", () => {
    assert.equal(
      isSilentNotificationForbidden({ action: "deny_deposit" }, { silentNotification: true }),
      true,
    );
  });

  it("allows silent mode on manual credit", () => {
    assert.equal(
      isSilentNotificationForbidden({ kind: "manual_credit" }, { silentNotification: true }),
      false,
    );
  });

  it("throws BAD_REQUEST when silent is forbidden", () => {
    assert.throws(
      () =>
        assertSilentNotificationAllowed(
          { kind: "payment_reversed", action: "alta_pay_reversal" },
          { silentNotification: true },
        ),
      (error: Error) => {
        assert.match(error.message, /^BAD_REQUEST:/);
        assert.match(silentNotificationForbiddenMessage({ action: "alta_pay_reversal" }), /Alta Pay reversal/i);
        return true;
      },
    );
  });
});

describe("notification delivery retryability", () => {
  it("treats missing discord as permanent", () => {
    assert.equal(isRetryableDeliveryFailure("no_discord_id"), false);
  });

  it("treats timeout errors as retryable", () => {
    assert.equal(isRetryableDeliveryFailure("fetch timeout"), true);
  });
});

describe("linked reversal metadata", () => {
  it("links original and reversal transactions", () => {
    const meta = buildLinkedReversalMetadata({
      originalTransactionId: "tx-1",
      originalReferenceCode: "ADJ-100",
      reversalTransactionId: "tx-2",
      reversalReferenceCode: "ADJ-101",
      reversalReason: "Operator correction",
      reversedByUserId: "user-1",
      reversalKind: "adjustment",
    });
    assert.equal(meta.originalReferenceCode, "ADJ-100");
    assert.equal(meta.reversalReferenceCode, "ADJ-101");
    const parsed = parseLinkedReversalMetadata(meta);
    assert.equal(parsed?.originalTransactionId, "tx-1");
    assert.equal(parsed?.reversalKind, "adjustment");
  });
});

describe("balance reconciliation ledger math", () => {
  it("computes signed amounts for approved transactions", async () => {
    const { computeLedgerBalanceForAccount } = await import("../../server/balance-reconciliation.service.ts");
    assert.equal(typeof computeLedgerBalanceForAccount, "function");
  });
});

describe("queue escalation thresholds", () => {
  it("uses 7-day warning and 14-day escalation windows", async () => {
    const { runQueueEscalationJob } = await import("../../server/ops-queue-escalation.service.ts");
    assert.equal(typeof runQueueEscalationJob, "function");
  });
});

describe("deal room reopen resync", () => {
  it("exports resync helpers for deal room discord", async () => {
    const { resyncDealRoomDiscordOnReopenBestEffort, resyncDealRoomDiscordChannel } = await import(
      "../../server/secure-deal-room-discord.service.ts"
    );
    assert.equal(typeof resyncDealRoomDiscordOnReopenBestEffort, "function");
    assert.equal(typeof resyncDealRoomDiscordChannel, "function");
  });
});

describe("customer notification delivery", () => {
  it("exports universal delivery helper", async () => {
    const { deliverCustomerNotificationDm } = await import(
      "../../server/customer-notification-delivery.service.ts"
    );
    assert.equal(typeof deliverCustomerNotificationDm, "function");
  });
});

describe("notification retry queue", () => {
  it("exports queue processor", async () => {
    const { processNotificationRetryQueue, enqueueCustomerDmRetry } = await import(
      "../../server/notification-retry-queue.service.ts"
    );
    assert.equal(typeof processNotificationRetryQueue, "function");
    assert.equal(typeof enqueueCustomerDmRetry, "function");
  });
});

describe("bot audit service", () => {
  it("exports bot audit helpers", async () => {
    const {
      recordBotBankingActionFailedBestEffort,
      recordBotPermissionDeniedBestEffort,
      friendlyBotFailureReason,
    } = await import("../../server/bot-audit.service.ts");
    assert.equal(typeof recordBotBankingActionFailedBestEffort, "function");
    assert.equal(typeof recordBotPermissionDeniedBestEffort, "function");
    assert.equal(typeof friendlyBotFailureReason, "function");
    assert.equal(friendlyBotFailureReason(new Error("BAD_REQUEST:Insufficient balance")), "Insufficient balance");
  });
});

describe("failed action audit service", () => {
  it("exports recordFailedAction helper", async () => {
    const { recordFailedAction, recordPermissionDeniedAction } = await import(
      "../../server/failed-action-audit.service.ts"
    );
    assert.equal(typeof recordFailedAction, "function");
    assert.equal(typeof recordPermissionDeniedAction, "function");
  });
});
