import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  friendlyFailureReason,
  toCustomerSafePaymentFailureReason,
} from "./customer-payment-failure-reason.ts";
import {
  isMandatoryDiscordNotification,
  paymentEnginePrefKeyForNotificationType,
} from "./notification-pref-rules.ts";
import { parseBankingNotificationPlatformSettings } from "../platform/banking-notification-settings-types.ts";
import {
  assertSilentNotificationAllowed,
  isSilentNotificationForbidden,
} from "../internal/silent-notification-restrictions.ts";

describe("customer payment failure reason mapping", () => {
  it("maps insufficient funds", () => {
    assert.equal(toCustomerSafePaymentFailureReason("Insufficient available balance"), "Insufficient funds.");
  });

  it("maps account restriction", () => {
    assert.equal(
      toCustomerSafePaymentFailureReason("ACCOUNT_RESTRICTED: withdrawals blocked"),
      "The selected account cannot be used right now.",
    );
  });

  it("maps autopay merchant approval", () => {
    assert.equal(
      toCustomerSafePaymentFailureReason("Merchant not approved for AutoPay."),
      "This merchant is not approved for AutoPay.",
    );
  });

  it("maps limit exceeded", () => {
    assert.equal(
      toCustomerSafePaymentFailureReason("Monthly AutoPay limit reached (1 payment per merchant)."),
      "This payment exceeds your monthly AutoPay limit.",
    );
  });

  it("falls back for unknown long errors", () => {
    assert.equal(
      toCustomerSafePaymentFailureReason("prisma error internal stack trace ".repeat(10)),
      "The payment could not be completed.",
    );
  });

  it("exports friendlyFailureReason wrapper", () => {
    assert.equal(friendlyFailureReason(new Error("BAD_REQUEST:Insufficient funds")), "Insufficient funds.");
  });
});

describe("notification preference rules", () => {
  it("marks company verification rejection as mandatory", () => {
    assert.equal(isMandatoryDiscordNotification("COMPANY_VERIFICATION_REJECTED"), true);
    assert.equal(isMandatoryDiscordNotification("COMPANY_VERIFICATION_REVOKED"), true);
    assert.equal(isMandatoryDiscordNotification("ALTA_CARD_FROZEN"), true);
    assert.equal(isMandatoryDiscordNotification("MERCHANT_INVOICE_RECEIVED"), false);
  });

  it("maps payment engine notification types to pref keys", () => {
    assert.equal(paymentEnginePrefKeyForNotificationType("PAYMENT_SCHEDULED_CREATED"), "beforePayment");
    assert.equal(paymentEnginePrefKeyForNotificationType("MERCHANT_INVOICE_AUTOPAID"), "afterPayment");
    assert.equal(paymentEnginePrefKeyForNotificationType("MERCHANT_AUTOPAY_FAILED"), "failedPayment");
    assert.equal(paymentEnginePrefKeyForNotificationType("MERCHANT_AUTOPAY_APPROVAL_PAUSED"), "autopayDisabled");
    assert.equal(paymentEnginePrefKeyForNotificationType("DEPOSIT_SUBMITTED"), null);
  });
});

describe("banking notification platform settings", () => {
  it("defaults large movement threshold to disabled", () => {
    const parsed = parseBankingNotificationPlatformSettings({});
    assert.equal(parsed.largeMoneyMovementDmThreshold, 0);
  });

  it("parses positive threshold", () => {
    const parsed = parseBankingNotificationPlatformSettings({ largeMoneyMovementDmThreshold: 25_000 });
    assert.equal(parsed.largeMoneyMovementDmThreshold, 25_000);
  });
});

describe("silent notification restrictions for company verification", () => {
  it("forbids silent company verification rejection", () => {
    assert.equal(
      isSilentNotificationForbidden({ action: "company_verification_rejection" }, { silentNotification: true }),
      true,
    );
  });

  it("forbids silent company verification revocation", () => {
    assert.equal(
      isSilentNotificationForbidden({ action: "company_verification_revocation" }, { silentNotification: true }),
      true,
    );
  });

  it("rejects silent company verification rejection server-side", () => {
    assert.throws(
      () =>
        assertSilentNotificationAllowed(
          { action: "company_verification_rejection" },
          { silentNotification: true },
        ),
      /Company verification rejections require customer notification/,
    );
  });
});

describe("recurring invoice duplicate DM policy", () => {
  it("documents that auto-sent recurring invoices use invoice received DM only", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../../server/merchant-recurring-invoice.service.ts", import.meta.url), "utf8"),
    );
    assert.equal(source.includes("notifyRecurringInvoiceReceivedBestEffort"), false);
    assert.equal(source.includes("sendMerchantInvoice"), true);
  });
});
