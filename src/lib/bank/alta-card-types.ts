export type AltaCardTypeCode = "personal" | "business" | "employee";

export type AltaCardTierCode = "white" | "navy" | "black" | "gold";

export type AltaCardStatusCode =
  | "pending"
  | "active"
  | "frozen"
  | "lost"
  | "expired"
  | "closed"
  | "delinquent";

export type AltaCardApplicationStatusCode =
  | "submitted"
  | "under_review"
  | "needs_info"
  | "approved"
  | "denied"
  | "cancelled";

export type AltaCardTransactionTypeCode =
  | "purchase"
  | "alta_pay"
  | "cash_advance"
  | "payment"
  | "interest"
  | "fee"
  | "adjustment_credit"
  | "adjustment_debit"
  | "reversal";

export type AltaCardTransactionStatusCode = "pending" | "completed" | "failed" | "reversed";

export const ALTA_CARD_TIER_ORDER: AltaCardTierCode[] = ["white", "navy", "black", "gold"];

export const ALTA_CARD_TIER_LABELS: Record<AltaCardTierCode, string> = {
  white: "Alta White",
  navy: "Alta Navy",
  black: "Alta Black",
  gold: "Alta Gold",
};

export function altaCardTierLabel(tier: string): string {
  return ALTA_CARD_TIER_LABELS[tier as AltaCardTierCode] ?? tier;
}

export function formatAltaCardTierUpgradeDescription(
  previousTier: string | null | undefined,
  newTier?: string | null | undefined,
): string | null {
  const prevLabel = previousTier ? altaCardTierLabel(previousTier) : null;
  const newLabel = newTier ? altaCardTierLabel(newTier) : null;
  if (prevLabel && newLabel) return `Upgraded from ${prevLabel} to ${newLabel}.`;
  if (prevLabel) return `Previously ${prevLabel}.`;
  if (newLabel) return `Upgraded to ${newLabel}.`;
  return null;
}

export const ALTA_CARD_DEFAULT_LIMITS: Record<AltaCardTierCode, number | null> = {
  white: 5_000,
  navy: 15_000,
  black: 50_000,
  gold: null,
};

export const ALTA_CARD_DEFAULT_RATES: Record<AltaCardTierCode, number | null> = {
  white: 24.99,
  navy: 19.99,
  black: 15.99,
  gold: null,
};

export const ALTA_CARD_TX_TYPE_LABELS: Record<AltaCardTransactionTypeCode, string> = {
  purchase: "Alta Card Purchase",
  alta_pay: "Alta Pay",
  cash_advance: "Alta Card Cash Advance",
  payment: "Alta Card Payment",
  interest: "Alta Card Interest",
  fee: "Alta Card Fee",
  adjustment_credit: "Alta Card Adjustment",
  adjustment_debit: "Alta Card Adjustment",
  reversal: "Alta Card Reversal",
};

