/**
 * Canonical UI Lab lending fixtures — list and detail share the same IDs.
 * Demonstration only; never writes to Prisma.
 */
import type {
  CompanyLendingOption,
  InternalActiveLoanRow,
  InternalLoanApplicationRow,
  LendingAccountOption,
  LoanApplicationRow,
  LoanRow,
} from "@/lib/bank/lending-types";
import type {
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
} from "@/lib/bank/loan-application-thread-types";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";
import { normalizeLoanStatus } from "@/lib/bank/lending-loans-display";

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

/** Customer-facing loan rows use the same canonical records as the internal desk. */
export function listUiLabUserLoans(): LoanRow[] {
  return UI_LAB_LOAN_CATALOG.map((loan) => {
    const status = normalizeLoanStatus(loan.status);
    return {
    id: loan.id,
    productType: loan.productType,
    productLabel: loan.productLabel,
    principalAmount: loan.principalAmount,
    principalOutstanding: loan.principalOutstanding,
    guaranteedInterestOwed: loan.guaranteedInterestOwed,
    accruedInterest: loan.accruedInterest,
    currentPayoffAmount: loan.currentPayoffAmount,
    outstandingBalance: loan.outstandingBalance,
    remainingPotentialInterest: loan.remainingPotentialInterest,
    projectedFullTermCost: loan.projectedFullTermCost,
    estimatedFutureInterest: loan.remainingPotentialInterest,
    principalRepaid: loan.principalRepaid,
    principalPercentRepaid: loan.principalPercentRepaid,
    estimatedScheduleRemaining: loan.paymentSchedule.reduce(
      (sum, installment) => sum + installment.remainingAmount,
      0,
    ),
    amountRepaid: loan.amountRepaid,
    percentRepaid: loan.percentRepaid,
    totalRepaymentObligation: loan.totalRepaymentObligation,
    nextPaymentDueLabel: "—",
    nextPaymentDueAmount: null,
    interestRate: Number.parseFloat(loan.interestRateLabel) || 0,
    interestRateType: "MONTHLY_PERCENT",
    interestRateLabel: loan.interestRateLabel,
    status,
    statusLabel: loan.statusLabel,
    borrowerLabel: loan.borrowerLabel,
    companyId: loan.companyName ? UI_LAB_CORE_COMPANY_ID : null,
    companyName: loan.companyName,
    linkedBankAccountId: loan.linkedBankAccountId,
    linkedAccountLabel: loan.linkedAccountNumber,
    approvedAt: loan.updatedAt,
    includesAccruedInterest: loan.includesAccruedInterest,
    nextInterestAccrualAt: loan.nextInterestAccrualAt,
    nextInterestGuaranteeDate: loan.nextInterestGuaranteeDate,
    lastInterestAccrualAt: loan.lastPaymentAt,
    accruedInterestAmount: loan.accruedInterest,
    canMakePayment: status === "active" && loan.currentPayoffAmount > 0,
    termMonths: loan.termMonths,
    monthlyPrincipalPercent: loan.monthlyPrincipalPercent,
    paymentSchedule: loan.paymentSchedule,
    interestGuaranteeSchedule: loan.interestGuaranteeSchedule,
    autoPay: {
      enabled: false,
      sourceBankAccountId: null,
      sourceAccountLabel: null,
    },
    recentPayments: [],
    };
  });
}

export function getUiLabUserLoan(loanId: string): LoanRow | null {
  return listUiLabUserLoans().find((loan) => loan.id === loanId) ?? null;
}

export function listUiLabUserLoanApplications(): LoanApplicationRow[] {
  return [UI_LAB_APP_FTLCEO_1, UI_LAB_APP_FTLCEO_2].map((id) => {
    const application = getUiLabInternalLoanApplication(id)!;
    return {
      id: application.id,
      productType: application.productType,
      productLabel: application.productLabel,
      requestedAmount: application.requestedAmount,
      termMonths: application.termMonths,
      estimatedTotalOutstanding: application.estimatedTotalOutstanding,
      estimatedTotalInterest: application.estimatedTotalInterest,
      purpose: application.purpose,
      repaymentPlan: application.repaymentPlan,
      collateralDescription: application.collateralDescription,
      notes: application.notes,
      status: application.status,
      statusLabel: application.statusLabel,
      reviewNote: application.reviewNote,
      companyId: application.companyId,
      companyName: application.companyName,
      linkedBankAccountId: application.linkedBankAccountId,
      linkedAccountLabel: application.linkedAccountLabel,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      threadId: application.threadId,
      threadStatus: application.threadStatus,
    };
  });
}

