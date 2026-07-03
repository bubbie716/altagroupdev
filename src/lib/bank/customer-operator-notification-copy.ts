import { formatFlorin } from "@/lib/bank/format";

export type OperatorCustomerNotificationKind =
  | "manual_credit"
  | "manual_debit"
  | "fee_posted"
  | "reversal_posted"
  | "correction_posted"
  | "account_frozen"
  | "account_unfrozen"
  | "account_restricted"
  | "restriction_removed"
  | "account_hold_placed"
  | "account_hold_released"
  | "withdrawal_hold_placed"
  | "withdrawal_hold_released"
  | "account_closed"
  | "account_reopened"
  | "transaction_under_review"
  | "transaction_released"
  | "payment_blocked"
  | "payment_reversed";

export const OPERATOR_AUDIT_ACTION_BY_KIND: Record<OperatorCustomerNotificationKind, string> = {
  manual_credit: "BANK_MANUAL_CREDIT_POSTED",
  manual_debit: "BANK_MANUAL_DEBIT_POSTED",
  fee_posted: "BANK_FEE_POSTED",
  reversal_posted: "BANK_REVERSAL_POSTED",
  correction_posted: "BANK_CORRECTION_POSTED",
  account_frozen: "BANK_ACCOUNT_FROZEN",
  account_unfrozen: "BANK_ACCOUNT_UNFROZEN",
  account_restricted: "BANK_ACCOUNT_RESTRICTED",
  restriction_removed: "BANK_ACCOUNT_UNRESTRICTED",
  account_hold_placed: "BANK_ACCOUNT_HOLD_PLACED",
  account_hold_released: "BANK_ACCOUNT_HOLD_RELEASED",
  withdrawal_hold_placed: "BANK_WITHDRAWAL_HOLD_PLACED",
  withdrawal_hold_released: "BANK_WITHDRAWAL_HOLD_RELEASED",
  account_closed: "BANK_ACCOUNT_CLOSED",
  account_reopened: "BANK_ACCOUNT_REOPENED",
  transaction_under_review: "BANK_TRANSACTION_UNDER_REVIEW",
  transaction_released: "BANK_TRANSACTION_RELEASED",
  payment_blocked: "BANK_PAYMENT_BLOCKED",
  payment_reversed: "BANK_PAYMENT_REVERSED",
};

const TITLE_BY_KIND: Record<OperatorCustomerNotificationKind, string> = {
  manual_credit: "Manual Credit Posted",
  manual_debit: "Manual Debit Posted",
  fee_posted: "Fee Posted",
  reversal_posted: "Reversal Posted",
  correction_posted: "Correction Posted",
  account_frozen: "Account Frozen",
  account_unfrozen: "Account Unfrozen",
  account_restricted: "Account Restricted",
  restriction_removed: "Restriction Removed",
  account_hold_placed: "Hold Placed",
  account_hold_released: "Hold Released",
  withdrawal_hold_placed: "Withdrawal Hold Placed",
  withdrawal_hold_released: "Withdrawal Hold Released",
  account_closed: "Account Closed",
  account_reopened: "Account Reopened",
  transaction_under_review: "Transaction Under Review",
  transaction_released: "Transaction Released",
  payment_blocked: "Payment Blocked",
  payment_reversed: "Payment Reversed",
};

const GENERIC_OPERATOR_EXPLANATION = "This action was completed by Alta Bank.";

export function formatAccountEndingSuffix(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return accountNumber.slice(-4) || accountNumber;
}

export function formatAccountEndingLabel(accountNumber: string): string {
  return `ending in ${formatAccountEndingSuffix(accountNumber)}`;
}