export type AltaCardRow = {
  id: string;
  ownerUserId: string | null;
  ownerUsername: string | null;
  companyId: string | null;
  companyName: string | null;
  applicationId: string | null;
  tier: AltaCardTierCode;
  cardType: AltaCardTypeCode;
  status: AltaCardStatusCode;
  creditLimit: number;
  availableCredit: number;
  currentBalance: number;
  statementBalance: number;
  minimumPaymentDue: number;
  interestRate: number;
  dueDate: string | null;
  currentBillingCycleStart: string | null;
  currentBillingCycleEnd: string | null;
  currentStatementId: string | null;
  lastStatementDate: string | null;
  nextStatementDate: string | null;
  paymentDueDate: string | null;
  cardLastFour: string;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AltaEmployeeCardRow = {
  id: string;
  companyId: string;
  companyName: string;
  authorizedUserId: string;
  authorizedUsername: string;
  parentBusinessCardId: string;
  status: AltaCardStatusCode;
  employeeSpendLimit: number;
  employeeAvailableLimit: number;
  employeeCurrentBalance: number;
  cardLastFour: string;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Employee card issued to the current user, with parent line tier for display. */
export type UserEmployeeAltaCardSummary = AltaEmployeeCardRow & {
  parentTier: AltaCardTierCode;
};

export type UserEmployeeAltaCardDetail = UserEmployeeAltaCardSummary & {
  recentTransactions: AltaCardTransactionRow[];
  parentAutopay?: import("@/lib/bank/alta-card-autopay-types").AltaCardAutopaySettings | null;
};

export type AltaCardTransactionRow = {
  id: string;
  altaCardId: string;
  altaEmployeeCardId: string | null;
  type: AltaCardTransactionTypeCode;
  status: AltaCardTransactionStatusCode;
  amount: number;
  description: string;
  merchantCompanyId: string | null;
  merchantCompanyName: string | null;
  relatedBankAccountId: string | null;
  relatedBankTransactionId: string | null;
  relatedAltaPayPaymentId: string | null;
  referenceCode: string;
  createdByUserId: string | null;
  createdByUsername: string | null;
  spenderUserId: string | null;
  spenderUsername: string | null;
  employeeCardLastFour: string | null;
  createdAt: string;
  settledAt: string | null;
  reversedAt: string | null;
  reversesTransactionId: string | null;
  metadata: Record<string, unknown> | null;
};

export type AltaCardDetail = AltaCardRow & {
  employeeCards: AltaEmployeeCardRow[];
  recentTransactions: AltaCardTransactionRow[];
};

export type AltaCardApplicationRow = {
  id: string;
  applicantUserId: string;
  applicantUsername: string;
  companyId: string | null;
  companyName: string | null;
  cardType: AltaCardTypeCode;
  requestedTier: AltaCardTierCode;
  status: AltaCardApplicationStatusCode;
  requestedLimit: number | null;
  approvedTier: AltaCardTierCode | null;
  approvedLimit: number | null;
  approvedInterestRate: number | null;
  purpose: string | null;
  paymentSourceAccountId: string | null;
  expectedMonthlySpend: number | null;
  employeeCardsNeeded: boolean | null;
  reviewNote: string | null;
  denialReason: string | null;
  goldOverride: boolean;
  reviewedById: string | null;
  reviewedAt: string | null;
  acceptedAt: string | null;
  cardId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AltaCardApplicationDetail = AltaCardApplicationRow & {
  threadStatus: import("@/lib/bank/alta-card-application-thread-types").AltaCardApplicationThreadStatusCode | null;
  assignedStaffName: string | null;
};

export type InternalAltaCardApplicationFilters = {
  status?: AltaCardApplicationStatusCode;
  cardType?: AltaCardTypeCode;
  tier?: AltaCardTierCode;
  companyId?: string;
  q?: string;
};

export type RelationshipFactor = {
  key: string;
  label: string;
  value: string;
  impact: number;
};

export type AltaCardRelationshipRecommendation = {
  recommendedTier: AltaCardTierCode;
  recommendedCreditLimit: number;
  recommendedInterestRate: number;
  relationshipScore: number;
  relationshipFactors: RelationshipFactor[];
};

export type InternalAltaCardOperationsContext = {
  card: AltaCardDetail;
  utilization: number;
  lastPayment: AltaCardTransactionRow | null;
  lastTransaction: AltaCardTransactionRow | null;
  relationship: AltaCardRelationshipRecommendation;
  tierDefaultLimit: number | null;
  tierDefaultRate: number | null;
  employeeMemberOptions: CompanyEmployeeCardMemberOption[];
};

export type CompanyEmployeeCardMemberOption = {
  userId: string;
  username: string;
  role: string;
  hasActiveEmployeeCard: boolean;
};

export type InternalAltaCardApplicationReviewContext = {
  application: AltaCardApplicationDetail;
  applicantAccountCount: number;
  applicantLoanCount: number;
  companyAccountCount: number | null;
  companyLoanCount: number | null;
  relationship: AltaCardRelationshipRecommendation;
  threadContext: import("@/lib/bank/alta-card-application-thread-types").AltaCardApplicationThreadContext;
  messages: import("@/lib/bank/alta-card-application-thread-types").AltaCardApplicationThreadMessageRow[];
};

export type CreatePersonalAltaCardApplicationInput = {
  requestedTier: AltaCardTierCode;
  requestedLimit?: number;
  purpose?: string;
  paymentSourceAccountId?: string;
  acknowledged: boolean;
};

export type CreateBusinessAltaCardApplicationInput = {
  companyId: string;
  requestedTier: AltaCardTierCode;
  requestedLimit?: number;
  purpose?: string;
  expectedMonthlySpend?: number;
  employeeCardsNeeded?: boolean;
  acknowledged: boolean;
};

export type ApproveAltaCardApplicationInput = {
  applicationId: string;
  approvedLimit: number;
  interestRate: number;
  tier?: AltaCardTierCode;
  reviewNote?: string;
  approveAndActivate?: boolean;
  goldOverride?: boolean;
};

export type DenyAltaCardApplicationInput = {
  applicationId: string;
  denialReason?: string;
};

export type UpdateAltaCardLimitInput = {
  cardId: string;
  creditLimit: number;
};

export type UpdateAltaCardRateInput = {
  cardId: string;
  interestRate: number;
};

export type ChangeAltaCardTierInput = {
  cardId: string;
  tier: AltaCardTierCode;
};

export type CreateEmployeeCardInput = {
  companyId: string;
  authorizedUserId: string;
  employeeSpendLimit: number;
};

export type UpdateEmployeeCardLimitInput = {
  employeeCardId: string;
  employeeSpendLimit: number;
};

export type InternalAltaCardFilters = {
  tier?: AltaCardTierCode;
  status?: AltaCardStatusCode;
  cardType?: AltaCardTypeCode;
  q?: string;
};

export type SubmitCashAdvanceInput = {
  cardId: string;
  destinationAccountId: string;
  amount: number;
  memo?: string;
};

export type SubmitEmployeeCashAdvanceInput = {
  employeeCardId: string;
  destinationAccountId: string;
  amount: number;
  memo?: string;
};

export type SubmitCardPaymentInput = {
  cardId: string;
  sourceAccountId: string;
  amount: number;
  paymentKind: "minimum" | "statement" | "current" | "custom";
  memo?: string;
};

export type CreateAltaCardAdjustmentInput = {
  cardId: string;
  kind: "credit" | "debit";
  amount: number;
  reason: string;
};

export type CardPaymentContext = {
  card: AltaCardRow;
  sourceAccounts: {
    id: string;
    accountName: string;
    accountNumber: string;
    availableBalance: number;
  }[];
  minimumPayment: number;
  statementBalance: number;
  currentBalance: number;
};

export type CashAdvanceContext = {
  card: AltaCardRow;
  destinationAccounts: {
    id: string;
    accountName: string;
    accountNumber: string;
  }[];
  availableCredit: number;
};

export type EmployeeCashAdvanceContext = {
  employeeCardId: string;
  companyName: string;
  cardLastFour: string;
  destinationAccounts: {
    id: string;
    accountName: string;
    accountNumber: string;
  }[];
  availableCredit: number;
  currentBalance: number;
};

export function altaCardStatusLabel(status: AltaCardStatusCode): string {
  const labels: Record<AltaCardStatusCode, string> = {
    pending: "Pending",
    active: "Active",
    frozen: "Frozen",
    lost: "Lost",
    expired: "Expired",
    closed: "Closed",
    delinquent: "Delinquent",
  };
  return labels[status];
}

export function altaCardTransactionLabel(type: AltaCardTransactionTypeCode): string {
  return ALTA_CARD_TX_TYPE_LABELS[type];
}

export function altaCardEmployeeTransactionAttribution(row: AltaCardTransactionRow): string | null {
  if (!row.altaEmployeeCardId) return null;
  const parts = ["Employee card"];
  if (row.employeeCardLastFour) parts.push(`•••• ${row.employeeCardLastFour}`);
  if (row.spenderUsername) parts.push(row.spenderUsername);
  return parts.join(" · ");
}

export function altaCardTransactionSignedAmount(
  type: AltaCardTransactionTypeCode,
  amount: number,
): number {
  const increasesBalance: AltaCardTransactionTypeCode[] = [
    "purchase",
    "alta_pay",
    "cash_advance",
    "interest",
    "fee",
    "adjustment_debit",
  ];
  if (type === "reversal") return amount;
  if (increasesBalance.includes(type)) return amount;
  return -amount;
}

export function formatAltaCardCurrency(amount: number): string {
  return (
    "ƒ" +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatAltaCardRate(rate: number): string {
  return `${rate.toFixed(2)}% APR`;
}

export type AltaCardStatementStatusCode =
  | "open"
  | "generated"
  | "issued"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "void";

export type GenerateAltaCardStatementInput = {
  cardId: string;
  periodStart: string;
  periodEnd: string;
};

export type AltaCardStatementRow = {
  id: string;
  altaCardId: string;
  statementNumber: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  statementDate: string | null;
  dueDate: string;
  previousBalance: number;
  purchases: number;
  payments: number;
  adjustments: number;
  interestCharged: number;
  feesCharged: number;
  statementBalance: number;
  amountPaid: number;
  feesPaid: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;
  minimumPayment: number;
  endingBalance: number;
  status: AltaCardStatementStatusCode;
  paidAt: string | null;
  overdueAt: string | null;
  interestAppliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AltaCardStatementDetail = AltaCardStatementRow & {
  transactions: AltaCardTransactionRow[];
};

export type AltaCardBillingSummary = {
  currentBalance: number;
  statementBalance: number;
  minimumPayment: number;
  paymentDueDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  nextStatementDate: string | null;
  interestRate: number;
  activeFeesTotal: number;
  hasOverdueStatement: boolean;
};

export type AltaCardFeeTypeCode = "late_payment" | "cash_advance" | "over_limit" | "manual";

export type AltaCardFeeStatusCode = "active" | "waived" | "paid";

export type AltaCardFeeRow = {
  id: string;
  altaCardId: string;
  statementId: string | null;
  transactionId: string | null;
  type: AltaCardFeeTypeCode;
  amount: number;
  status: AltaCardFeeStatusCode;
  reason: string | null;
  waivedByUserId: string | null;
  waivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ALTA_CARD_FEE_TYPE_LABELS: Record<AltaCardFeeTypeCode, string> = {
  late_payment: "Late payment",
  cash_advance: "Cash advance",
  over_limit: "Over limit",
  manual: "Manual",
};

export const ALTA_CARD_FEE_STATUS_LABELS: Record<AltaCardFeeStatusCode, string> = {
  active: "Active",
  waived: "Waived",
  paid: "Paid",
};

export const ALTA_CARD_STATEMENT_STATUS_LABELS: Record<AltaCardStatementStatusCode, string> = {
  open: "Open",
  generated: "Generated",
  issued: "Issued",
  paid: "Paid",
  partially_paid: "Partially paid",
  overdue: "Overdue",
  void: "Void",
};

/** Admin-facing labels — preview statements are not production-issued. */
export const ALTA_CARD_STATEMENT_STATUS_LABELS_ADMIN: Record<AltaCardStatementStatusCode, string> = {
  ...ALTA_CARD_STATEMENT_STATUS_LABELS,
  generated: "Preview statement",
};
