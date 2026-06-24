import { randomBytes } from "node:crypto";
import type { LoanStatus as DbLoanStatus, Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canViewBusinessTreasury,
  isPrivateClient,
} from "@/lib/auth/permissions";
import { canUserPayLoan, canUserViewLoan } from "@/lib/bank/loan-permissions";
import { addMonths, computeMonthlyInterestCharge, type LoanRateType } from "@/lib/bank/loan-interest";
import { buildRepaymentScheduleWithInterest } from "@/lib/bank/loan-payment-schedule";
import type {
  AdminAdjustLoanInput,
  ApproveLoanApplicationInput,
  DenyLoanApplicationInput,
  InternalActiveLoanRow,
  LendingAccountOption,
  LoanDetailRow,
  LoanPaymentContext,
  LoanProductTypeCode,
  LoanRow,
  MakeLoanPaymentInput,
  SetLoanAutoPayInput,
} from "@/lib/bank/lending-types";
import { LOAN_PRODUCT_DEFAULT_MONTHLY_RATES } from "@/lib/bank/lending-types";
import type { LoanProductType as DbLoanProductType } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  loanApplicationReviewInclude,
  loanDetailInclude,
  loanInclude,
  internalLoanInclude,
  mapInternalActiveLoanRow,
  mapLoanDetailRow,
  mapLoanRow,
} from "@/server/lending-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toNumber(): number }): number {
  return value.toNumber();
}

const PRODUCT_TYPE_FROM_DB: Record<DbLoanProductType, LoanProductTypeCode> = {
  PERSONAL_CREDIT_LINE: "personal_credit_line",
  BUSINESS_CREDIT_LINE: "business_credit_line",
  PRIVATE_LIQUIDITY_LINE: "private_liquidity_line",
};

/** Old advertised monthly defaults → current product defaults. */
const LEGACY_MONTHLY_RATE_TO_CURRENT: Record<number, number> = {
  2.4: 7.5,
  1.85: 6,
};

const MAX_CATCH_UP_MONTHS = 120;

