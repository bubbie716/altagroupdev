import { randomBytes } from "node:crypto";
import type { LoanStatus as DbLoanStatus, Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canViewBusinessTreasury,
  isPrivateClient,
} from "@/lib/auth/permissions";
import { canUserPayLoan, canUserViewLoan } from "@/lib/bank/loan-permissions";
import {
  addMonths,
  type LoanRateType,
} from "@/lib/bank/loan-interest";
import {
  allocatePaymentToScheduleInstallments,
  rebuildScheduleInstallmentPayments,
} from "@/lib/bank/loan-payment-schedule";
import {
  allocateLoanPayment,
  applyBalanceAdjustment,
  applyGuaranteedInterestPaymentInTx,
  calculateCurrentPayoff,
  createLoanInterestScheduleInTx,
  guaranteeDueInterestForLoan,
  guaranteeDueLoanInterest,
  previewInterest,
  roundCurrency,
  syncOutstandingBalance,
  waivePendingInterestScheduleInTx,
  waiveUnpaidInterestScheduleInTx,
} from "@/lib/bank/loan-interest-service";
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
  SubmitLoanPaymentResult,
} from "@/lib/bank/lending-types";
import { LOAN_PRODUCT_DEFAULT_MONTHLY_RATES } from "@/lib/bank/lending-types";
import {
  LOAN_ADJUSTMENT_DESCRIPTION,
  LOAN_FUNDING_DESCRIPTION,
  LOAN_INTEREST_CHARGE_DESCRIPTION,
  LOAN_PAYMENT_DESCRIPTION,
  LOAN_PAYOFF_DESCRIPTION,
} from "@/lib/bank/customer-transaction-copy";
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
  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  return getAccountAvailableBalance(accountId);
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
  if (account.restrictWithdrawals) badRequest("Withdrawals are restricted on this account");
  if (loan.companyId && account.companyId !== loan.companyId) {
    badRequest("Source account must belong to the loan company");
  }
  if (!loan.companyId && account.companyId) {
    badRequest("Personal loan payments must come from a personal Alta account");
  }
}

export async function createLedgerEntry(
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
  isOperatorPayment?: boolean;
  memo?: string;
}

export async function createLoanPaymentScheduleInTx(
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

async function applyInstallmentSchedulePaymentInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  amount: number,
  now: Date,
): Promise<string | null> {
  const items = await tx.loanPaymentScheduleItem.findMany({
    where: { loanId },
    orderBy: { installmentNumber: "asc" },
  });
  if (items.length === 0) return null;

  const states = items.map((item) => ({
    id: item.id,
    scheduledAmount: decimalToNumber(item.scheduledAmount),
    paidAmount: decimalToNumber(item.paidAmount),
  }));

  const { updates, primaryInstallmentId } = allocatePaymentToScheduleInstallments(states, amount);

  for (const update of updates) {
    await tx.loanPaymentScheduleItem.update({
      where: { id: update.id },
      data: {
        paidAmount: update.paidAmount,
        ...(update.fullyPaid
          ? { status: "PAID" as const, paidAt: now }
          : {}),
      },
    });
  }

  return primaryInstallmentId;
}

async function closeOpenPaymentScheduleOnPayoffInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  paidAt = new Date(),
): Promise<void> {
  const openItems = await tx.loanPaymentScheduleItem.findMany({
    where: { loanId, status: { not: "PAID" } },
  });
  for (const item of openItems) {
    await tx.loanPaymentScheduleItem.update({
      where: { id: item.id },
      data: {
        status: "PAID",
        paidAt,
        paidAmount: item.scheduledAmount,
      },
    });
  }
}

