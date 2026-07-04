import type { OperatorCustomerNotificationKind } from "@/lib/bank/customer-operator-notification-copy";

/** Operator actions where the customer must receive notification — silent mode is forbidden. */
export const SILENT_FORBIDDEN_KINDS = new Set<OperatorCustomerNotificationKind>([
  "account_frozen",
  "account_restricted",
  "payment_blocked",
  "payment_reversed",
]);

export type SilentForbiddenAction =
  | "deny_deposit"
  | "deny_withdrawal"
  | "alta_pay_reversal"
  | "company_verification_rejection"
  | "company_verification_revocation"
  | "loan_denial"
  | "alta_card_denial"
  | "account_freeze"
  | "account_restriction"
  | "payment_reversal";

export const SILENT_FORBIDDEN_ACTIONS = new Set<SilentForbiddenAction>([
  "deny_deposit",
  "deny_withdrawal",
  "alta_pay_reversal",
  "company_verification_rejection",
  "company_verification_revocation",
  "loan_denial",
  "alta_card_denial",
  "account_freeze",
  "account_restriction",
  "payment_reversal",
]);

const SILENT_FORBIDDEN_MESSAGES: Record<SilentForbiddenAction, string> = {
  deny_deposit: "Deposit denials require customer notification.",
  deny_withdrawal: "Withdrawal denials require customer notification.",
  alta_pay_reversal: "Alta Pay reversals require customer notification.",
  company_verification_rejection: "Company verification rejections require customer notification.",
  company_verification_revocation: "Company verification revocations require customer notification.",
  loan_denial: "Loan denials require customer notification.",
  alta_card_denial: "Alta Card denials require customer notification.",
  account_freeze: "Account freezes require customer notification.",
  account_restriction: "Account restrictions require customer notification.",
  payment_reversal: "Payment reversals affecting customer funds require customer notification.",
};

export function isSilentNotificationForbidden(
  input: { kind?: OperatorCustomerNotificationKind; action?: SilentForbiddenAction },
  options?: { silentNotification?: boolean },
): boolean {
  if (options?.silentNotification !== true) return false;
  if (input.kind && SILENT_FORBIDDEN_KINDS.has(input.kind)) return true;
  if (input.action && SILENT_FORBIDDEN_ACTIONS.has(input.action)) return true;
  return false;
}

export function silentNotificationForbiddenMessage(
  input: { kind?: OperatorCustomerNotificationKind; action?: SilentForbiddenAction },
): string {
  if (input.action && SILENT_FORBIDDEN_MESSAGES[input.action]) {
    return SILENT_FORBIDDEN_MESSAGES[input.action];
  }
  if (input.kind === "account_frozen") return SILENT_FORBIDDEN_MESSAGES.account_freeze;
  if (input.kind === "account_restricted") return SILENT_FORBIDDEN_MESSAGES.account_restriction;
  if (input.kind === "payment_blocked") return SILENT_FORBIDDEN_MESSAGES.deny_withdrawal;
  if (input.kind === "payment_reversed") return SILENT_FORBIDDEN_MESSAGES.payment_reversal;
  return "Silent notification is not allowed for this action.";
}

export function assertSilentNotificationAllowed(
  input: { kind?: OperatorCustomerNotificationKind; action?: SilentForbiddenAction },
  options?: { silentNotification?: boolean },
): void {
  if (isSilentNotificationForbidden(input, options)) {
    throw new Error(`BAD_REQUEST:${silentNotificationForbiddenMessage(input)}`);
  }
}
