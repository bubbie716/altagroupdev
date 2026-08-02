/** Plain-language titles for ops audit / account activity events. */

const KNOWN_TITLES: Record<string, string> = {
  BANK_ACCOUNT_OPENED: "Account opened",
  ACCOUNT_CREATED: "Account created",
  BANK_DEPOSIT_REQUEST_SUBMITTED: "Deposit submitted",
  DEPOSIT_APPROVED: "Deposit approved",
  DEPOSIT_DENIED: "Deposit denied",
  BANK_WITHDRAWAL_REQUEST_SUBMITTED: "Withdrawal submitted",
  WITHDRAWAL_APPROVED: "Withdrawal approved",
  WITHDRAWAL_DENIED: "Withdrawal denied",
  BANK_INTERNAL_TRANSFER_COMPLETED: "Transfer completed",
  BANK_INTERNAL_TRANSFER_FAILED: "Transfer failed",
  INTEREST_CREDIT_POSTED: "Interest credited",
  FEE_POSTED: "Fee posted",
  HOLD_PLACED: "Hold placed",
  HOLD_RELEASED: "Hold released",
  ACCOUNT_FROZEN: "Account frozen",
  ACCOUNT_UNFROZEN: "Account unfrozen",
  ACCOUNT_RESTRICTED: "Account restricted",
  ACCOUNT_RESTRICTION_REMOVED: "Restriction removed",
  ACCOUNT_CLOSED: "Account closed",
  ADJUSTMENT_POSTED: "Adjustment posted",
  ADJUSTMENT_REVERSED: "Adjustment reversed",
  NOTE_ADDED: "Note added",
  ALTA_CARD_FROZEN: "Card frozen",
  ALTA_CARD_UNFROZEN: "Card unfrozen",
  ALTA_CARD_ACTIVATED: "Card activated",
  ALTA_CARD_DELINQUENT: "Card marked delinquent",
  ALTA_CARD_PAYMENT_MADE: "Card payment posted",
  ALTA_CARD_AUTOPAY_SUCCEEDED: "Autopay succeeded",
  ALTA_CARD_AUTOPAY_FAILED: "Autopay failed",
  ALTA_CARD_APPLICATION_APPROVED: "Card application approved",
  ALTA_CARD_APPLICATION_DENIED: "Card application denied",
  ALTA_CARD_REVIEW_DECIDED: "Card review decided",
  ALTA_CARD_TIER_CHANGED: "Card tier changed",
  ALTA_CARD_LIMIT_CHANGED: "Card limit changed",
  ALTA_CARD_RATE_CHANGED: "Card rate changed",
  ALTA_CARD_OPENED: "Card opened",
  ALTA_CARD_CASH_ADVANCE_CREATED: "Cash advance created",
  ALTA_CARD_PURCHASE: "Card purchase",
  ALTA_CARD_PAYMENT: "Card payment",
  ALTA_CARD_ADJUSTMENT: "Card adjustment",
  LOAN_APPROVED: "Loan approved",
  LOAN_DENIED: "Loan denied",
  LOAN_PAYMENT: "Loan payment",
  LOAN_PAYMENT_MADE: "Loan payment made",
  LOAN_FROZEN: "Loan frozen",
  LOAN_UNFROZEN: "Loan unfrozen",
  LOAN_PAID_OFF: "Loan paid off",
  LOAN_CLOSED: "Loan closed",
  LOAN_APPLICATION_UNDER_REVIEW: "Application under review",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  COMPANY_VERIFIED: "Company verified",
  BUSINESS_CREDIT_LINE: "Business Credit Line",
  PERSONAL_CREDIT_LINE: "Personal Credit Line",
  BUSINESS_LOAN: "Business Loan",
  PERSONAL_LOAN: "Personal Loan",
  BANK_BALANCE_RECONCILIATION_MISMATCH: "Balance reconciliation mismatch",
  STAFF_AUDIT_MESSAGE_FAILED: "Staff alert delivery failed",
  ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED: "Relationship recommendation viewed",
  RELATIONSHIP_RECOMMENDATION_VIEWED: "Relationship recommendation viewed",
  COMPANY_RELATIONSHIP_RECOMMENDATION_VIEWED: "Relationship recommendation viewed",
  TERMINAL_CRYPTO_STATUS_ACTIVE: "Crypto market activated",
  TERMINAL_CRYPTO_STATUS_HALTED: "Crypto trading halted",
  TERMINAL_CRYPTO_STATUS_REDEMPTION_ONLY: "Crypto market set to redemption only",
  TERMINAL_CRYPTO_STATUS_CLOSED: "Crypto market closed",
  TERMINAL_CRYPTO_STATUS_DRAFT: "Crypto market returned to draft",
  TERMINAL_CRYPTO_FEE_CONFIG_UPDATED: "Crypto fee configuration updated",
  TERMINAL_CRYPTO_REVENUE_SWEEP: "Crypto revenue swept",
  TERMINAL_CRYPTO_CONTRIBUTION_PROTECTED_RESERVE: "Protected reserve contribution recorded",
  TERMINAL_CRYPTO_CONTRIBUTION_STABILIZATION_FUND: "Stabilization contribution recorded",
  TERMINAL_CRYPTO_CONTRIBUTION_REVENUE_TO_STABILIZATION: "Revenue moved to stabilization",
  TERMINAL_CRYPTO_RECON_ISSUE_RESOLVED: "Crypto reconciliation issue resolved",
  TERMINAL_CRYPTO_RECON_ISSUE_REOPENED: "Crypto reconciliation issue reopened",
  TERMINAL_CRYPTO_ORDER_FILLED: "Crypto order filled",
  TERMINAL_CRYPTO_ORDER_REJECTED: "Crypto order rejected",
  TERMINAL_CRYPTO_ORDER_FAILED: "Crypto order failed",
  TERMINAL_FUNDING_COMPLETED: "Terminal funding completed",
  TERMINAL_FUNDING_FAILED: "Terminal funding failed",
  TERMINAL_CRYPTO_RECON_CRITICAL: "Crypto reconciliation critical issue",
  TERMINAL_CRYPTO_RECON_WARNING: "Crypto reconciliation warning",
};

/** Passive tracking / view events that should not clutter Corporate Home. */
const PASSIVE_HOME_ACTIVITY_ACTIONS = new Set([
  "ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED",
  "RELATIONSHIP_RECOMMENDATION_VIEWED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_VIEWED",
  "RELATIONSHIP_INTELLIGENCE_VIEWED",
  "COMPANY_RELATIONSHIP_INTELLIGENCE_VIEWED",
]);

export function isPassiveHomeActivityAction(action: string): boolean {
  const key = action.trim().toUpperCase().replace(/\s+/g, "_");
  if (PASSIVE_HOME_ACTIVITY_ACTIONS.has(key)) return true;
  return /_RECOMMENDATION_VIEWED$|_INTELLIGENCE_VIEWED$|_VIEWED$/.test(key) && /RELATIONSHIP|RECOMMENDATION/.test(key);
}

export function formatOpsAuditActionTitle(action: string): string {
  const key = action.trim().toUpperCase().replace(/\s+/g, "_");
  if (KNOWN_TITLES[key]) return KNOWN_TITLES[key];

  // Preserve brand tokens (Alta Pay / Alta Card) while title-casing the rest.
  const s = key.replace(/^BANK_/, "").replace(/_/g, " ").toLowerCase();
  return s
    .replace(/\balta pay\b/g, "Alta Pay")
    .replace(/\balta card\b/g, "Alta Card")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAlta Pay\b/g, "Alta Pay")
    .replace(/\bAlta Card\b/g, "Alta Card");
}
