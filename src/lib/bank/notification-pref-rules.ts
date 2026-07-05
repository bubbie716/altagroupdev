import type { UserNotificationType } from "@prisma/client";
import type { PaymentEngineNotificationPrefKey } from "@/lib/bank/payments-engine-types";

/** User prefs cannot suppress these notification types. */
export const MANDATORY_DISCORD_NOTIFICATION_TYPES = new Set<UserNotificationType>([
  "COMPANY_VERIFICATION_REJECTED",
  "COMPANY_VERIFICATION_REVOKED",
  "ALTA_CARD_FROZEN",
]);

export function isMandatoryDiscordNotification(type: UserNotificationType): boolean {
  return MANDATORY_DISCORD_NOTIFICATION_TYPES.has(type);
}

/** Maps payment-engine UserNotificationType values to stored pref keys. */
export const PAYMENT_ENGINE_PREF_BY_NOTIFICATION_TYPE: Partial<
  Record<UserNotificationType, PaymentEngineNotificationPrefKey>
> = {
  PAYMENT_SCHEDULED_CREATED: "beforePayment",
  PAYMENT_RECURRING_CREATED: "beforePayment",
  MERCHANT_AUTOPAY_CONFIRMATION_REQUIRED: "beforePayment",
  PAYMENT_SCHEDULED_EXECUTED: "afterPayment",
  PAYMENT_RECURRING_EXECUTED: "afterPayment",
  MERCHANT_INVOICE_AUTOPAID: "afterPayment",
  PAYMENT_SCHEDULED_FAILED: "failedPayment",
  PAYMENT_RECURRING_FAILED: "failedPayment",
  PAYMENT_RETRY_FAILED: "failedPayment",
  PAYMENT_RETRY_FINAL_FAILED: "failedPayment",
  MERCHANT_AUTOPAY_FAILED: "failedPayment",
  MERCHANT_RECURRING_INVOICE_RECEIVED: "newRecurringInvoice",
  MERCHANT_AUTOPAY_APPROVAL_PAUSED: "autopayDisabled",
  MERCHANT_AUTOPAY_APPROVAL_CANCELLED: "autopayDisabled",
  MERCHANT_AUTOPAY_APPROVAL_UPDATED: "autopayDisabled",
  MERCHANT_AUTOPAY_APPROVAL_CREATED: "autopayDisabled",
};

export function paymentEnginePrefKeyForNotificationType(
  type: UserNotificationType,
): PaymentEngineNotificationPrefKey | null {
  return PAYMENT_ENGINE_PREF_BY_NOTIFICATION_TYPE[type] ?? null;
}