export function sanitizeCustomerFacingReason(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildOperatorNotificationBody(
  paragraphs: string[],
  customerFacingReason?: string | null,
): string {
  const parts = paragraphs.filter(Boolean);
  const reason = sanitizeCustomerFacingReason(customerFacingReason);
  if (reason) {
    parts.push("", "Reason:", reason);
  }
  return parts.join("\n");
}

export function classifyAdjustmentKind(
  customerDescription: string,
  direction: "credit" | "debit",
): OperatorCustomerNotificationKind {
  const normalized = customerDescription.trim().toLowerCase();
  if (normalized.startsWith("reversal")) return "reversal_posted";
  if (normalized.includes("fee")) return "fee_posted";
  if (normalized.includes("correction")) return "correction_posted";
  return direction === "credit" ? "manual_credit" : "manual_debit";
}

export function operatorNotificationTitle(kind: OperatorCustomerNotificationKind): string {
  return TITLE_BY_KIND[kind];
}

export function operatorNotificationAuditAction(kind: OperatorCustomerNotificationKind): string {
  return OPERATOR_AUDIT_ACTION_BY_KIND[kind];
}

export function buildOperatorAccountLink(accountId: string): string {
  return `/bank/accounts/${accountId}`;
}

export function buildOperatorActivityLink(): string {
  return "/bank/activity";
}

export function buildOperatorTransactionLink(transactionId: string): string {
  return `/bank/activity?transaction=${transactionId}`;
}

export type OperatorNotificationCopyInput = {
  kind: OperatorCustomerNotificationKind;
  accountNumber: string;
  amount?: number;
  customerFacingReason?: string | null;
};

export function buildOperatorCustomerNotificationCopy(
  input: OperatorNotificationCopyInput,
): { title: string; body: string } {
  const ending = formatAccountEndingLabel(input.accountNumber);
  const title = operatorNotificationTitle(input.kind);
  const reason = sanitizeCustomerFacingReason(input.customerFacingReason);
  const generic = reason ? null : GENERIC_OPERATOR_EXPLANATION;

  switch (input.kind) {
    case "manual_credit":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A manual credit of ${formatFlorin(input.amount ?? 0)} was posted to your account ${ending}.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "manual_debit":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A manual debit of ${formatFlorin(input.amount ?? 0)} was posted to your account ${ending}.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "fee_posted":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A fee of ${formatFlorin(input.amount ?? 0)} was posted to your account ${ending}.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "reversal_posted":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A reversal of ${formatFlorin(input.amount ?? 0)} was posted to your account ${ending}.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "correction_posted":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A balance correction of ${formatFlorin(input.amount ?? 0)} was posted to your account ${ending}.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_frozen":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Your account ${ending} has been frozen.`,
            "Some account activity may be temporarily unavailable.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_unfrozen":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Your account ${ending} has been unfrozen.`,
            "Normal account activity is available again.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_restricted":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Restrictions were applied to your account ${ending}.`,
            "Some account activity may be temporarily unavailable.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "restriction_removed":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Restrictions were removed from your account ${ending}.`,
            "Normal account activity is available again.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_hold_placed":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A hold has been placed on ${formatFlorin(input.amount ?? 0)} in your account ${ending}.`,
            "Available balance may be reduced while the hold is active.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_hold_released":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A hold of ${formatFlorin(input.amount ?? 0)} was released on your account ${ending}.`,
            "Your available balance has been updated.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "withdrawal_hold_placed":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `A withdrawal hold was placed on your account ${ending}.`,
            "Withdrawals may be temporarily unavailable.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "withdrawal_hold_released":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `The withdrawal hold on your account ${ending} was released.`,
            "Withdrawals are available again.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_closed":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Your account ${ending} has been closed.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "account_reopened":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            `Your account ${ending} has been reopened.`,
            "Normal account activity is available again.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "transaction_under_review":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            "A transaction on your account is under review.",
            "Processing may be delayed until the review is complete.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "transaction_released":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            "A transaction review on your account has been completed.",
            "Processing may continue as normal.",
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "payment_blocked":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            input.amount
              ? `A payment of ${formatFlorin(input.amount)} on your account ${ending} was not approved.`
              : `A payment on your account ${ending} was not approved.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    case "payment_reversed":
      return {
        title,
        body: buildOperatorNotificationBody(
          [
            input.amount
              ? `A payment of ${formatFlorin(input.amount)} on your account ${ending} was reversed.`
              : `A payment on your account ${ending} was reversed.`,
            generic,
          ].filter(Boolean) as string[],
          reason,
        ),
      };
    default: {
      const _exhaustive: never = input.kind;
      return _exhaustive;
    }
  }
}
