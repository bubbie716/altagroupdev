import type {
  LoanApplicationStatus as DbLoanApplicationStatus,
  LoanApplicationThreadStatus as DbLoanApplicationThreadStatus,
  LoanInterestScheduleStatus as DbLoanInterestScheduleStatus,
  LoanLedgerEntryType as DbLoanLedgerEntryType,
  LoanPaymentStatus as DbLoanPaymentStatus,
  LoanProductType as DbLoanProductType,
  LoanScheduleInstallmentStatus as DbLoanScheduleInstallmentStatus,
  LoanStatus as DbLoanStatus,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type {
  InternalLoanApplicationRow,
  InternalActiveLoanRow,
  LoanApplicationRow,
  LoanApplicationStatusCode,
  LoanDetailRow,
  LoanInterestScheduleItemRow,
  LoanInterestScheduleStatusCode,
  LoanLedgerEntryRow,
  LoanLedgerEntryTypeCode,
  LoanPaymentRow,
  LoanPaymentStatusCode,
  LoanProductTypeCode,
  LoanRow,
  LoanScheduleInstallmentStatusCode,
  LoanScheduleItemRow,
  LoanStatusCode,
} from "@/lib/bank/lending-types";
import type { LoanApplicationThreadStatusCode } from "@/lib/bank/loan-application-thread-types";
import { computeLoanTermEstimate, LOAN_PRODUCT_LABELS } from "@/lib/bank/lending-types";
import {
  calculateCurrentPayoff,
  computePrincipalRepaymentProgress,
  summarizeInterestSchedule,
} from "@/lib/bank/loan-interest-service";
import {
  buildRepaymentScheduleWithInterest,
  findNextDueInstallment,
  formatNextPaymentDueLabel,
  monthlyPrincipalPercent,
  resolveScheduleItemStatus,
  type LoanScheduleInstallmentDraft,
} from "@/lib/bank/loan-payment-schedule";
import { addMonths } from "@/lib/bank/loan-interest";
import { formatDueDate } from "@/lib/format-datetime";
import { formatInterestRateLabel, type LoanRateType } from "@/lib/bank/loan-interest";
import { canUserPayLoan } from "@/lib/bank/loan-permissions";
import { userWithMembershipsInclude } from "@/server/user-mapper";

const PRODUCT_TYPE_TO_DB: Record<LoanProductTypeCode, DbLoanProductType> = {
  personal_credit_line: "PERSONAL_CREDIT_LINE",
  business_credit_line: "BUSINESS_CREDIT_LINE",
  private_liquidity_line: "PRIVATE_LIQUIDITY_LINE",
};

const PRODUCT_TYPE_FROM_DB: Record<DbLoanProductType, LoanProductTypeCode> = {
  PERSONAL_CREDIT_LINE: "personal_credit_line",
  BUSINESS_CREDIT_LINE: "business_credit_line",
  PRIVATE_LIQUIDITY_LINE: "private_liquidity_line",
};

const APPLICATION_STATUS_FROM_DB: Record<DbLoanApplicationStatus, LoanApplicationStatusCode> = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  DENIED: "denied",
  CANCELLED: "cancelled",
};

const LOAN_STATUS_FROM_DB: Record<DbLoanStatus, LoanStatusCode> = {
  ACTIVE: "active",
  PAID_OFF: "paid_off",
  DEFAULTED: "defaulted",
  CANCELLED: "cancelled",
  FROZEN: "frozen",
};

const LEDGER_TYPE_FROM_DB: Record<DbLoanLedgerEntryType, LoanLedgerEntryTypeCode> = {
  DISBURSEMENT: "disbursement",
  PAYMENT: "payment",
  INTEREST_CHARGE: "interest_charge",
  ADJUSTMENT: "adjustment",
  STATUS_CHANGE: "status_change",
};

const LEDGER_TYPE_LABELS: Record<LoanLedgerEntryTypeCode, string> = {
  disbursement: "Disbursement",
  payment: "Payment",
  interest_charge: "Interest charge",
  adjustment: "Adjustment",
  status_change: "Status change",
};

const PAYMENT_STATUS_FROM_DB: Record<DbLoanPaymentStatus, LoanPaymentStatusCode> = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export function toDbLoanProductType(type: LoanProductTypeCode): DbLoanProductType {
  return PRODUCT_TYPE_TO_DB[type];
}

