import type { PaymentFrequencyCode } from "@/lib/bank/business-banking-types";

export const PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS = {
  maxScheduledPaymentFutureDays: "paymentsEngine.maxScheduledPaymentFutureDays",
  allowedRecurringIntervals: "paymentsEngine.allowedRecurringIntervals",
  defaultRetryCount: "paymentsEngine.defaultRetryCount",
  defaultRetryDelayMinutes: "paymentsEngine.defaultRetryDelayMinutes",
  defaultAutopayMaxInvoiceAmount: "paymentsEngine.defaultAutopayMaxInvoiceAmount",
  defaultMerchantApprovalExpiryDays: "paymentsEngine.defaultMerchantApprovalExpiryDays",
  recurringInvoicesRequirePro: "paymentsEngine.recurringInvoicesRequirePro",
  maxFailedAttemptsBeforeDisableSchedule: "paymentsEngine.maxFailedAttemptsBeforeDisableSchedule",
} as const;

export type PaymentsEnginePlatformSettings = {
  maxScheduledPaymentFutureDays: number;
  allowedRecurringIntervals: PaymentFrequencyCode[];
  defaultRetryCount: number;
  defaultRetryDelayMinutes: number;
  defaultAutopayMaxInvoiceAmount: number;
  defaultMerchantApprovalExpiryDays: number;
  recurringInvoicesRequirePro: boolean;
  maxFailedAttemptsBeforeDisableSchedule: number;
};

export const DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS: PaymentsEnginePlatformSettings = {
  maxScheduledPaymentFutureDays: 365,
  allowedRecurringIntervals: ["weekly", "biweekly", "monthly", "quarterly", "yearly"],
  defaultRetryCount: 3,
  defaultRetryDelayMinutes: 60,
  defaultAutopayMaxInvoiceAmount: 50_000,
  defaultMerchantApprovalExpiryDays: 365,
  recurringInvoicesRequirePro: true,
  maxFailedAttemptsBeforeDisableSchedule: 3,
};

export function parsePaymentsEnginePlatformSettings(
  input: Partial<PaymentsEnginePlatformSettings>,
): PaymentsEnginePlatformSettings {
  const defaults = DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS;
  return {
    maxScheduledPaymentFutureDays:
      input.maxScheduledPaymentFutureDays ?? defaults.maxScheduledPaymentFutureDays,
    allowedRecurringIntervals:
      input.allowedRecurringIntervals ?? defaults.allowedRecurringIntervals,
    defaultRetryCount: input.defaultRetryCount ?? defaults.defaultRetryCount,
    defaultRetryDelayMinutes: input.defaultRetryDelayMinutes ?? defaults.defaultRetryDelayMinutes,
    defaultAutopayMaxInvoiceAmount:
      input.defaultAutopayMaxInvoiceAmount ?? defaults.defaultAutopayMaxInvoiceAmount,
    defaultMerchantApprovalExpiryDays:
      input.defaultMerchantApprovalExpiryDays ?? defaults.defaultMerchantApprovalExpiryDays,
    recurringInvoicesRequirePro:
      input.recurringInvoicesRequirePro ?? defaults.recurringInvoicesRequirePro,
    maxFailedAttemptsBeforeDisableSchedule:
      input.maxFailedAttemptsBeforeDisableSchedule ?? defaults.maxFailedAttemptsBeforeDisableSchedule,
  };
}
