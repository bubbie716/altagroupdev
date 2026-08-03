/**
 * Phase 8 — exact registry entries for Discord-bound staff audit actions.
 * Sourced from audit-log Discord bridge labels + known sendStaffAuditMessage actions.
 * Prefix-only matching is insufficient for Phase 8 fail-closed routing.
 */

import type {
  DiscordChannelClass,
  DiscordDeliveryPolicy,
  DiscordEventSeverity,
  DiscordProductSource,
  DiscordTargetBot,
} from "@/lib/discord/discord-event-envelope";

type PartialDef = {
  product: DiscordProductSource;
  audience: "customer" | "staff" | "both";
  channelClass: DiscordChannelClass;
  severity: DiscordEventSeverity;
  deliveryPolicy: DiscordDeliveryPolicy;
  ownedByBot?: DiscordTargetBot;
  deliveryBot?: DiscordTargetBot;
  classification?:
    | "customer_notification"
    | "product_staff_audit"
    | "secretary_system_audit"
    | "security_alert"
    | "delivery_failure"
    | "role_management";
};

const STAFF_OPS = {
  audience: "staff" as const,
  channelClass: "staff_ops" as const,
  deliveryPolicy: "queued" as const,
};

/** Bank staff audit actions that must resolve exactly (not prefix-only). */
export const PHASE8_BANK_STAFF_EXACT: ReadonlyArray<{ eventType: string; partial: PartialDef }> = [
  "BANK_ACCOUNT_FROZEN",
  "BANK_ACCOUNT_UNFROZEN",
  "BANK_ACCOUNT_CLOSED",
  "BANK_ACCOUNT_REOPENED",
  "BANK_ACCOUNT_HOLD_PLACED",
  "BANK_ACCOUNT_HOLD_RELEASED",
  "BANK_ACCOUNT_RESTRICTED",
  "BANK_ACCOUNT_UNRESTRICTED",
  "BANK_DEPOSIT_REQUEST_SUBMITTED",
  "BANK_DEPOSIT_REQUEST_FAILED",
  "BANK_WITHDRAWAL_REQUEST_SUBMITTED",
  "BANK_WITHDRAWAL_REQUEST_FAILED",
  "BANK_WITHDRAWAL_APPROVAL_REJECTED",
  "BANK_INTERNAL_TRANSFER_COMPLETED",
  "BANK_INTERNAL_TRANSFER_FAILED",
  "BANK_PAYMENT_BLOCKED",
  "BANK_PAYMENT_REVERSED",
  "BANK_REVERSAL_POSTED",
  "BANK_PAYROLL_RUN_EXECUTED",
  "BANK_PAYROLL_RUN_FAILED",
  "BANK_SCHEDULED_TRANSFER_CREATED",
  "BANK_SCHEDULED_TRANSFER_CANCELLED",
  "BANK_SCHEDULED_TRANSFER_EXECUTED",
  "BANK_SCHEDULED_TRANSFER_FAILED",
  "BANK_BALANCE_RECONCILIATION_MISMATCH",
  "ACCOUNT_STATUS_CHANGED",
  "ALTA_PAY_REVERSAL_REJECTED",
  "DISCORD_TRANSFER_CONVENIENCE_FEE",
].map((eventType) => ({
  eventType,
  partial: { product: "bank", ...STAFF_OPS, severity: "INFO" as const },
}));

export const PHASE8_CARD_STAFF_EXACT: ReadonlyArray<{ eventType: string; partial: PartialDef }> = [
  "ALTA_CARD_OPENED",
  "ALTA_CARD_STATUS_CHANGED",
  "ALTA_CARD_LIMIT_CHANGED",
  "ALTA_CARD_LIMIT_UPDATED",
  "ALTA_CARD_RATE_CHANGED",
  "ALTA_CARD_RATE_UPDATED",
  "ALTA_CARD_TIER_CHANGED",
  "ALTA_CARD_TIER_UPDATED",
  "ALTA_CARD_FEE_CHARGED",
  "ALTA_CARD_FEE_WAIVED",
  "ALTA_CARD_INTEREST_APPLIED",
  "ALTA_CARD_INTEREST_BATCH_APPLIED",
  "ALTA_CARD_AUTOPAY_RUN",
  "ALTA_CARD_STATEMENT_PAID",
  "ALTA_CARD_APPLICATION_CREATED",
  "ALTA_CARD_APPLICATION_STATUS_CHANGED",
  "ALTA_CARD_APPLICATION_THREAD_REOPENED",
  "ALTA_CARD_REVIEW_REQUEST_CREATED",
  "ALTA_CARD_REVIEW_DENIED",
  "ALTA_CARD_REVIEW_CANCELLED",
  "ALTA_CARD_REVIEW_THREAD_REOPENED",
  "ALTA_CARD_EMPLOYEE_CARD_UPDATED",
  "ALTA_EMPLOYEE_CARD_CREATED",
  "ALTA_EMPLOYEE_CARD_LIMIT_CHANGED",
].map((eventType) => ({
  eventType,
  partial: { product: "bank", ...STAFF_OPS, severity: "INFO" as const },
}));