function generateReferenceCode(prefix: "LND" | "LNP" | "LNI"): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${suffix}`;
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function companyIdsWithTreasuryManage(user: AltaUser): string[] {
  return user.companyMemberships
    .filter((m) => canManageBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);
}

function companyIdsWithTreasuryView(user: AltaUser): string[] {
  return user.companyMemberships
    .filter((m) => canViewBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);
}

async function userLoanViewWhere(userId: string): Promise<Prisma.LoanWhereInput> {
  const user = await getAltaUser(userId);
  const manageCompanyIds = companyIdsWithTreasuryManage(user);
  const viewCompanyIds = companyIdsWithTreasuryView(user);
  const companyIds = [...new Set([...manageCompanyIds, ...viewCompanyIds])];
  const or: Prisma.LoanWhereInput[] = [
    { borrowerUserId: userId },
    { loanApplication: { applicantUserId: userId } },
  ];
  if (companyIds.length > 0) {
    or.push({ companyId: { in: companyIds } });
  }
  return { OR: or };
}

async function getLoanForUser(userId: string, loanId: string) {
  const record = await prisma.loan.findFirst({
    where: { id: loanId, ...(await userLoanViewWhere(userId)) },
    include: {
      loanApplication: { select: { applicantUserId: true } },
    },
  });
  if (!record) notFound();
  return record;
}

async function getAvailableBalance(accountId: string): Promise<number> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  const balance = decimalToNumber(account.balance);
  const pendingWithdrawals = await prisma.bankTransaction.aggregate({
    where: { bankAccountId: accountId, type: "WITHDRAWAL", status: "PENDING" },
    _sum: { amount: true },
  });
  const reserved = pendingWithdrawals._sum.amount
    ? decimalToNumber(pendingWithdrawals._sum.amount)
    : 0;
  return balance - reserved;
}

async function assertPaySourceAccount(
  userId: string,
  accountId: string,
  loan: { companyId: string | null },
): Promise<void> {
  const user = await getAltaUser(userId);
  const companyIds = new Set([
    ...companyIdsWithTreasuryManage(user),
    ...companyIdsWithTreasuryView(user),
    ...(await prisma.companyMembership.findMany({
      where: { userId },
      select: { companyId: true },
    })).map((m) => m.companyId),
  ]);

  const account = await prisma.bankAccount.findFirst({
    where: {
      id: accountId,
      status: "ACTIVE",
      OR: [{ userId }, { companyId: { in: [...companyIds] } }],
    },
  });
  if (!account) badRequest("Source bank account not found or not accessible");
  if (loan.companyId && account.companyId !== loan.companyId) {
    badRequest("Source account must belong to the loan company");
  }
  if (!loan.companyId && account.companyId) {
    badRequest("Personal loan payments must come from a personal Alta account");
  }
}

async function createLedgerEntry(
  tx: Prisma.TransactionClient,
  data: {
    loanId: string;
    type: "DISBURSEMENT" | "PAYMENT" | "INTEREST_CHARGE" | "ADJUSTMENT" | "STATUS_CHANGE";
    amount: number;
    balanceAfter: number;
    description: string;
    bankTransactionId?: string;
    createdById?: string;
  },
) {
  await tx.loanLedgerEntry.create({
    data: {
      loanId: data.loanId,
      type: data.type,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      description: data.description,
      bankTransactionId: data.bankTransactionId ?? null,
      createdById: data.createdById ?? null,
    },
  });
}

const PAYABLE_LOAN_STATUSES: DbLoanStatus[] = ["ACTIVE"];

interface ProcessLoanPaymentOptions {
  scheduleItemId?: string;
  isAutoPay?: boolean;
  memo?: string;
}

async function createLoanPaymentScheduleInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  principalAmount: number,
  termMonths: number,
  firstDueDate: Date,
  monthlyRatePercent: number,
  rateType: LoanRateType,
): Promise<void> {
  const installments = buildRepaymentScheduleWithInterest(
    principalAmount,
    termMonths,
    firstDueDate,
    monthlyRatePercent,
    rateType,
  );
  if (installments.length === 0) return;

  await tx.loanPaymentScheduleItem.createMany({
    data: installments.map((item) => ({
      loanId,
      installmentNumber: item.installmentNumber,
      dueDate: item.dueDate,
      scheduledAmount: item.scheduledAmount,
    })),
  });
}

async function syncLoanPaymentSchedule(loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan?.termMonths || loan.termMonths <= 0) return;

  const principalAmount = decimalToNumber(loan.principalAmount);
  const monthlyRatePercent = decimalToNumber(loan.interestRate);
  const rateType: LoanRateType =
    loan.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  const firstDueDate = loan.nextInterestAccrualAt ?? addMonths(loan.approvedAt, 1);
  const installments = buildRepaymentScheduleWithInterest(
    principalAmount,
    loan.termMonths,
    firstDueDate,
    monthlyRatePercent,
    rateType,
  );
  if (installments.length === 0) return;

  const existing = await prisma.loanPaymentScheduleItem.findMany({
    where: { loanId },
    orderBy: { installmentNumber: "asc" },
  });

  if (existing.length === 0) {
    await createLoanPaymentScheduleInTx(
      prisma,
      loanId,
      principalAmount,
      loan.termMonths,
      firstDueDate,
      monthlyRatePercent,
      rateType,
    );
    return;
  }

  await Promise.all(
    installments.map(async (draft) => {
      const row = existing.find((item) => item.installmentNumber === draft.installmentNumber);
      if (!row || row.status === "PAID") return;
      const current = decimalToNumber(row.scheduledAmount);
      if (Math.abs(current - draft.scheduledAmount) < 0.005) return;
      await prisma.loanPaymentScheduleItem.update({
        where: { id: row.id },
        data: { scheduledAmount: draft.scheduledAmount },
      });
    }),
  );
}

export async function ensureLoanPaymentSchedule(loanId: string): Promise<void> {
  await syncLoanPaymentSchedule(loanId);
}

function resolveLoanPaymentActorUserId(loan: {
  borrowerUserId: string | null;
  loanApplication: { applicantUserId: string };
}): string {
  return loan.borrowerUserId ?? loan.loanApplication.applicantUserId;
}

function toAutoPayFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.replace(/^BAD_REQUEST:/, "");
  if (/insufficient balance/i.test(msg)) return "Insufficient funds in source account.";
  if (/source bank account|account must be active|frozen/i.test(msg)) {
    return "Source account unavailable.";
  }
  return "Automatic payment could not be completed.";
}

export async function getUserLoans(userId: string): Promise<LoanRow[]> {
  const user = await getAltaUser(userId);
  const records = await prisma.loan.findMany({
    where: await userLoanViewWhere(userId),
    include: loanInclude,
    orderBy: { createdAt: "desc" },
  });

  await Promise.all(
    records.filter((loan) => loan.termMonths).map((loan) => ensureLoanPaymentSchedule(loan.id)),
  );

  const refreshed = records.length
    ? await prisma.loan.findMany({
        where: { id: { in: records.map((loan) => loan.id) } },
        include: loanInclude,
        orderBy: { createdAt: "desc" },
      })
    : [];

  return refreshed.map((r) => mapLoanRow(r, user));
}

export async function getLoanDetail(userId: string, loanId: string): Promise<LoanDetailRow> {
  const user = await getAltaUser(userId);
  const record = await prisma.loan.findFirst({
    where: { id: loanId, ...(await userLoanViewWhere(userId)) },
    include: loanDetailInclude,
  });
  if (!record) notFound();
  return mapLoanDetailRow(record, user);
}

export async function getLoanPaymentContext(userId: string, loanId: string): Promise<LoanPaymentContext> {
  const user = await getAltaUser(userId);
  const record = await prisma.loan.findFirst({
    where: { id: loanId, ...(await userLoanViewWhere(userId)) },
    include: loanInclude,
  });
  if (!record) notFound();
  const loan = mapLoanRow(record, user);
  const canMakePayment = loan.canMakePayment && loan.status === "active";

  const manageCompanyIds = companyIdsWithTreasuryManage(user);
  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      OR: loan.companyId
        ? [{ companyId: loan.companyId }]
        : [{ userId, companyId: null }],
    },
    include: { company: { select: { name: true } } },
    orderBy: { accountName: "asc" },
  });

  const filtered = loan.companyId
    ? accounts.filter((a) => manageCompanyIds.includes(a.companyId ?? ""))
    : accounts;

  return {
    loan,
    canMakePayment,
    sourceAccounts: filtered.map((a) => ({
      id: a.id,
      label: a.accountName,
      accountNumber: a.accountNumber,
      companyId: a.companyId,
      companyName: a.company?.name ?? null,
    })),
  };
}

export async function makeLoanPayment(userId: string, input: MakeLoanPaymentInput): Promise<void> {
  await processLoanPayment(userId, input);
}

async function processLoanPayment(
  actorUserId: string,
  input: MakeLoanPaymentInput,
  options: ProcessLoanPaymentOptions = {},
): Promise<void> {
  const user = await getAltaUser(actorUserId);
  const loanRecord = await prisma.loan.findUnique({
    where: { id: input.loanId },
    include: { loanApplication: { select: { applicantUserId: true } } },
  });
  if (!loanRecord) notFound();

  if (!options.isAutoPay) {
    const viewable = await prisma.loan.findFirst({
      where: { id: input.loanId, ...(await userLoanViewWhere(actorUserId)) },
      include: { loanApplication: { select: { applicantUserId: true } } },
    });
    if (!viewable) notFound();

    if (
      !canUserPayLoan(user, {
        borrowerUserId: loanRecord.borrowerUserId,
        companyId: loanRecord.companyId,
        applicantUserId: loanRecord.loanApplication.applicantUserId,
      })
    ) {
      forbidden();
    }
  }

  if (!PAYABLE_LOAN_STATUSES.includes(loanRecord.status)) {
    badRequest("Payments are not accepted for this loan status");
  }

  const amount = input.amount;
  if (amount <= 0) badRequest("Payment amount must be greater than zero");

  const outstanding = decimalToNumber(loanRecord.outstandingBalance);
  if (amount > outstanding) badRequest("Payment cannot exceed outstanding balance");

  await assertPaySourceAccount(actorUserId, input.sourceBankAccountId, loanRecord);

  const available = await getAvailableBalance(input.sourceBankAccountId);
  if (available < amount) badRequest("Insufficient available balance in source account");

  const now = new Date();
  const newBalance = Math.round((outstanding - amount) * 100) / 100;
  const paidOff = newBalance <= 0;
  const paymentMemo = options.memo ?? (input.memo?.trim() || null);

  await prisma.$transaction(async (tx) => {
    const referenceCode = generateReferenceCode("LNP");
    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: input.sourceBankAccountId,
        type: "LOAN_PAYMENT",
        amount,
        status: "APPROVED",
        description: `Loan payment · ${loanRecord.id.slice(0, 8)}`,
        memo: paymentMemo,
        referenceCode,
        reviewedAt: now,
      },
    });

    await tx.bankAccount.update({
      where: { id: input.sourceBankAccountId },
      data: { balance: { decrement: amount } },
    });

    let scheduleItemId = options.scheduleItemId;
    if (!scheduleItemId) {
      const nextItem = await tx.loanPaymentScheduleItem.findFirst({
        where: {
          loanId: loanRecord.id,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        orderBy: { installmentNumber: "asc" },
      });
      scheduleItemId = nextItem?.id;
    }

    const loanPayment = await tx.loanPayment.create({
      data: {
        loanId: loanRecord.id,
        amount,
        paymentDate: now,
        sourceBankAccountId: input.sourceBankAccountId,
        bankTransactionId: bankTx.id,
        scheduleItemId: scheduleItemId ?? null,
        memo: paymentMemo,
        status: "COMPLETED",
      },
    });

    if (scheduleItemId) {
      await tx.loanPaymentScheduleItem.update({
        where: { id: scheduleItemId },
        data: {
          status: "PAID",
          paidAt: now,
          autoPayFailureReason: null,
        },
      });
    }

    await tx.loan.update({
      where: { id: loanRecord.id },
      data: {
        outstandingBalance: newBalance,
        status: paidOff ? "PAID_OFF" : loanRecord.status,
        ...(paidOff ? { autoPayEnabled: false, autoPaySourceBankAccountId: null } : {}),
      },
    });

    await createLedgerEntry(tx, {
      loanId: loanRecord.id,
      type: "PAYMENT",
      amount: -amount,
      balanceAfter: newBalance,
      description: paymentMemo || (options.isAutoPay ? "Automatic loan payment" : "Loan payment"),
      bankTransactionId: bankTx.id,
      createdById: actorUserId,
    });

    if (paidOff) {
      await createLedgerEntry(tx, {
        loanId: loanRecord.id,
        type: "STATUS_CHANGE",
        amount: 0,
        balanceAfter: 0,
        description: "Loan paid off",
        createdById: actorUserId,
      });
      await tx.loanPaymentScheduleItem.updateMany({
        where: { loanId: loanRecord.id, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "PAID", paidAt: now },
      });
    }
  });
}

export async function setLoanAutoPay(userId: string, input: SetLoanAutoPayInput): Promise<void> {
  const user = await getAltaUser(userId);
  const loanRecord = await getLoanForUser(userId, input.loanId);

  if (
    !canUserPayLoan(user, {
      borrowerUserId: loanRecord.borrowerUserId,
      companyId: loanRecord.companyId,
      applicantUserId: loanRecord.loanApplication.applicantUserId,
    })
  ) {
    forbidden();
  }

  if (!PAYABLE_LOAN_STATUSES.includes(loanRecord.status)) {
    badRequest("Auto-pay is only available for active loans");
  }

  if (!input.enabled) {
    await prisma.loan.update({
      where: { id: loanRecord.id },
      data: { autoPayEnabled: false },
    });
    return;
  }

  if (!input.sourceBankAccountId) {
    badRequest("Select a source account for automatic payments");
  }

  await assertPaySourceAccount(userId, input.sourceBankAccountId, loanRecord);
  await ensureLoanPaymentSchedule(loanRecord.id);

  await prisma.loan.update({
    where: { id: loanRecord.id },
    data: {
      autoPayEnabled: true,
      autoPaySourceBankAccountId: input.sourceBankAccountId,
    },
  });
}

export interface ExecuteDueLoanAutoPaymentsResult {
  dueCount: number;
  executedCount: number;
  failedCount: number;
  skippedCount: number;
}

export async function executeDueLoanAutoPayments(
  now = new Date(),
): Promise<ExecuteDueLoanAutoPaymentsResult> {
  await prisma.loanPaymentScheduleItem.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
      loan: { status: "ACTIVE", autoPayEnabled: true },
    },
    data: { status: "OVERDUE" },
  });

  const dueItems = await prisma.loanPaymentScheduleItem.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { lte: now },
      loan: {
        status: "ACTIVE",
        autoPayEnabled: true,
        autoPaySourceBankAccountId: { not: null },
      },
    },
    include: {
      loan: {
        include: { loanApplication: { select: { applicantUserId: true } } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }],
  });

  let executedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const processedLoanIds = new Set<string>();

  for (const item of dueItems) {
    if (processedLoanIds.has(item.loanId)) {
      skippedCount += 1;
      continue;
    }

    const earlierUnpaid = await prisma.loanPaymentScheduleItem.findFirst({
      where: {
        loanId: item.loanId,
        status: { in: ["PENDING", "OVERDUE"] },
        installmentNumber: { lt: item.installmentNumber },
      },
    });
    if (earlierUnpaid) {
      skippedCount += 1;
      continue;
    }

    processedLoanIds.add(item.loanId);

    const loan = item.loan;
    const sourceBankAccountId = loan.autoPaySourceBankAccountId;
    if (!sourceBankAccountId) {
      skippedCount += 1;
      continue;
    }

    const scheduledAmount = decimalToNumber(item.scheduledAmount);
    const outstanding = decimalToNumber(loan.outstandingBalance);
    const amount = Math.min(scheduledAmount, outstanding);
    if (amount <= 0) {
      skippedCount += 1;
      continue;
    }

    const actorUserId = resolveLoanPaymentActorUserId(loan);

    try {
      await processLoanPayment(
        actorUserId,
        {
          loanId: loan.id,
          sourceBankAccountId,
          amount,
        },
        {
          isAutoPay: true,
          scheduleItemId: item.id,
          memo: `Automatic payment · installment ${item.installmentNumber}`,
        },
      );
      executedCount += 1;
    } catch (error) {
      failedCount += 1;
      await prisma.loanPaymentScheduleItem.update({
        where: { id: item.id },
        data: {
          autoPayAttemptedAt: now,
          autoPayFailureReason: toAutoPayFailureReason(error),
        },
      });
    }
  }

  return {
    dueCount: dueItems.length,
    executedCount,
    failedCount,
    skippedCount,
  };
}

export async function accrueInterestForLoan(
  loanId: string,
  createdById?: string,
  force = false,
): Promise<{ accrued: boolean; amount: number }> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();

  if (!["ACTIVE"].includes(loan.status)) {
    badRequest("Interest cannot accrue on this loan status");
  }

  const now = new Date();
  if (!force && loan.nextInterestAccrualAt && loan.nextInterestAccrualAt > now) {
    return { accrued: false, amount: 0 };
  }

  const outstanding = decimalToNumber(loan.outstandingBalance);
  if (outstanding <= 0) {
    return { accrued: false, amount: 0 };
  }

  const annualRate = decimalToNumber(loan.interestRate);
  const rateType: LoanRateType =
    loan.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  const interestAmount = computeMonthlyInterestCharge(outstanding, annualRate, rateType);
  if (interestAmount <= 0) {
    return { accrued: false, amount: 0 };
  }

  const newBalance = Math.round((outstanding + interestAmount) * 100) / 100;
  const nextAccrual = addMonths(loan.nextInterestAccrualAt ?? now, 1);

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        outstandingBalance: newBalance,
        lastInterestAccruedAt: now,
        nextInterestAccrualAt: nextAccrual,
      },
    });

    await createLedgerEntry(tx, {
      loanId,
      type: "INTEREST_CHARGE",
      amount: interestAmount,
      balanceAfter: newBalance,
      description: `Monthly interest · ${rateType === "MONTHLY_PERCENT" ? `${annualRate.toFixed(2)}% monthly` : `${annualRate.toFixed(2)}% APR`}`,
      createdById: createdById ?? null,
    });
  });

  return { accrued: true, amount: interestAmount };
}

function resolveLegacyMonthlyRate(
  productType: DbLoanProductType,
  storedRate: number,
): number {
  const rounded = Math.round(storedRate * 100) / 100;
  const migrated = LEGACY_MONTHLY_RATE_TO_CURRENT[rounded];
  if (migrated != null) return migrated;

  const productCode = PRODUCT_TYPE_FROM_DB[productType];
  const productDefault = LOAN_PRODUCT_DEFAULT_MONTHLY_RATES[productCode];
  if (productDefault != null && rounded <= 0) return productDefault;

  return rounded;
}

export async function accrueInterestCatchUpForLoan(
  loanId: string,
  createdById?: string,
): Promise<{ periods: number; totalInterest: number }> {
  const now = new Date();
  let periods = 0;
  let totalInterest = 0;

  for (let i = 0; i < MAX_CATCH_UP_MONTHS; i++) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { status: true, nextInterestAccrualAt: true, outstandingBalance: true },
    });
    if (!loan || loan.status !== "ACTIVE") break;
    if (decimalToNumber(loan.outstandingBalance) <= 0) break;
    if (loan.nextInterestAccrualAt && loan.nextInterestAccrualAt > now) break;

    const result = await accrueInterestForLoan(loanId, createdById, true);
    if (!result.accrued) break;

    periods += 1;
    totalInterest += result.amount;
  }

  return { periods, totalInterest };
}

export async function backfillLegacyLoanInterest(createdById?: string): Promise<{
  rateTypeFixed: number;
  loansWithCatchUp: number;
  totalPeriods: number;
  totalInterest: number;
  loans: Array<{
    loanId: string;
    productType: DbLoanProductType;
    oldRateType: string;
    oldRate: number;
    newRate: number;
    periods: number;
    interest: number;
    outstandingAfter: number;
  }>;
}> {
  const legacyLoans = await prisma.loan.findMany({
    where: { interestRateType: "ANNUAL_PERCENT" },
  });

  const loanSnapshots = new Map<
    string,
    { oldRateType: string; oldRate: number; newRate: number; productType: DbLoanProductType }
  >();

  for (const loan of legacyLoans) {
    const oldRate = decimalToNumber(loan.interestRate);
    const newRate = resolveLegacyMonthlyRate(loan.productType, oldRate);
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        interestRateType: "MONTHLY_PERCENT",
        interestRate: newRate,
      },
    });
    loanSnapshots.set(loan.id, {
      oldRateType: "ANNUAL_PERCENT",
      oldRate,
      newRate,
      productType: loan.productType,
    });
  }

  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE", outstandingBalance: { gt: 0 } },
    select: { id: true, productType: true, interestRate: true, interestRateType: true },
  });

  const loans: Array<{
    loanId: string;
    productType: DbLoanProductType;
    oldRateType: string;
    oldRate: number;
    newRate: number;
    periods: number;
    interest: number;
    outstandingAfter: number;
  }> = [];

  let loansWithCatchUp = 0;
  let totalPeriods = 0;
  let totalInterest = 0;

  for (const loan of activeLoans) {
    const snapshot = loanSnapshots.get(loan.id);
    const catchUp = await accrueInterestCatchUpForLoan(loan.id, createdById);
    const updated = await prisma.loan.findUnique({
      where: { id: loan.id },
      select: { outstandingBalance: true, interestRate: true, interestRateType: true },
    });
    if (!updated) continue;

    const row = {
      loanId: loan.id,
      productType: loan.productType,
      oldRateType: snapshot?.oldRateType ?? String(loan.interestRateType),
      oldRate: snapshot?.oldRate ?? decimalToNumber(loan.interestRate),
      newRate: decimalToNumber(updated.interestRate),
      periods: catchUp.periods,
      interest: catchUp.totalInterest,
      outstandingAfter: decimalToNumber(updated.outstandingBalance),
    };

    if (snapshot || catchUp.periods > 0) {
      loans.push(row);
    }

    if (catchUp.periods > 0) {
      loansWithCatchUp += 1;
      totalPeriods += catchUp.periods;
      totalInterest += catchUp.totalInterest;
    }
  }

  return {
    rateTypeFixed: legacyLoans.length,
    loansWithCatchUp,
    totalPeriods,
    totalInterest,
    loans,
  };
}

export async function accrueInterestForDueLoans(createdById?: string): Promise<{
  processed: number;
  accrued: number;
  totalInterest: number;
}> {
  const now = new Date();
  const dueLoans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      outstandingBalance: { gt: 0 },
      OR: [{ nextInterestAccrualAt: null }, { nextInterestAccrualAt: { lte: now } }],
    },
    select: { id: true },
  });

  let accrued = 0;
  let totalInterest = 0;
  for (const { id } of dueLoans) {
    const catchUp = await accrueInterestCatchUpForLoan(id, createdById);
    if (catchUp.periods > 0) {
      accrued += catchUp.periods;
      totalInterest += catchUp.totalInterest;
    }
  }

  return { processed: dueLoans.length, accrued, totalInterest };
}

async function getReviewableApplication(applicationId: string) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: loanApplicationReviewInclude,
  });
  if (!application) notFound();
  if (!["PENDING", "UNDER_REVIEW"].includes(application.status)) {
    badRequest("Application is no longer open for review");
  }
  if (application.loan) badRequest("A loan already exists for this application");
  return application;
}

export async function approveLoanApplication(
  adminId: string,
  input: ApproveLoanApplicationInput,
): Promise<void> {
  const application = await getReviewableApplication(input.applicationId);
  const principalAmount =
    input.principalAmount ?? decimalToNumber(application.requestedAmount);
  const interestRate = input.interestRate;

  if (interestRate < 0) badRequest("Interest rate cannot be negative");
  if (interestRate <= 0) badRequest("Monthly interest rate must be greater than zero");
  if (principalAmount <= 0) badRequest("Principal amount must be greater than zero");

  const applicant = mapDbUserToAltaUser(application.applicantUser);
  if (application.productType === "BUSINESS_CREDIT_LINE") {
    if (!application.companyId || application.company?.verificationStatus !== "VERIFIED") {
      badRequest("Business loans require a verified company");
    }
  }
  if (application.productType === "PRIVATE_LIQUIDITY_LINE" && !isPrivateClient(applicant)) {
    badRequest("Applicant must have Alta Private client status");
  }
  if (application.linkedBankAccountId) {
    const account = await prisma.bankAccount.findUnique({
      where: { id: application.linkedBankAccountId },
    });
    if (!account) badRequest("Linked bank account not found");
    if (account.status === "FROZEN" || account.status === "CLOSED") {
      badRequest("Cannot disburse to a frozen or closed account");
    }
  }

  const now = new Date();
  const nextInterestAccrualAt = addMonths(now, 1);
  const borrowerUserId =
    application.productType === "BUSINESS_CREDIT_LINE" ? null : application.applicantUserId;

  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        loanApplicationId: application.id,
        borrowerUserId,
        companyId: application.companyId,
        productType: application.productType,
        principalAmount,
        termMonths: application.termMonths,
        outstandingBalance: principalAmount,
        interestRate,
        interestRateType: "MONTHLY_PERCENT",
        lastInterestAccruedAt: now,
        nextInterestAccrualAt,
        status: "ACTIVE",
        linkedBankAccountId: application.linkedBankAccountId,
        approvedById: adminId,
        approvedAt: now,
      },
    });

    await tx.loanApplication.update({
      where: { id: application.id },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: now,
        reviewNote: input.reviewNote?.trim() || application.reviewNote,
      },
    });

    let bankTransactionId: string | undefined;

    if (application.linkedBankAccountId) {
      const account = await tx.bankAccount.findUnique({
        where: { id: application.linkedBankAccountId },
      });
      if (!account || account.status === "FROZEN" || account.status === "CLOSED") {
        badRequest("Cannot disburse to a frozen or closed account");
      }

      const referenceCode = generateReferenceCode("LND");
      const bankTx = await tx.bankTransaction.create({
        data: {
          bankAccountId: application.linkedBankAccountId,
          type: "ADJUSTMENT",
          amount: principalAmount,
          status: "APPROVED",
          description: `Loan disbursement · ${application.id.slice(0, 8)}`,
          memo: "Alta Bank lending disbursement",
          referenceCode,
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
      bankTransactionId = bankTx.id;

      await tx.bankAccount.update({
        where: { id: application.linkedBankAccountId },
        data: { balance: { increment: principalAmount } },
      });

      await createLedgerEntry(tx, {
        loanId: loan.id,
        type: "DISBURSEMENT",
        amount: principalAmount,
        balanceAfter: principalAmount,
        description: "Principal disbursed to linked account",
        bankTransactionId,
        createdById: adminId,
      });
    } else {
      await createLedgerEntry(tx, {
        loanId: loan.id,
        type: "DISBURSEMENT",
        amount: principalAmount,
        balanceAfter: principalAmount,
        description: "Loan approved — no linked disbursement account",
        createdById: adminId,
      });
    }

    if (application.termMonths > 0) {
      await createLoanPaymentScheduleInTx(
        tx,
        loan.id,
        principalAmount,
        application.termMonths,
        nextInterestAccrualAt,
        interestRate,
        "MONTHLY_PERCENT",
      );
    }
  });
}

export async function denyLoanApplication(
  adminId: string,
  input: DenyLoanApplicationInput,
): Promise<void> {
  const application = await getReviewableApplication(input.applicationId);
  await prisma.loanApplication.update({
    where: { id: application.id },
    data: {
      status: "DENIED",
      reviewedById: adminId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || application.reviewNote,
    },
  });
}

export async function freezeLoan(adminId: string, loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();
  if (loan.status !== "ACTIVE") badRequest("Only active loans can be frozen");

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id: loanId }, data: { status: "FROZEN" } });
    await createLedgerEntry(tx, {
      loanId,
      type: "STATUS_CHANGE",
      amount: 0,
      balanceAfter: decimalToNumber(loan.outstandingBalance),
      description: "Loan frozen by operator",
      createdById: adminId,
    });
  });
}

export async function unfreezeLoan(adminId: string, loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();
  if (loan.status !== "FROZEN") badRequest("Loan is not frozen");

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id: loanId }, data: { status: "ACTIVE" } });
    await createLedgerEntry(tx, {
      loanId,
      type: "STATUS_CHANGE",
      amount: 0,
      balanceAfter: decimalToNumber(loan.outstandingBalance),
      description: "Loan unfrozen by operator",
      createdById: adminId,
    });
  });
}

export async function markLoanPaidOff(adminId: string, loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();
  const outstanding = decimalToNumber(loan.outstandingBalance);
  if (outstanding > 0) badRequest("Outstanding balance must be zero to mark paid off");

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id: loanId }, data: { status: "PAID_OFF" } });
    await createLedgerEntry(tx, {
      loanId,
      type: "STATUS_CHANGE",
      amount: 0,
      balanceAfter: 0,
      description: "Marked paid off by operator",
      createdById: adminId,
    });
  });
}

export async function adminAdjustLoanBalance(
  adminId: string,
  input: AdminAdjustLoanInput,
): Promise<void> {
  if (input.amount === 0) badRequest("Adjustment amount cannot be zero");
  const loan = await prisma.loan.findUnique({ where: { id: input.loanId } });
  if (!loan) notFound();
  if (!["ACTIVE", "FROZEN"].includes(loan.status)) {
    badRequest("Adjustments only allowed on active or frozen loans");
  }

  const outstanding = decimalToNumber(loan.outstandingBalance);
  const newBalance = Math.round((outstanding + input.amount) * 100) / 100;
  if (newBalance < 0) badRequest("Adjustment would result in negative outstanding balance");

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: input.loanId },
      data: { outstandingBalance: newBalance },
    });
    await createLedgerEntry(tx, {
      loanId: input.loanId,
      type: "ADJUSTMENT",
      amount: input.amount,
      balanceAfter: newBalance,
      description: input.description.trim() || "Operator balance adjustment",
      createdById: adminId,
    });
  });
}

const internalLoanDetailInclude = {
  ...internalLoanInclude,
} as const;

export async function listInternalLoansByStatus(
  statuses: DbLoanStatus[],
): Promise<InternalActiveLoanRow[]> {
  const records = await prisma.loan.findMany({
    where: { status: { in: statuses } },
    include: internalLoanInclude,
    orderBy: { createdAt: "desc" },
  });
  return records.map(mapInternalActiveLoanRow);
}
