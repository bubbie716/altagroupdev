import type { LoanRateType } from "@/lib/bank/loan-interest";
import { estimateOutstandingAfterTerm } from "@/lib/bank/loan-interest";
import type { LoanApplicationThreadStatusCode } from "@/lib/bank/loan-application-thread-types";

export type LoanProductTypeCode =
  | "personal_credit_line"
  | "business_credit_line"
  | "private_liquidity_line";

export type LoanApplicationStatusCode =
  | "pending"
  | "under_review"
  | "approved"
  | "denied"
  | "cancelled";

export type LoanStatusCode = "active" | "paid_off" | "defaulted" | "cancelled" | "frozen";

export type LoanPaymentStatusCode = "pending" | "completed" | "failed" | "cancelled";

export type LoanScheduleInstallmentStatusCode = "pending" | "partial" | "paid" | "overdue" | "failed";

export type { LoanRateType };

export interface LendingProductInfo {
  code: LoanProductTypeCode;
  name: string;
  limit: string;
  rate: string;
  repayment: string;
  summary: string;
  status: string;
}

/** Default monthly interest rate (%) set at operator approval. Null = negotiated. */
export const LOAN_PRODUCT_DEFAULT_MONTHLY_RATES: Record<LoanProductTypeCode, number | null> = {
  personal_credit_line: 7.5,
  business_credit_line: 6,
  private_liquidity_line: null,
};

export const LOAN_TERM_MONTHS_MIN = 1;
export const LOAN_TERM_MONTHS_MAX = 120;

export function computeLoanTermEstimate(
  productType: LoanProductTypeCode,
  principal: number,
  termMonths: number,
): { totalOutstanding: number; totalInterest: number } | null {
  const monthlyRate = LOAN_PRODUCT_DEFAULT_MONTHLY_RATES[productType];
  if (monthlyRate == null) return null;
  return estimateOutstandingAfterTerm(principal, monthlyRate, termMonths);
}

/** Short repayment label for product cards and summary rows. */
export const LOAN_PRODUCT_REPAYMENT_CARD: Record<LoanProductTypeCode, string> = {
  personal_credit_line: "Typical term: up to 6 months",
  business_credit_line: "Typical term: up to 8 months",
  private_liquidity_line: "Negotiated terms",
};

/** Full repayment guidance for apply flows and help text. */
export const LOAN_PRODUCT_REPAYMENT_GUIDANCE: Record<LoanProductTypeCode, string> = {
  personal_credit_line:
    "Typical repayment term: up to 6 months. Final repayment schedule is determined during underwriting.",
  business_credit_line:
    "Typical repayment term: up to 8 months. Final repayment schedule is determined during underwriting.",
  private_liquidity_line:
    "Negotiated terms. Final repayment schedule is determined during underwriting.",
};

export const LOAN_TERM_MONTHS_HELP =
  "Requested term in months (1–120). Product pages show typical ranges only — final repayment schedule is determined during underwriting.";

/** @deprecated Use LOAN_PRODUCT_REPAYMENT_CARD or LOAN_PRODUCT_REPAYMENT_GUIDANCE */
export const LOAN_PRODUCT_REPAYMENT_TERMS = LOAN_PRODUCT_REPAYMENT_CARD;

export const LENDING_V1_PRODUCTS: LendingProductInfo[] = [
  {
    code: "personal_credit_line",
    name: "Personal Credit Line",
    limit: "Up to ƒ1.5M",
    rate: "7.5% monthly",
    repayment: LOAN_PRODUCT_REPAYMENT_CARD.personal_credit_line,
    summary: "Revolving credit for established Alta Bank personal clients. Manual underwriting required.",
    status: "Apply",
  },
  {
    code: "business_credit_line",
    name: "Business Credit Line",
    limit: "Up to ƒ10M",
    rate: "6% monthly",
    repayment: LOAN_PRODUCT_REPAYMENT_CARD.business_credit_line,
    summary: "Operating credit lines for verified Newport companies with institutional cash flow.",
    status: "Apply",
  },
  {
    code: "private_liquidity_line",
    name: "Private Liquidity Line",
    limit: "Up to ƒ25M",
    rate: "Negotiated monthly",
    repayment: LOAN_PRODUCT_REPAYMENT_CARD.private_liquidity_line,
    summary: "Alta Private clients may receive relationship-based pricing, negotiated lending terms, and dedicated banker support.",
    status: "Alta Private",
  },
];