export async function reconcileLoanPaymentSchedule(loanId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      select: { status: true },
    });

    const items = await tx.loanPaymentScheduleItem.findMany({
      where: { loanId },
      orderBy: { installmentNumber: "asc" },
    });
    if (items.length === 0) return;

    const payments = await tx.loanPayment.findMany({
      where: { loanId, status: "COMPLETED" },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, amount: true, paymentDate: true },
    });
    if (payments.length === 0) return;

    const installments = items.map((item) => ({
      id: item.id,
      scheduledAmount: decimalToNumber(item.scheduledAmount),
      paidAmount: 0,
    }));

    const { installmentStates, paymentInstallmentIds } = rebuildScheduleInstallmentPayments(
      installments,
      payments.map((payment) => decimalToNumber(payment.amount)),
    );

    for (const state of installmentStates) {
      await tx.loanPaymentScheduleItem.update({
        where: { id: state.id },
        data: {
          paidAmount: state.paidAmount,
          status: state.fullyPaid ? "PAID" : "PENDING",
          paidAt: state.fullyPaid ? payments.at(-1)?.paymentDate ?? new Date() : null,
        },
      });
    }

    for (let index = 0; index < payments.length; index += 1) {
      const installmentId = paymentInstallmentIds[index];
      if (!installmentId) continue;
      await tx.loanPayment.update({
        where: { id: payments[index]!.id },
        data: { scheduleItemId: installmentId },
      });
    }

    if (loan?.status === "PAID_OFF") {
      await closeOpenPaymentScheduleOnPayoffInTx(
        tx,
        loanId,
        payments.at(-1)?.paymentDate ?? new Date(),
      );
    }
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
  try {
    await reconcileLoanPaymentSchedule(loanId);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "loan-payment-schedule",
        event: "reconcile_failed",
        loanId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
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

async function processLoanPayment(
  actorUserId: string,
  input: MakeLoanPaymentInput,
  options: ProcessLoanPaymentOptions = {},
): Promise<SubmitLoanPaymentResult> {
  const user = await getAltaUser(actorUserId);
  const loanRecord = await prisma.loan.findUnique({
    where: { id: input.loanId },
    include: { loanApplication: { select: { applicantUserId: true } } },
  });
  if (!loanRecord) notFound();

  if (!options.isAutoPay && !options.isOperatorPayment) {
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

  const principalOutstanding = decimalToNumber(loanRecord.principalOutstanding);
  const accruedInterest = decimalToNumber(loanRecord.accruedInterest);
  const payoff = calculateCurrentPayoff({ principalOutstanding, accruedInterest });
  if (amount > payoff) badRequest("Payment cannot exceed current payoff amount");

  if (!options.isOperatorPayment) {
    await assertPaySourceAccount(actorUserId, input.sourceBankAccountId, loanRecord);
  } else {
    const src = await prisma.bankAccount.findUnique({ where: { id: input.sourceBankAccountId } });
    if (!src || src.status !== "ACTIVE") badRequest("Source account must be active");
  }

  const allocation = allocateLoanPayment(amount, principalOutstanding, accruedInterest);
  const newPayoff = syncOutstandingBalance({
    principalOutstanding: allocation.newPrincipalOutstanding,
    accruedInterest: allocation.newAccruedInterest,
  });
  const paidOff = newPayoff <= 0;
  const paymentMemo = options.memo ?? (input.memo?.trim() || null);
  const now = new Date();
  const referenceCode = generateReferenceCode("LNP");

  await prisma.$transaction(async (tx) => {
    const { assertAccountAvailableForDebitInTx } = await import("@/server/financial-integrity.service");
    await assertAccountAvailableForDebitInTx(tx, input.sourceBankAccountId, amount, {
      message: "Insufficient available balance in source account",
    });

    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: input.sourceBankAccountId,
        type: "LOAN_PAYMENT",
        amount,
        status: "APPROVED",
        description: LOAN_PAYMENT_DESCRIPTION,
        memo: paymentMemo,
        referenceCode,
        reviewedAt: now,
      },
    });

    await tx.bankAccount.update({
      where: { id: input.sourceBankAccountId },
      data: { balance: { decrement: amount } },
    });

    let scheduleItemId = options.scheduleItemId ?? null;

    const loanPayment = await tx.loanPayment.create({
      data: {
        loanId: loanRecord.id,
        amount,
        appliedToInterest: allocation.appliedToInterest,
        appliedToPrincipal: allocation.appliedToPrincipal,
        paymentDate: now,
        sourceBankAccountId: input.sourceBankAccountId,
        bankTransactionId: bankTx.id,
        scheduleItemId,
        memo: paymentMemo,
        status: "COMPLETED",
      },
    });

    const appliedScheduleItemId = await applyInstallmentSchedulePaymentInTx(
      tx,
      loanRecord.id,
      amount,
      now,
    );
    if (!scheduleItemId && appliedScheduleItemId) {
      scheduleItemId = appliedScheduleItemId;
      await tx.loanPayment.update({
        where: { id: loanPayment.id },
        data: { scheduleItemId: appliedScheduleItemId },
      });
    }

    await tx.loan.update({
      where: { id: loanRecord.id },
      data: {
        principalOutstanding: allocation.newPrincipalOutstanding,
        accruedInterest: allocation.newAccruedInterest,
        outstandingBalance: newPayoff,
        status: paidOff ? "PAID_OFF" : loanRecord.status,
        ...(paidOff ? { autoPayEnabled: false, autoPaySourceBankAccountId: null } : {}),
      },
    });

    if (allocation.appliedToInterest > 0) {
      await applyGuaranteedInterestPaymentInTx(
        tx,
        loanRecord.id,
        allocation.appliedToInterest,
        now,
      );
    }

    await createLedgerEntry(tx, {
      loanId: loanRecord.id,
      type: "PAYMENT",
      amount: -amount,
      balanceAfter: newPayoff,
      description: paymentMemo || LOAN_PAYMENT_DESCRIPTION,
      bankTransactionId: bankTx.id,
      createdById: actorUserId,
    });

    if (paidOff) {
      await waivePendingInterestScheduleInTx(tx, loanRecord.id);
      await createLedgerEntry(tx, {
        loanId: loanRecord.id,
        type: "STATUS_CHANGE",
        amount: 0,
        balanceAfter: 0,
        description: LOAN_PAYOFF_DESCRIPTION,
        createdById: actorUserId,
      });
      await closeOpenPaymentScheduleOnPayoffInTx(tx, loanRecord.id, now);
    }
  });

  if (paidOff) {
    const { recordLoanPaidOffTimelineEvent } = await import("@/server/relationship-timeline.service");
    await recordLoanPaidOffTimelineEvent({
      loanId: loanRecord.id,
      borrowerUserId: loanRecord.borrowerUserId,
      companyId: loanRecord.companyId,
      actorUserId,
    });
  }

  void (async () => {
    const { refreshFromLoanContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
    try {
      await refreshFromLoanContextBestEffort(
        { borrowerUserId: loanRecord.borrowerUserId, companyId: loanRecord.companyId },
        paidOff ? "loan-paid-off" : "loan-payment-made",
      );
    } catch (error) {
      console.error("[loan] relationship refresh failed", error);
    }
  })();

  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId,
    action: paidOff ? "LOAN_PAID_OFF" : "LOAN_PAYMENT_MADE",
    entityType: "LOAN",
    entityId: loanRecord.id,
    targetLoanId: loanRecord.id,
    targetUserId: loanRecord.borrowerUserId,
    targetCompanyId: loanRecord.companyId ?? undefined,
    description: paidOff
      ? `Loan ${loanRecord.id.slice(0, 8)} paid off`
      : `Loan payment ${referenceCode}`,
    metadata: auditSourceMetadata(options.isAutoPay ? "cron" : "website", {
      amount,
      referenceCode,
    }),
  });

  try {
    const {
      notifyLoanPaymentMade,
      notifyLoanPaidOff,
    } = await import("@/server/banking-notification.service");
    void (async () => {
      try {
        if (paidOff) {
          await notifyLoanPaidOff(loanRecord.borrowerUserId, {
            loanId: loanRecord.id,
            referenceCode,
          });
        } else {
          await notifyLoanPaymentMade(loanRecord.borrowerUserId, {
            loanId: loanRecord.id,
            amount,
            referenceCode,
          });
        }
      } catch (error) {
        console.error("[loan] payment notification failed", error);
      }
    })();
  } catch (error) {
    console.error("[loan] payment notification import failed", error);
  }

  return { referenceCode, amount };
}

