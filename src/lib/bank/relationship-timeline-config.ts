export const TOTAL_ALTA_ASSETS_MILESTONES = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;

export const LIFETIME_DEPOSITS_MILESTONES = [50_000, 100_000, 500_000, 1_000_000] as const;

export const LIFETIME_WITHDRAWALS_MILESTONES = [50_000, 100_000, 500_000, 1_000_000] as const;

export const ALTA_PAY_VOLUME_MILESTONES = [10_000, 50_000, 100_000, 500_000] as const;

export const RELATIONSHIP_TIMELINE_EVENT_LABELS = {
  RELATIONSHIP_STARTED: "Relationship started",
  BANK_ACCOUNT_OPENED: "Bank account opened",
  BUSINESS_ACCOUNT_OPENED: "Business account opened",
  DEPOSIT_MILESTONE: "Deposit milestone",
  WITHDRAWAL_MILESTONE: "Withdrawal milestone",
  ALTA_PAY_MILESTONE: "Alta Pay milestone",
  ALTA_CARD_OPENED: "Alta Card opened",
  ALTA_CARD_TIER_CHANGED: "Alta Card tier upgraded",
  ALTA_CARD_LIMIT_CHANGED: "Alta Card limit changed",
  ALTA_CARD_PAID_ON_TIME: "Alta Card paid on time",
  ALTA_CARD_DELINQUENT: "Alta Card delinquent",
  LOAN_APPLICATION_SUBMITTED: "Loan application submitted",
  LOAN_ACCEPTED: "Loan accepted",
  LOAN_DENIED: "Loan denied",
  LOAN_FUNDED: "Loan approved",
  LOAN_PAYMENT_MADE: "Loan payment made",
  LOAN_PAID_OFF: "Loan paid off",
  PRIVATE_BANKING_ELIGIBLE: "Private banking eligible",
  PRIVATE_BANKING_CLIENT: "Private banking client",
  RELATIONSHIP_SCORE_CHANGED: "Relationship score changed",
  RELATIONSHIP_TIER_CHANGED: "Relationship tier changed",
  MANUAL_NOTE: "Manual note",
} as const;

/** Customer-facing timeline — positive/neutral only. */
export const CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES = new Set([
  "RELATIONSHIP_STARTED",
  "BANK_ACCOUNT_OPENED",
  "BUSINESS_ACCOUNT_OPENED",
  "DEPOSIT_MILESTONE",
  "ALTA_PAY_MILESTONE",
  "ALTA_CARD_OPENED",
  "ALTA_CARD_TIER_CHANGED",
  "ALTA_CARD_PAID_ON_TIME",
  "LOAN_FUNDED",
  "LOAN_PAID_OFF",
  "PRIVATE_BANKING_ELIGIBLE",
  "PRIVATE_BANKING_CLIENT",
  "RELATIONSHIP_TIER_CHANGED",
] as const);

export function milestoneDedupeKey(
  category: "assets" | "deposits" | "withdrawals" | "alta_pay",
  threshold: number,
): string {
  return `milestone:${category}:${threshold}`;
}