export interface LendingAccountOption {
  id: string;
  label: string;
  accountNumber: string;
  companyId: string | null;
  companyName: string | null;
}

export interface CompanyLendingOption {
  companyId: string;
  companyName: string;
  operatingAccountId: string | null;
}

export interface CreateLoanApplicationInput {
  productType: LoanProductTypeCode;
  requestedAmount: number;
  termMonths: number;
  linkedBankAccountId?: string;
  companyId?: string;
  purpose: string;
  repaymentPlan: string;
  collateralDescription?: string;
  notes?: string;
}

export interface LoanApplicationRow {
  id: string;
  productType: LoanProductTypeCode;
  productLabel: string;
  requestedAmount: number;
  termMonths: number;
  estimatedTotalOutstanding: number | null;
  estimatedTotalInterest: number | null;
  purpose: string;
  repaymentPlan: string;
  collateralDescription: string | null;
  notes: string | null;
  status: LoanApplicationStatusCode;
  statusLabel: string;
  reviewNote: string | null;
  companyId: string | null;
  companyName: string | null;
  linkedBankAccountId: string | null;
  linkedAccountLabel: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  threadId: string | null;
  threadStatus: LoanApplicationThreadStatusCode | null;
}

export interface LoanPaymentRow {
  id: string;
  amount: number;
  paymentDate: string;
  status: LoanPaymentStatusCode;
  statusLabel: string;
}

export type LoanInterestScheduleStatusCode = "pending" | "guaranteed" | "partial" | "paid" | "waived";

export interface LoanInterestScheduleItemRow {
  id: string;
  installmentNumber: number;
  guaranteeDate: string;
  interestAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: LoanInterestScheduleStatusCode;
  statusLabel: string;
  paidAt: string | null;
}

export interface LoanScheduleItemRow {
  id: string;
  installmentNumber: number;
  dueDate: string;
  scheduledAmount: number;
  paidAmount: number;
  remainingAmount: number;
  principalPortion: number;
  interestPortion: number;
  principalPercent: number;
  status: LoanScheduleInstallmentStatusCode;
  statusLabel: string;
}

export interface LoanAutoPayState {
  enabled: boolean;
  sourceBankAccountId: string | null;
  sourceAccountLabel: string | null;
}

export interface LoanRow {
  id: string;
  productType: LoanProductTypeCode;
  productLabel: string;
  principalAmount: number;
  /** Outstanding principal still borrowed. */
  principalOutstanding: number;
  /** Guaranteed but unpaid interest (owed today). */
  guaranteedInterestOwed: number;
  /** @deprecated Use guaranteedInterestOwed */
  accruedInterest: number;
  /** Principal + guaranteed unpaid interest — amount required to pay off today. */
  currentPayoffAmount: number;
  /** @deprecated Alias for currentPayoffAmount */
  outstandingBalance: number;
  /** Pending (unvested) interest on guarantee schedule. */
  remainingPotentialInterest: number;
  /** Principal + all scheduled guarantee interest if full term completes. */
  projectedFullTermCost: number;
  /** @deprecated Use remainingPotentialInterest */
  estimatedFutureInterest: number;
  principalRepaid: number;
  principalPercentRepaid: number;
  /** Unpaid scheduled installment totals (estimate only, not current debt). */
  estimatedScheduleRemaining: number;
  amountRepaid: number;
  percentRepaid: number;
  totalRepaymentObligation: number;
  nextPaymentDueLabel: string;
  nextPaymentDueAmount: number | null;
  interestRate: number;
  interestRateType: LoanRateType;
  interestRateLabel: string;
  status: LoanStatusCode;
  statusLabel: string;
  borrowerLabel: string | null;
  companyId: string | null;
  companyName: string | null;
  linkedBankAccountId: string | null;
  linkedAccountLabel: string | null;
  approvedAt: string;
  includesAccruedInterest: boolean;
  nextInterestAccrualAt: string | null;
  nextInterestGuaranteeDate: string | null;
  lastInterestAccrualAt: string | null;
  /** @deprecated Use guaranteedInterestOwed */
  accruedInterestAmount: number;
  canMakePayment: boolean;
  termMonths: number | null;
  monthlyPrincipalPercent: number | null;
  paymentSchedule: LoanScheduleItemRow[];
  interestGuaranteeSchedule: LoanInterestScheduleItemRow[];
  autoPay: LoanAutoPayState;
  recentPayments: LoanPaymentRow[];
}