export async function makeLoanPayment(
  userId: string,
  input: MakeLoanPaymentInput,
): Promise<SubmitLoanPaymentResult> {
  return processLoanPayment(userId, input);
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
    const payoff = calculateCurrentPayoff({
      principalOutstanding: decimalToNumber(loan.principalOutstanding),
      accruedInterest: decimalToNumber(loan.accruedInterest),
    });
    const amount = Math.min(scheduledAmount, payoff);
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
      const failureReason = toAutoPayFailureReason(error);
      await prisma.loanPaymentScheduleItem.update({
        where: { id: item.id },
        data: {
          autoPayAttemptedAt: now,
          autoPayFailureReason: failureReason,
        },
      });
      try {
        const { notifyLoanAutopayFailedBestEffort } = await import(
          "@/server/banking-notification.service"
        );
        await notifyLoanAutopayFailedBestEffort(loan.borrowerUserId, {
          loanId: loan.id,
          amount: decimalToNumber(item.scheduledAmount),
          reason: failureReason,
        });
      } catch (notifyError) {
        console.error("[loan] autopay failed notification error", notifyError);
      }
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
  _force = false,
): Promise<{ accrued: boolean; amount: number }> {
  const result = await guaranteeDueInterestForLoan(loanId, createdById);
  return {
    accrued: result.guaranteedCount > 0,
    amount: result.totalInterestGuaranteed,
  };
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
      select: { status: true, nextInterestAccrualAt: true, principalOutstanding: true },
    });
    if (!loan || loan.status !== "ACTIVE") break;
    if (decimalToNumber(loan.principalOutstanding) <= 0) break;
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
  const result = await guaranteeDueLoanInterest(createdById);
  return {
    processed: result.loansProcessed,
    accrued: result.guaranteedCount,
    totalInterest: result.totalInterestGuaranteed,
  };
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
        termMonths: input.termMonths ?? application.termMonths,
        outstandingBalance: principalAmount,
        principalOutstanding: principalAmount,
        accruedInterest: 0,
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
          description: LOAN_FUNDING_DESCRIPTION,
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
        description: LOAN_FUNDING_DESCRIPTION,
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

      const { firstGuaranteedInterest } = await createLoanInterestScheduleInTx(
        tx,
        loan.id,
        principalAmount,
        application.termMonths,
        now,
        interestRate,
        "MONTHLY_PERCENT",
      );

      if (firstGuaranteedInterest > 0) {
        const newPayoff = roundCurrency(principalAmount + firstGuaranteedInterest);
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            accruedInterest: firstGuaranteedInterest,
            outstandingBalance: newPayoff,
          },
        });

        await createLedgerEntry(tx, {
          loanId: loan.id,
          type: "INTEREST_CHARGE",
          amount: firstGuaranteedInterest,
          balanceAfter: newPayoff,
          description: LOAN_INTEREST_CHARGE_DESCRIPTION,
          createdById: adminId,
        });
      }
    }
  });

  const loan = await prisma.loan.findFirst({ where: { loanApplicationId: application.id } });
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "LOAN_APPROVED",
    entityType: "LOAN_APPLICATION",
    entityId: application.id,
    targetUserId: application.applicantUserId,
    targetLoanId: loan?.id ?? undefined,
    targetCompanyId: application.companyId ?? undefined,
    description: `Approved loan application ${application.id.slice(0, 8)}`,
    metadata: { principalAmount, interestRate },
  });

  const { closeThreadForApplicationIfOpen, buildApplicationApprovedSystemMessage } = await import(
    "@/server/loan-application-thread.service"
  );
  const reviewNote = input.reviewNote?.trim() || application.reviewNote;
  await closeThreadForApplicationIfOpen(
    adminId,
    application.id,
    "Secure Deal Room closed after acceptance.",
    buildApplicationApprovedSystemMessage(reviewNote),
  );

  const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
  if (!application.companyId) {
    await recordRelationshipTimelineEvent({
      userId: application.applicantUserId,
      eventType: "LOAN_ACCEPTED",
      title: "Lending application accepted",
      occurredAt: now,
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: application.id,
      actorUserId: adminId,
    });
  }
  if (loan) {
    const { formatLoanApprovedTimelineCopy } = await import("@/lib/bank/relationship-timeline-historical");
    const loanCopy = formatLoanApprovedTimelineCopy(principalAmount, {
      business: !!application.companyId,
    });
    const fundedEvent = {
      eventType: "LOAN_FUNDED" as const,
      title: loanCopy.title,
      description: loanCopy.description ?? undefined,
      occurredAt: loan.approvedAt ?? now,
      relatedEntityType: "LOAN" as const,
      relatedEntityId: loan.id,
      actorUserId: adminId,
    };
    if (application.companyId) {
      const { recordCompanyTimelineEventIfBusiness } = await import(
        "@/server/company-relationship-timeline.service"
      );
      await recordCompanyTimelineEventIfBusiness(application.companyId, {
        ...fundedEvent,
        dedupeKey: `loan:funded:${loan.id}`,
      });
    } else {
      await recordRelationshipTimelineEvent({
        userId: application.applicantUserId,
        ...fundedEvent,
        dedupeKey: `loan:funded:${loan.id}`,
      });
    }
  }

  const { refreshFromLoanContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
  await refreshFromLoanContextBestEffort(
    { borrowerUserId: application.applicantUserId, companyId: application.companyId },
    loan ? "loan-funded" : "loan-application-accepted",
  );

  try {
    const { notifyLoanApplicationApproved } = await import("@/server/banking-notification.service");
    await notifyLoanApplicationApproved(
      application.applicantUserId,
      application.id,
      principalAmount,
    );
  } catch (error) {
    console.error("[loan] application approved notification failed", error);
  }
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

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "LOAN_DENIED",
    entityType: "LOAN_APPLICATION",
    entityId: application.id,
    targetUserId: application.applicantUserId,
    targetCompanyId: application.companyId ?? undefined,
    description: `Denied loan application ${application.id.slice(0, 8)}`,
    metadata: { reviewNote: input.reviewNote ?? null },
  });

  const { closeThreadForApplicationIfOpen, buildApplicationDeniedSystemMessage } = await import(
    "@/server/loan-application-thread.service"
  );
  const reviewNote = input.reviewNote?.trim() || application.reviewNote;
  await closeThreadForApplicationIfOpen(
    adminId,
    application.id,
    "Secure Deal Room closed after denial.",
    buildApplicationDeniedSystemMessage(reviewNote),
  );

  const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
  if (!application.companyId) {
    await recordRelationshipTimelineEvent({
      userId: application.applicantUserId,
      eventType: "LOAN_DENIED",
      title: "Lending application denied",
      occurredAt: new Date(),
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: application.id,
      actorUserId: adminId,
    });
  }

  const { refreshUserRelationshipProfileBestEffort } = await import(
    "@/server/relationship-refresh-hooks.service"
  );
  await refreshUserRelationshipProfileBestEffort(application.applicantUserId, "loan-application-denied");

  try {
    const { notifyLoanApplicationDenied } = await import("@/server/banking-notification.service");
    await notifyLoanApplicationDenied(
      application.applicantUserId,
      application.id,
    );
  } catch (error) {
    console.error("[loan] application denied notification failed", error);
  }
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