export function getUiLabLendingFormContext(): {
  accounts: LendingAccountOption[];
  companies: CompanyLendingOption[];
} {
  return {
    accounts: [
      {
        id: "BA-LAB-CHK",
        label: "Carter — Everyday Checking",
        accountNumber: "AB-2000-100002",
        companyId: null,
        companyName: null,
      },
      {
        id: "BA-LAB-ALTG-OP",
        label: "Alta Group — Operating",
        accountNumber: "AB-5000-100020",
        companyId: UI_LAB_CORE_COMPANY_ID,
        companyName: "Alta Group N.V.",
      },
    ],
    companies: [
      {
        companyId: UI_LAB_CORE_COMPANY_ID,
        companyName: "Alta Group N.V.",
        operatingAccountId: "BA-LAB-ALTG-OP",
      },
    ],
  };
}

export function listUiLabCanonicalLoanIds(): string[] {
  return UI_LAB_LOAN_CATALOG.map((loan) => loan.id);
}

export function listUiLabCompanyLoanIds(companyId: string): string[] {
  if (companyId !== UI_LAB_CORE_COMPANY_ID) return [];
  return [UI_LAB_LOAN_COMPANY_ID];
}

/** Copilot / deal-room UI Lab application ids (read-only; never written to Prisma). */
export const UI_LAB_APP_FTLCEO_1 = "ui-lab-app-ftlceo-1";
export const UI_LAB_APP_FTLCEO_2 = "ui-lab-app-ftlceo-2";

function uiLabApplication(
  id: string,
  patch: Partial<InternalLoanApplicationRow> = {},
): InternalLoanApplicationRow {
  return {
    id,
    productType: "personal_credit_line",
    productLabel: "Personal Credit Line",
    requestedAmount: 25_000,
    termMonths: 12,
    estimatedTotalOutstanding: 27_400,
    estimatedTotalInterest: 2_400,
    purpose: "Working capital",
    repaymentPlan: "Monthly principal + interest",
    collateralDescription: null,
    notes: null,
    status: "pending",
    statusLabel: "Pending review",
    reviewNote: null,
    companyId: null,
    companyName: null,
    linkedBankAccountId: "BA-LAB-CHK",
    linkedAccountLabel: "AB-2000-100002 · Checking",
    linkedAccountNumber: "AB-2000-100002",
    submittedAt: "2026-07-20T12:00:00.000Z",
    reviewedAt: null,
    threadId: `thread-${id}`,
    threadStatus: "open",
    applicantUserId: "ui-lab-user-ftlceo",
    applicantLabel: "FTLCEO",
    dealRoomId: id.replace("ui-lab-app-", "ui-lab-deal-"),
    ...patch,
  };
}

const UI_LAB_APPLICATION_CATALOG: InternalLoanApplicationRow[] = [
  uiLabApplication(UI_LAB_APP_FTLCEO_1),
  uiLabApplication(UI_LAB_APP_FTLCEO_2, {
    productType: "business_credit_line",
    productLabel: "Business Credit Line",
    requestedAmount: 100_000,
    status: "under_review",
    statusLabel: "Underwriting",
    companyId: UI_LAB_CORE_COMPANY_ID,
    companyName: "Alta Group N.V.",
    linkedBankAccountId: "BA-LAB-ALTG-OP",
    linkedAccountLabel: "AB-5000-100020 · Operating",
    linkedAccountNumber: "AB-5000-100020",
  }),
];

export function getUiLabInternalLoanApplication(
  applicationId: string,
): InternalLoanApplicationRow | null {
  return UI_LAB_APPLICATION_CATALOG.find((row) => row.id === applicationId) ?? null;
}

export function getUiLabInternalLoanApplicationThread(applicationId: string): {
  context: LoanApplicationThreadContext;
  messages: LoanApplicationThreadMessageRow[];
} | null {
  const application = getUiLabInternalLoanApplication(applicationId);
  if (!application) return null;
  return {
    context: {
      threadId: application.threadId ?? `thread-${applicationId}`,
      applicationId,
      viewerUserId: "ui-lab-user",
      status: "open",
      statusLabel: "Waiting on Alta",
      assignedStaffId: null,
      assignedStaffName: null,
      canSend: false,
      applicantUserId: application.applicantUserId,
      applicantName: application.applicantLabel,
      applicantAvatarUrl: null,
      companyId: application.companyId,
      companyName: application.companyName,
      productLabel: application.productLabel,
      requestedAmount: application.requestedAmount,
      applicationStatus: application.status,
      applicationStatusLabel: application.statusLabel,
      submittedAt: application.submittedAt,
      submittedAtLabel: "Jul 20, 2026",
    },
    messages: [
      {
        id: `msg-${applicationId}-1`,
        senderUserId: application.applicantUserId,
        senderRole: "applicant",
        senderName: application.applicantLabel,
        senderAvatarUrl: null,
        body: "UI Lab deal-room thread — read-only fixture.",
        attachments: [],
        source: "website",
        createdAt: application.submittedAt,
        createdAtLabel: "Jul 20, 2026",
      },
    ],
  };
}