export interface LoanLedgerEntryRow {
  id: string;
  type: LoanLedgerEntryTypeCode;
  typeLabel: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export type LoanLedgerEntryTypeCode =
  | "disbursement"
  | "payment"
  | "interest_charge"
  | "adjustment"
  | "status_change";

export interface LoanDetailRow extends LoanRow {
  payments: LoanPaymentRow[];
  ledgerEntries: LoanLedgerEntryRow[];
}

export interface MakeLoanPaymentInput {
  loanId: string;
  sourceBankAccountId: string;
  amount: number;
  memo?: string;
}

export interface SubmitLoanPaymentResult {
  referenceCode: string;
  amount: number;
}

export interface SetLoanAutoPayInput {
  loanId: string;
  enabled: boolean;
  sourceBankAccountId: string;
}

export interface LoanPaymentContext {
  loan: LoanRow;
  sourceAccounts: LendingAccountOption[];
  canMakePayment: boolean;
}

export interface AdminAdjustLoanInput {
  loanId: string;
  amount: number;
  description: string;
}

export interface InternalActiveLoanRow {
  id: string;
  productLabel: string;
  borrowerLabel: string;
  companyName: string | null;
  linkedAccountNumber: string | null;
  linkedBankAccountId: string | null;
  principalAmount: number;
  principalOutstanding: number;
  accruedInterest: number;
  currentPayoffAmount: number;
  outstandingBalance: number;
  guaranteedInterestOwed: number;
  remainingPotentialInterest: number;
  projectedFullTermCost: number;
  nextInterestGuaranteeDate: string | null;
  principalRepaid: number;
  principalPercentRepaid: number;
  amountRepaid: number;
  percentRepaid: number;
  totalRepaymentObligation: number;
  interestRateLabel: string;
  status: LoanStatusCode;
  statusLabel: string;
  includesAccruedInterest: boolean;
  riskStatusLabel: string;
  paymentStatusLabel: string;
  lastPaymentAt: string | null;
  nextInterestAccrualAt: string | null;
  interestGuaranteeSchedule: LoanInterestScheduleItemRow[];
  paymentSchedule: LoanScheduleItemRow[];
  termMonths: number | null;
  monthlyPrincipalPercent: number | null;
}

export interface InternalLoanApplicationRow extends LoanApplicationRow {
  applicantUserId: string;
  applicantLabel: string;
  linkedAccountNumber: string | null;
  dealRoomId: string | null;
  threadId: string | null;
}

export interface ApproveLoanApplicationInput {
  applicationId: string;
  interestRate: number;
  principalAmount?: number;
  termMonths?: number;
  reviewNote?: string;
}

export interface DenyLoanApplicationInput {
  applicationId: string;
  reviewNote?: string;
}

export const LOAN_PRODUCT_LABELS: Record<LoanProductTypeCode, string> = {
  personal_credit_line: "Personal Credit Line",
  business_credit_line: "Business Credit Line",
  private_liquidity_line: "Private Liquidity Line",
};

export type LendingDeskStats = {
  officersOnDesk: number;
  avgResponseHours: number | null;
  activeFacilities: number;
  pendingReview: number;
};

export function formatLendingAvgResponse(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1 / 60) return "< 1m";
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    return rounded === 1 ? "1h" : `${rounded}h`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return days === 1 ? "1d" : `${days}d`;
}