export const PHASE8_TERMINAL_STAFF_EXACT: ReadonlyArray<{ eventType: string; partial: PartialDef }> = [
  "TERMINAL_PORTFOLIO_ARCHIVED",
  "TERMINAL_PORTFOLIO_STATUS_CHANGED",
  "TERMINAL_ORDER_SUBMITTED",
  "TERMINAL_ORDER_FILLED",
  "TERMINAL_ORDER_REJECTED",
  "TERMINAL_ORDER_FAILED",
  "TERMINAL_CRYPTO_STATUS_HALTED",
  "TERMINAL_CRYPTO_STATUS_RESUMED",
  "TERMINAL_CRYPTO_CONTRIBUTION_RECORDED",
  "TERMINAL_SCHEDULED_TRADE_PAUSED",
  "TERMINAL_SCHEDULED_TRADE_RESUMED",
  "TERMINAL_SCHEDULED_TRADE_CANCELLED",
  "TERMINAL_SCHEDULED_TRADE_COMPLETED",
  "TERMINAL_SCHEDULED_TRADE_ENDED",
  "TERMINAL_SCHEDULED_TRADE_ORDER_SUBMITTED",
  "TERMINAL_SCHEDULED_TRADE_ATTEMPT_FAILED",
  "TERMINAL_INVESTOR_PENDING_INELIGIBLE_RECONCILE",
].map((eventType) => ({
  eventType,
  partial: { product: "terminal", ...STAFF_OPS, severity: "INFO" as const },
}));

export const PHASE8_OPS_STAFF_EXACT: ReadonlyArray<{ eventType: string; partial: PartialDef }> = [
  "OPS_JOB_SUCCEEDED",
  "OPS_QUEUE_ESCALATED",
  "OPS_BULK_ACTION",
  "BULK_DEPOSITS_APPROVED",
  "BULK_DEPOSITS_DENIED",
  "BULK_WITHDRAWALS_DENIED",
  "ADMIN_MANUAL_TRANSFER",
  "ADMIN_LOAN_PAYMENT_RECORDED",
  "MAINTENANCE_MODE_ENABLED",
  "MAINTENANCE_MODE_DISABLED",
  "CREDIT_DESK_NOTE_ADDED",
  "USER_TAG_UPDATED",
  "USER_ACCOUNT_STATUS_CHANGED",
  "ONBOARDING_ELIGIBILITY_CONFIRMED",
  "ONBOARDING_CORE_COMPLETED",
  "ONBOARDING_CORE_LEGAL_ACCEPTED",
  "BANK_TERMS_ACCEPTED",
  "TERMINAL_TERMS_ACCEPTED",
  "ALTA_PAY_TERMS_ACCEPTED",
  "COMMERCIAL_TERMS_ACCEPTED",
  "PRODUCT_CONSENT_REACCEPTED",
  "MINECRAFT_VERIFICATION_COMPLETED",
  "MINECRAFT_VERIFICATION_RESET",
  "MINECRAFT_REVERIFICATION_REQUIRED",
].map((eventType) => ({
  eventType,
  partial: {
    product: "ops" as const,
    ...STAFF_OPS,
    severity: "INFO" as const,
    ownedByBot: "secretary" as const,
  },
}));

export const PHASE8_CORPORATE_STAFF_EXACT: ReadonlyArray<{ eventType: string; partial: PartialDef }> = [
  "COMPANY_MEMBER_ADDED",
  "COMPANY_MEMBER_REMOVED",
  "COMPANY_MEMBER_ROLE_CHANGED",
  "COMPANY_CREATED",
  "COMPANY_UPDATED",
  "COMPANY_VERIFICATION_SUBMITTED",
].map((eventType) => ({
  eventType,
  partial: {
    product: "corporate" as const,
    ...STAFF_OPS,
    severity: "INFO" as const,
    ownedByBot: "secretary" as const,
  },
}));

export const ALL_PHASE8_STAFF_EXACT = [
  ...PHASE8_BANK_STAFF_EXACT,
  ...PHASE8_CARD_STAFF_EXACT,
  ...PHASE8_TERMINAL_STAFF_EXACT,
  ...PHASE8_OPS_STAFF_EXACT,
  ...PHASE8_CORPORATE_STAFF_EXACT,
] as const;
