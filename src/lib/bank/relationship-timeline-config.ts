export const TOTAL_ALTA_ASSETS_MILESTONES = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;

export const LIFETIME_DEPOSITS_MILESTONES = [50_000, 100_000, 500_000, 1_000_000] as const;

export const LIFETIME_WITHDRAWALS_MILESTONES = [50_000, 100_000, 500_000, 1_000_000] as const;

export const ALTA_PAY_VOLUME_MILESTONES = [10_000, 50_000, 100_000, 500_000] as const;

export const RELATIONSHIP_TIMELINE_EVENT_LABELS = {
  RELATIONSHIP_STARTED: "Relationship Established",
  BANK_ACCOUNT_OPENED: "Bank Account Opened",
  BUSINESS_ACCOUNT_OPENED: "Business Account Opened",
  DEPOSIT_MILESTONE: "Deposit Milestone Reached",
  WITHDRAWAL_MILESTONE: "Withdrawal Milestone Reached",
  ALTA_PAY_MILESTONE: "Alta Pay Milestone Reached",
  ALTA_CARD_OPENED: "Alta Card Opened",
  ALTA_CARD_TIER_CHANGED: "Alta Card Upgraded",
  ALTA_CARD_LIMIT_CHANGED: "Alta Card Limit Updated",
  ALTA_CARD_PAID_ON_TIME: "Alta Card Payment Received",
  ALTA_CARD_DELINQUENT: "Alta Card Past Due",
  LOAN_APPLICATION_SUBMITTED: "Loan Application Submitted",
  LOAN_ACCEPTED: "Loan Application Approved",
  LOAN_DENIED: "Loan Application Denied",
  LOAN_FUNDED: "Loan Approved",
  LOAN_PAYMENT_MADE: "Loan Payment Received",
  LOAN_PAID_OFF: "Loan Fully Repaid",
  PRIVATE_BANKING_ELIGIBLE: "Eligible for Alta Private",
  ALTA_PRIVATE_INVITED: "Invited to Alta Private",
  PRIVATE_BANKING_CLIENT: "Alta Private Activated",
  RELATIONSHIP_SCORE_CHANGED: "Relationship Score Updated",
  RELATIONSHIP_TIER_CHANGED: "Relationship Status Updated",
  MANUAL_NOTE: "Relationship Note",
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
  "ALTA_PRIVATE_INVITED",
  "PRIVATE_BANKING_CLIENT",
  "RELATIONSHIP_TIER_CHANGED",
] as const);

export function milestoneDedupeKey(
  category: "assets" | "deposits" | "withdrawals" | "alta_pay",
  threshold: number,
): string {
  return `milestone:${category}:${threshold}`;
}
