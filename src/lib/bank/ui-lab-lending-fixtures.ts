/**
 * Canonical UI Lab lending fixtures — list and detail share the same IDs.
 * Demonstration only; never writes to Prisma.
 */
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";

export const UI_LAB_LOAN_ACTIVE_ID = "LN-LAB-ACTIVE";
export const UI_LAB_LOAN_PAID_ID = "LN-LAB-PAID";
export const UI_LAB_LOAN_COMPANY_ID = "LN-LAB-COMPANY";

function baseLoan(
  patch: Partial<InternalActiveLoanRow> & Pick<InternalActiveLoanRow, "id" | "status" | "statusLabel">,
): InternalActiveLoanRow {
  return {
    productLabel: "Personal Credit Line",
    productType: "personal_credit_line",
    borrowerLabel: "Carter Townshend",
    companyName: null,
    linkedAccountNumber: "AB-2000-100002",
    linkedBankAccountId: "BA-LAB-CHK",
    principalAmount: 25_000,
    principalOutstanding: 18_400,
    accruedInterest: 120.5,
    currentPayoffAmount: 18_520.5,
    outstandingBalance: 18_520.5,
    guaranteedInterestOwed: 120.5,
    remainingPotentialInterest: 890,
    projectedFullTermCost: 27_400,
    nextInterestGuaranteeDate: "2026-08-15T00:00:00.000Z",
    principalRepaid: 6_600,
    principalPercentRepaid: 26.4,
    amountRepaid: 7_120,
    percentRepaid: 26,
    totalRepaymentObligation: 27_400,
    interestRateLabel: "7.5%",
    includesAccruedInterest: true,
    riskStatusLabel: "Performing",
    paymentStatusLabel: "Current",
    lastPaymentAt: "2026-07-01T14:00:00.000Z",
    nextInterestAccrualAt: "2026-08-01T00:00:00.000Z",
    interestGuaranteeSchedule: [],
    paymentSchedule: [],
    termMonths: 12,
    monthlyPrincipalPercent: null,
    updatedAt: "2026-07-20T12:00:00.000Z",
    ...patch,
  };
}

export const UI_LAB_LOAN_CATALOG: InternalActiveLoanRow[] = [
  baseLoan({
    id: UI_LAB_LOAN_ACTIVE_ID,
    status: "ACTIVE",
    statusLabel: "Active",
  }),
  baseLoan({
    id: UI_LAB_LOAN_PAID_ID,
    status: "PAID_OFF",
    statusLabel: "Paid off",
    principalOutstanding: 0,
    accruedInterest: 0,
    currentPayoffAmount: 0,
    outstandingBalance: 0,
    guaranteedInterestOwed: 0,
    remainingPotentialInterest: 0,
    principalRepaid: 25_000,
    principalPercentRepaid: 100,
    amountRepaid: 26_800,
    percentRepaid: 100,
    paymentStatusLabel: "Paid in full",
    paymentSchedule: [],
    nextInterestGuaranteeDate: null,
  }),
  baseLoan({
    id: UI_LAB_LOAN_COMPANY_ID,
    status: "ACTIVE",
    statusLabel: "Active",
    productLabel: "Business Credit Line",
    productType: "business_credit_line",
    borrowerLabel: "Alta Group N.V.",
    companyName: "Alta Group N.V.",
    linkedAccountNumber: "AB-5000-100020",
    linkedBankAccountId: "BA-LAB-ALTG-OP",
    principalAmount: 150_000,
    principalOutstanding: 112_000,
    currentPayoffAmount: 113_250,
    outstandingBalance: 113_250,
  }),
];

export function listUiLabInternalLoans(): InternalActiveLoanRow[] {
  return UI_LAB_LOAN_CATALOG;
}

export function getUiLabInternalLoanDetail(loanId: string): InternalActiveLoanRow | null {
  return UI_LAB_LOAN_CATALOG.find((loan) => loan.id === loanId) ?? null;
}

export function listUiLabCanonicalLoanIds(): string[] {
  return UI_LAB_LOAN_CATALOG.map((loan) => loan.id);
}

export function listUiLabCompanyLoanIds(companyId: string): string[] {
  if (companyId !== UI_LAB_CORE_COMPANY_ID) return [];
  return [UI_LAB_LOAN_COMPANY_ID];
}