export function fromDbLoanProductType(type: DbLoanProductType): LoanProductTypeCode {
  return PRODUCT_TYPE_FROM_DB[type];
}

function formatApplicationStatusLabel(status: LoanApplicationStatusCode): string {
  const labels: Record<LoanApplicationStatusCode, string> = {
    pending: "Pending",
    under_review: "Under Review",
    approved: "Approved",
    denied: "Denied",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function formatLoanStatusLabel(status: LoanStatusCode): string {
  const labels: Record<LoanStatusCode, string> = {
    active: "Active",
    paid_off: "Paid Off",
    defaulted: "Defaulted",
    cancelled: "Cancelled",
    frozen: "Frozen",
  };
  return labels[status];
}

function formatPaymentStatusLabel(status: LoanPaymentStatusCode): string {
  const labels: Record<LoanPaymentStatusCode, string> = {
    pending: "Pending",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

function accountLabel(account: { accountName: string; accountNumber: string } | null | undefined): string | null {
  if (!account) return null;
  return `${account.accountName} · ${account.accountNumber}`;
}

export const loanApplicationInclude = {
  applicantUser: { select: { id: true, discordUsername: true } },
  company: { select: { id: true, name: true, verificationStatus: true } },
  linkedBankAccount: { select: { id: true, accountName: true, accountNumber: true, status: true } },
  dealRoom: { select: { id: true } },
  thread: { select: { id: true, status: true } },
} as const satisfies Prisma.LoanApplicationInclude;

const THREAD_STATUS_FROM_DB: Record<DbLoanApplicationThreadStatus, LoanApplicationThreadStatusCode> = {
  OPEN: "open",
  WAITING_ON_APPLICANT: "waiting_on_applicant",
  WAITING_ON_ALTA: "waiting_on_alta",
  CLOSED: "closed",
};

export const loanApplicationReviewInclude = {
  applicantUser: { include: userWithMembershipsInclude },
  company: { select: { id: true, name: true, verificationStatus: true } },
  linkedBankAccount: { select: { id: true, accountName: true, accountNumber: true, status: true } },
  loan: { select: { id: true } },
} as const satisfies Prisma.LoanApplicationInclude;

type LoanApplicationRecord = Prisma.LoanApplicationGetPayload<{ include: typeof loanApplicationInclude }>;

export function mapLoanApplicationRow(record: LoanApplicationRecord): LoanApplicationRow {
  const productType = fromDbLoanProductType(record.productType);
  const status = APPLICATION_STATUS_FROM_DB[record.status];
  const requestedAmount = decimalToNumber(record.requestedAmount);
  const termMonths = record.termMonths;
  const estimate = computeLoanTermEstimate(productType, requestedAmount, termMonths);
  return {
    id: record.id,
    productType,
    productLabel: LOAN_PRODUCT_LABELS[productType],
    requestedAmount,
    termMonths,
    estimatedTotalOutstanding: estimate?.totalOutstanding ?? null,
    estimatedTotalInterest: estimate?.totalInterest ?? null,
    purpose: record.purpose,
    repaymentPlan: record.repaymentPlan,
    collateralDescription: record.collateralDescription,
    notes: record.notes,
    status,
    statusLabel: formatApplicationStatusLabel(status),
    reviewNote: record.reviewNote,
    companyId: record.companyId,
    companyName: record.company?.name ?? null,
    linkedBankAccountId: record.linkedBankAccountId,
    linkedAccountLabel: accountLabel(record.linkedBankAccount),
    submittedAt: record.createdAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    threadId: record.thread?.id ?? null,
    threadStatus: record.thread ? THREAD_STATUS_FROM_DB[record.thread.status] : null,
  };
}

export function mapInternalLoanApplicationRow(record: LoanApplicationRecord): InternalLoanApplicationRow {
  const base = mapLoanApplicationRow(record);
  return {
    ...base,
    applicantUserId: record.applicantUserId,
    applicantLabel: record.company?.name
      ? `${record.applicantUser.discordUsername} · ${record.company.name}`
      : record.applicantUser.discordUsername,
    linkedAccountNumber: record.linkedBankAccount?.accountNumber ?? null,
    dealRoomId: record.dealRoom?.id ?? null,
    threadId: record.thread?.id ?? null,
  };
}

const SCHEDULE_STATUS_FROM_DB: Record<DbLoanScheduleInstallmentStatus, LoanScheduleInstallmentStatusCode> = {
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  FAILED: "failed",
};

const SCHEDULE_STATUS_LABELS: Record<LoanScheduleInstallmentStatusCode, string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  failed: "Failed",
};

const INTEREST_SCHEDULE_STATUS_FROM_DB: Record<
  DbLoanInterestScheduleStatus,
  LoanInterestScheduleStatusCode
> = {
  PENDING: "pending",
  GUARANTEED: "guaranteed",
  PAID: "paid",
  WAIVED: "waived",
};

const INTEREST_SCHEDULE_STATUS_LABELS: Record<LoanInterestScheduleStatusCode, string> = {
  pending: "Pending",
  guaranteed: "Guaranteed",
  paid: "Paid",
  waived: "Waived",
};

function formatScheduleStatusLabel(status: LoanScheduleInstallmentStatusCode): string {
  return SCHEDULE_STATUS_LABELS[status];
}

const loanInclude = {
  borrowerUser: { select: { discordUsername: true } },
  company: { select: { id: true, name: true } },
  linkedBankAccount: { select: { id: true, accountName: true, accountNumber: true } },
  autoPaySourceBankAccount: { select: { id: true, accountName: true, accountNumber: true } },
  loanApplication: { select: { applicantUserId: true } },
  payments: { orderBy: { paymentDate: "desc" as const } },
  paymentSchedule: { orderBy: { installmentNumber: "asc" as const } },
  interestSchedule: { orderBy: { installmentNumber: "asc" as const } },
} as const satisfies Prisma.LoanInclude;

const loanDetailInclude = {
  borrowerUser: { select: { discordUsername: true } },
  company: { select: { id: true, name: true } },
  linkedBankAccount: { select: { id: true, accountName: true, accountNumber: true } },
  autoPaySourceBankAccount: { select: { id: true, accountName: true, accountNumber: true } },
  loanApplication: { select: { applicantUserId: true } },
  payments: { orderBy: { paymentDate: "desc" as const } },
  paymentSchedule: { orderBy: { installmentNumber: "asc" as const } },
  interestSchedule: { orderBy: { installmentNumber: "asc" as const } },
  ledgerEntries: { orderBy: { createdAt: "desc" as const } },
} as const satisfies Prisma.LoanInclude;

const internalLoanInclude = {
  borrowerUser: { select: { discordUsername: true } },
  company: { select: { name: true } },
  linkedBankAccount: { select: { accountNumber: true } },
  payments: { orderBy: { paymentDate: "desc" as const } },
  paymentSchedule: { orderBy: { installmentNumber: "asc" as const } },
  interestSchedule: { orderBy: { installmentNumber: "asc" as const } },
} as const satisfies Prisma.LoanInclude;

type LoanRecord = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;
type LoanDetailRecord = Prisma.LoanGetPayload<{ include: typeof loanDetailInclude }>;

function borrowerLabelForLoan(record: {
  company: { name: string } | null;
  borrowerUser: { discordUsername: string } | null;
}): string | null {
  if (record.company) return record.company.name;
  return record.borrowerUser?.discordUsername ?? null;
}

function sumCompletedLoanPayments(
  payments: { amount: Prisma.Decimal | number; status: DbLoanPaymentStatus }[],
): number {
  return payments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);
}

function mapLoanRepaymentFields(
  principalAmount: number,
  principalOutstanding: number,
  accruedInterest: number,
  payments: { amount: Prisma.Decimal | number; status: DbLoanPaymentStatus }[] = [],
  scheduleItems: LoanScheduleItemRow[] = [],
  interestScheduleSummary?: ReturnType<typeof summarizeInterestSchedule>,
) {
  const { principalRepaid, principalPercentRepaid } = computePrincipalRepaymentProgress(
    principalAmount,
    principalOutstanding,
  );
  const guaranteedInterestOwed = interestScheduleSummary?.guaranteedUnpaidInterest ?? accruedInterest;
  const currentPayoffAmount = calculateCurrentPayoff({
    principalOutstanding,
    accruedInterest: guaranteedInterestOwed,
  });
  const remainingPotentialInterest =
    interestScheduleSummary?.pendingFutureInterest ?? 0;
  const projectedFullTermCost =
    interestScheduleSummary?.projectedFullTermCost ??
    roundCurrency(principalAmount + remainingPotentialInterest + guaranteedInterestOwed);
  const estimatedFutureInterest = remainingPotentialInterest;
  const estimatedScheduleRemaining = Math.round(
    scheduleItems
      .filter((item) => item.status !== "paid")
      .reduce((sum, item) => sum + item.scheduledAmount, 0) * 100,
  ) / 100;
  const amountRepaid = sumCompletedLoanPayments(payments);
  const nextInstallment = findNextDueInstallment(scheduleItems);
  const nextPaymentDueLabel = formatNextPaymentDueLabel(nextInstallment, formatDueDate);

  return {
    principalRepaid,
    principalPercentRepaid,
    guaranteedInterestOwed,
    currentPayoffAmount,
    remainingPotentialInterest,
    projectedFullTermCost,
    estimatedFutureInterest,
    estimatedScheduleRemaining,
    amountRepaid,
    percentRepaid: principalPercentRepaid,
    totalRepaymentObligation: principalAmount,
    nextPaymentDueLabel,
    includesAccruedInterest: guaranteedInterestOwed > 0,
    accruedInterestAmount: guaranteedInterestOwed,
  };
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function mapLoanInterestScheduleItemRow(
  record: Prisma.LoanInterestScheduleItemGetPayload<object>,
): LoanInterestScheduleItemRow {
  const status = INTEREST_SCHEDULE_STATUS_FROM_DB[record.status];
  const interestAmount = decimalToNumber(record.interestAmount);
  const paidAmount = decimalToNumber(record.paidAmount);
  return {
    id: record.id,
    installmentNumber: record.installmentNumber,
    guaranteeDate: record.guaranteeDate.toISOString(),
    interestAmount,
    paidAmount,
    unpaidAmount: roundCurrency(Math.max(0, interestAmount - paidAmount)),
    status,
    statusLabel: INTEREST_SCHEDULE_STATUS_LABELS[status],
    paidAt: record.paidAt?.toISOString() ?? null,
  };
}

export function mapLoanScheduleItemRow(
  record: Prisma.LoanPaymentScheduleItemGetPayload<object>,
  termMonths: number | null,
  draft?: Pick<LoanScheduleInstallmentDraft, "principalPortion" | "interestPortion">,
  now = new Date(),
): LoanScheduleItemRow {
  const baseStatus = SCHEDULE_STATUS_FROM_DB[record.status];
  const status = resolveScheduleItemStatus(baseStatus, record.dueDate, now);
  const scheduledAmount = decimalToNumber(record.scheduledAmount);
  return {
    id: record.id,
    installmentNumber: record.installmentNumber,
    dueDate: record.dueDate.toISOString(),
    scheduledAmount,
    principalPortion: draft?.principalPortion ?? scheduledAmount,
    interestPortion: draft?.interestPortion ?? 0,
    principalPercent: monthlyPrincipalPercent(termMonths ?? 0),
    status,
    statusLabel: formatScheduleStatusLabel(status),
  };
}

function buildScheduleDraftsForLoan(record: {
  principalAmount: Prisma.Decimal;
  termMonths: number | null;
  interestRate: Prisma.Decimal;
  interestRateType: string;
  nextInterestAccrualAt: Date | null;
  approvedAt: Date;
}): LoanScheduleInstallmentDraft[] {
  if (!record.termMonths || record.termMonths <= 0) return [];
  const rateType: LoanRateType =
    record.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  const firstDueDate = record.nextInterestAccrualAt ?? addMonths(record.approvedAt, 1);
  return buildRepaymentScheduleWithInterest(
    decimalToNumber(record.principalAmount),
    record.termMonths,
    firstDueDate,
    decimalToNumber(record.interestRate),
    rateType,
  );
}

export function mapLoanLedgerEntryRow(
  record: Prisma.LoanLedgerEntryGetPayload<object>,
): LoanLedgerEntryRow {
  const type = LEDGER_TYPE_FROM_DB[record.type as DbLoanLedgerEntryType];
  return {
    id: record.id,
    type,
    typeLabel: LEDGER_TYPE_LABELS[type],
    amount: decimalToNumber(record.amount),
    balanceAfter: decimalToNumber(record.balanceAfter),
    description: record.description,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapLoanCoreFields(
  record: LoanRecord & {
    lastInterestAccruedAt?: Date | null;
    nextInterestAccrualAt?: Date | null;
    loanApplication?: { applicantUserId: string } | null;
    paymentSchedule?: Prisma.LoanPaymentScheduleItemGetPayload<object>[];
    interestSchedule?: Prisma.LoanInterestScheduleItemGetPayload<object>[];
    autoPaySourceBankAccount?: {
      id: string;
      accountName: string;
      accountNumber: string;
    } | null;
  },
  user?: AltaUser,
) {
  const productType = fromDbLoanProductType(record.productType);
  const status = LOAN_STATUS_FROM_DB[record.status];
  const interestRate = decimalToNumber(record.interestRate);
  const rateType: LoanRateType =
    record.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  const principalAmount = decimalToNumber(record.principalAmount);
  const principalOutstanding = decimalToNumber(record.principalOutstanding);
  const accruedInterest = decimalToNumber(record.accruedInterest);
  const termMonths = record.termMonths ?? null;
  const scheduleDrafts = buildScheduleDraftsForLoan(record);
  const paymentSchedule = (record.paymentSchedule ?? []).map((item) => {
    const draft = scheduleDrafts.find(
      (entry) => entry.installmentNumber === item.installmentNumber,
    );
    return mapLoanScheduleItemRow(item, termMonths, draft);
  });
  const interestGuaranteeSchedule = (record.interestSchedule ?? []).map(mapLoanInterestScheduleItemRow);
  const interestSummary =
    interestGuaranteeSchedule.length > 0
      ? summarizeInterestSchedule(principalAmount, record.interestSchedule ?? [])
      : undefined;
  const guaranteedInterestOwed = interestSummary?.guaranteedUnpaidInterest ?? accruedInterest;
  const currentPayoffAmount = calculateCurrentPayoff({
    principalOutstanding,
    accruedInterest: guaranteedInterestOwed,
  });
  const applicantUserId = record.loanApplication?.applicantUserId ?? undefined;

  const canMakePayment = user
    ? canUserPayLoan(user, {
        borrowerUserId: record.borrowerUserId,
        companyId: record.companyId,
        applicantUserId,
      }) && status === "active"
    : false;

  return {
    id: record.id,
    productType,
    productLabel: LOAN_PRODUCT_LABELS[productType],
    principalAmount,
    principalOutstanding,
    guaranteedInterestOwed,
    accruedInterest: guaranteedInterestOwed,
    currentPayoffAmount,
    outstandingBalance: currentPayoffAmount,
    remainingPotentialInterest: interestSummary?.pendingFutureInterest ?? 0,
    projectedFullTermCost:
      interestSummary?.projectedFullTermCost ??
      roundCurrency(principalAmount + guaranteedInterestOwed),
    ...mapLoanRepaymentFields(
      principalAmount,
      principalOutstanding,
      accruedInterest,
      record.payments ?? [],
      paymentSchedule,
      interestSummary,
    ),
    interestRate,
    interestRateType: rateType,
    interestRateLabel: formatInterestRateLabel(interestRate, rateType),
    status,
    statusLabel: formatLoanStatusLabel(status),
    borrowerLabel: borrowerLabelForLoan(record),
    companyId: record.companyId,
    companyName: record.company?.name ?? null,
    linkedBankAccountId: record.linkedBankAccountId,
    linkedAccountLabel: accountLabel(record.linkedBankAccount),
    approvedAt: record.approvedAt.toISOString(),
    nextInterestAccrualAt: record.nextInterestAccrualAt?.toISOString() ?? null,
    nextInterestGuaranteeDate: interestSummary?.nextInterestGuaranteeDate ?? null,
    lastInterestAccrualAt: record.lastInterestAccruedAt?.toISOString() ?? null,
    termMonths,
    monthlyPrincipalPercent: termMonths ? monthlyPrincipalPercent(termMonths) : null,
    paymentSchedule,
    interestGuaranteeSchedule,
    autoPay: {
      enabled: record.autoPayEnabled,
      sourceBankAccountId: record.autoPaySourceBankAccountId,
      sourceAccountLabel: accountLabel(record.autoPaySourceBankAccount),
    },
    canMakePayment,
  };
}

export function mapLoanPaymentRow(
  record: Prisma.LoanPaymentGetPayload<object>,
): LoanPaymentRow {
  const status = PAYMENT_STATUS_FROM_DB[record.status];
  return {
    id: record.id,
    amount: decimalToNumber(record.amount),
    paymentDate: record.paymentDate.toISOString(),
    status,
    statusLabel: formatPaymentStatusLabel(status),
  };
}

export function mapLoanRow(record: LoanRecord, user?: AltaUser): LoanRow {
  return {
    ...mapLoanCoreFields(record, user),
    recentPayments: record.payments.slice(0, 5).map(mapLoanPaymentRow),
  };
}

export function mapLoanDetailRow(record: LoanDetailRecord, user?: AltaUser): LoanDetailRow {
  const base = mapLoanRow({ ...record, payments: record.payments.slice(0, 5) }, user);
  return {
    ...base,
    payments: record.payments.map(mapLoanPaymentRow),
    ledgerEntries: record.ledgerEntries.map(mapLoanLedgerEntryRow),
  };
}

export function mapInternalActiveLoanRow(
  record: Prisma.LoanGetPayload<{ include: typeof internalLoanInclude }>,
): InternalActiveLoanRow {
  const productType = fromDbLoanProductType(record.productType);
  const status = LOAN_STATUS_FROM_DB[record.status];
  const principalAmount = decimalToNumber(record.principalAmount);
  const principalOutstanding = decimalToNumber(record.principalOutstanding);
  const accruedInterest = decimalToNumber(record.accruedInterest);
  const interestRate = decimalToNumber(record.interestRate);
  const rateType: LoanRateType =
    record.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  const interestGuaranteeSchedule = (record.interestSchedule ?? []).map(mapLoanInterestScheduleItemRow);
  const interestSummary =
    interestGuaranteeSchedule.length > 0
      ? summarizeInterestSchedule(principalAmount, record.interestSchedule ?? [])
      : undefined;
  const guaranteedInterestOwed = interestSummary?.guaranteedUnpaidInterest ?? accruedInterest;
  const currentPayoffAmount = calculateCurrentPayoff({
    principalOutstanding,
    accruedInterest: guaranteedInterestOwed,
  });
  const borrowerLabel =
    record.company?.name ?? record.borrowerUser?.discordUsername ?? "Unknown borrower";

  const paymentSchedule = (record.paymentSchedule ?? []).map((item) => {
    const draft = buildScheduleDraftsForLoan(record).find(
      (entry) => entry.installmentNumber === item.installmentNumber,
    );
    return mapLoanScheduleItemRow(item, record.termMonths, draft);
  });

  return {
    id: record.id,
    productLabel: LOAN_PRODUCT_LABELS[productType],
    borrowerLabel,
    companyName: record.company?.name ?? null,
    linkedAccountNumber: record.linkedBankAccount?.accountNumber ?? null,
    linkedBankAccountId: record.linkedBankAccountId,
    principalAmount,
    principalOutstanding,
    guaranteedInterestOwed,
    accruedInterest: guaranteedInterestOwed,
    currentPayoffAmount,
    outstandingBalance: currentPayoffAmount,
    remainingPotentialInterest: interestSummary?.pendingFutureInterest ?? 0,
    projectedFullTermCost:
      interestSummary?.projectedFullTermCost ??
      roundCurrency(principalAmount + guaranteedInterestOwed),
    nextInterestGuaranteeDate: interestSummary?.nextInterestGuaranteeDate ?? null,
    interestGuaranteeSchedule,
    ...mapLoanRepaymentFields(
      principalAmount,
      principalOutstanding,
      accruedInterest,
      record.payments ?? [],
      paymentSchedule,
      interestSummary,
    ),
    interestRateLabel: formatInterestRateLabel(interestRate, rateType),
    status,
    statusLabel: formatLoanStatusLabel(status),
    riskStatusLabel: "Coming Soon",
    paymentStatusLabel: "Coming Soon",
    lastPaymentAt: record.payments[0]?.paymentDate.toISOString() ?? null,
    nextInterestAccrualAt: record.nextInterestAccrualAt?.toISOString() ?? null,
    paymentSchedule,
    termMonths: record.termMonths,
    monthlyPrincipalPercent: null,
  };
}

export { loanInclude, loanDetailInclude, internalLoanInclude };

export { formatApplicationStatusLabel, formatLoanStatusLabel };