export async function waivePendingInterestForLoan(adminId: string, loanId: string): Promise<number> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();
  if (!["PAID_OFF", "CANCELLED"].includes(loan.status)) {
    badRequest("Pending interest can only be waived on paid-off or cancelled loans");
  }

  let waived = 0;
  await prisma.$transaction(async (tx) => {
    waived = await waiveUnpaidInterestScheduleInTx(tx, loanId);
    await tx.loan.update({
      where: { id: loanId },
      data: {
        accruedInterest: 0,
        outstandingBalance: decimalToNumber(loan.principalOutstanding),
      },
    });
    await createLedgerEntry(tx, {
      loanId,
      type: "STATUS_CHANGE",
      amount: 0,
      balanceAfter: decimalToNumber(loan.principalOutstanding),
      description: `Waived ${waived} unpaid interest schedule item(s)`,
      createdById: adminId,
    });
  });
  return waived;
}

export async function markLoanPaidOff(adminId: string, loanId: string): Promise<void> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound();
  const payoff = calculateCurrentPayoff({
    principalOutstanding: decimalToNumber(loan.principalOutstanding),
    accruedInterest: decimalToNumber(loan.accruedInterest),
  });
  if (payoff > 0) badRequest("Current payoff must be zero to mark paid off");

  await prisma.$transaction(async (tx) => {
    await waiveUnpaidInterestScheduleInTx(tx, loanId);
    await closeOpenPaymentScheduleOnPayoffInTx(tx, loanId);
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "PAID_OFF",
        principalOutstanding: 0,
        accruedInterest: 0,
        outstandingBalance: 0,
      },
    });
    await createLedgerEntry(tx, {
      loanId,
      type: "STATUS_CHANGE",
      amount: 0,
      balanceAfter: 0,
      description: "Marked paid off by operator",
      createdById: adminId,
    });
  });

  if (loan.borrowerUserId) {
    const { recordLoanPaidOffTimelineEvent } = await import("@/server/relationship-timeline.service");
    await recordLoanPaidOffTimelineEvent({
      loanId,
      borrowerUserId: loan.borrowerUserId,
      companyId: loan.companyId,
      actorUserId: adminId,
    });
  }

  const { refreshFromLoanContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
  await refreshFromLoanContextBestEffort(
    { borrowerUserId: loan.borrowerUserId, companyId: loan.companyId },
    "loan-paid-off",
  );
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

  const principalOutstanding = decimalToNumber(loan.principalOutstanding);
  const accruedInterest = decimalToNumber(loan.accruedInterest);
  const adjusted = applyBalanceAdjustment(input.amount, principalOutstanding, accruedInterest);
  const newPayoff = syncOutstandingBalance(adjusted);
  if (newPayoff < 0) badRequest("Adjustment would result in negative payoff balance");

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: input.loanId },
      data: {
        principalOutstanding: adjusted.principalOutstanding,
        accruedInterest: adjusted.accruedInterest,
        outstandingBalance: newPayoff,
      },
    });
    await createLedgerEntry(tx, {
      loanId: input.loanId,
      type: "ADJUSTMENT",
      amount: input.amount,
      balanceAfter: newPayoff,
      description: input.description.trim() || LOAN_ADJUSTMENT_DESCRIPTION,
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

export async function getInternalLoanDetail(loanId: string): Promise<InternalActiveLoanRow> {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const record = await prisma.loan.findUnique({
    where: { id: loanId },
    include: internalLoanInclude,
  });
  if (!record) notFound();
  return mapInternalActiveLoanRow(record);
}

export async function adminRecordLoanPayment(
  adminId: string,
  input: { loanId: string; sourceBankAccountId: string; amount: number; memo?: string; reason: string },
): Promise<void> {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const reason = input.reason.trim();
  if (!reason) badRequest("Reason is required");
  await processLoanPayment(
    adminId,
    {
      loanId: input.loanId,
      sourceBankAccountId: input.sourceBankAccountId,
      amount: input.amount,
      memo: input.memo ? `${input.memo} · ${reason}` : reason,
    },
    { isOperatorPayment: true, memo: reason },
  );
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "ADMIN_LOAN_PAYMENT_RECORDED",
    entityType: "LOAN",
    entityId: input.loanId,
    targetLoanId: input.loanId,
    description: `Operator recorded loan payment of ${input.amount}`,
    metadata: { amount: input.amount, reason, sourceBankAccountId: input.sourceBankAccountId },
  });
}
