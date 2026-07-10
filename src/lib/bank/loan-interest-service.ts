import type {
  LoanInterestRateType,
  LoanInterestScheduleStatus,
  Prisma,
} from "@prisma/client";
import {
  addMonths,
  computeMonthlyInterestCharge,
  type LoanRateType,
} from "@/lib/bank/loan-interest";
import { loanInterestChargePaymentDescription } from "@/lib/bank/customer-transaction-copy";
import { prisma } from "@/server/db";

export interface LoanBalanceSnapshot {
  principalOutstanding: number;
  accruedInterest: number;
}

export interface PaymentAllocationResult {
  appliedToInterest: number;
  appliedToPrincipal: number;
  newPrincipalOutstanding: number;
  newAccruedInterest: number;
}

export interface LoanInterestScheduleDraft {
  installmentNumber: number;
  guaranteeDate: Date;
  interestAmount: number;
  initialStatus: "GUARANTEED" | "PENDING";
}

export interface LoanPayoffBreakdown {
  principalOutstanding: number;
  guaranteedUnpaidInterest: number;
  currentPayoffAmount: number;
  pendingFutureInterest: number;
  projectedFullTermCost: number;
  nextInterestGuaranteeDate: string | null;
}

export interface GuaranteeInterestResult {
  guaranteedCount: number;
  waivedCount: number;
  totalInterestGuaranteed: number;
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateCurrentPayoff(snapshot: LoanBalanceSnapshot): number {
  return roundCurrency(snapshot.principalOutstanding + snapshot.accruedInterest);
}

export function syncOutstandingBalance(snapshot: LoanBalanceSnapshot): number {
  return calculateCurrentPayoff(snapshot);
}

export function allocateLoanPayment(
  amount: number,
  principalOutstanding: number,
  guaranteedUnpaidInterest: number,
): PaymentAllocationResult {
  const toInterest = roundCurrency(Math.min(amount, guaranteedUnpaidInterest));
  const remaining = roundCurrency(amount - toInterest);
  const toPrincipal = roundCurrency(Math.min(remaining, principalOutstanding));

  return {
    appliedToInterest: toInterest,
    appliedToPrincipal: toPrincipal,
    newPrincipalOutstanding: roundCurrency(principalOutstanding - toPrincipal),
    newAccruedInterest: roundCurrency(guaranteedUnpaidInterest - toInterest),
  };
}

export function applyBalanceAdjustment(
  amount: number,
  principalOutstanding: number,
  accruedInterest: number,
): LoanBalanceSnapshot {
  if (amount >= 0) {
    return {
      principalOutstanding: roundCurrency(principalOutstanding + amount),
      accruedInterest,
    };
  }

  let remaining = roundCurrency(-amount);
  const fromAccrued = roundCurrency(Math.min(remaining, accruedInterest));
  const newAccrued = roundCurrency(accruedInterest - fromAccrued);
  remaining = roundCurrency(remaining - fromAccrued);
  const newPrincipal = roundCurrency(Math.max(0, principalOutstanding - remaining));

  return {
    principalOutstanding: newPrincipal,
    accruedInterest: newAccrued,
  };
}

export function previewInterest(input: {
  principalOutstanding: number;
  interestRate: number;
  interestRateType: LoanInterestRateType | LoanRateType;
}): number {
  const rateType: LoanRateType =
    input.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
  return computeMonthlyInterestCharge(input.principalOutstanding, input.interestRate, rateType);
}

export function buildLoanInterestScheduleDrafts(
  principalAmount: number,
  termMonths: number,
  disbursementDate: Date,
  interestRate: number,
  rateType: LoanRateType = "MONTHLY_PERCENT",
): LoanInterestScheduleDraft[] {
  if (principalAmount <= 0 || termMonths <= 0) return [];

  const basePrincipal = Math.floor((principalAmount / termMonths) * 100) / 100;
  let allocatedPrincipal = 0;
  let balance = principalAmount;
  const items: LoanInterestScheduleDraft[] = [];

  for (let i = 1; i <= termMonths; i++) {
    const isLast = i === termMonths;
    const principalPortion = isLast
      ? roundCurrency(principalAmount - allocatedPrincipal)
      : basePrincipal;
    const interestAmount = computeMonthlyInterestCharge(balance, interestRate, rateType);
    const guaranteeDate = i === 1 ? disbursementDate : addMonths(disbursementDate, i - 1);

    items.push({
      installmentNumber: i,
      guaranteeDate,
      interestAmount,
      initialStatus: i === 1 ? "GUARANTEED" : "PENDING",
    });

    allocatedPrincipal = roundCurrency(allocatedPrincipal + principalPortion);
    balance = roundCurrency(balance - principalPortion);
  }

  return items;
}

type InterestScheduleRow = {
  installmentNumber: number;
  guaranteeDate: Date;
  interestAmount: { toNumber(): number };
  paidAmount: { toNumber(): number };
  status: LoanInterestScheduleStatus;
};

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export function summarizeInterestSchedule(
  principalAmount: number,
  items: InterestScheduleRow[],
): {
  guaranteedUnpaidInterest: number;
  pendingFutureInterest: number;
  projectedFullTermCost: number;
  nextInterestGuaranteeDate: string | null;
} {
  let guaranteedUnpaidInterest = 0;
  let pendingFutureInterest = 0;
  let totalScheduledInterest = 0;
  let nextInterestGuaranteeDate: string | null = null;

  const sorted = [...items].sort((a, b) => a.installmentNumber - b.installmentNumber);

  for (const item of sorted) {
    const interestAmount = decimalToNumber(item.interestAmount);
    const paidAmount = decimalToNumber(item.paidAmount);
    totalScheduledInterest += interestAmount;

    if (item.status === "GUARANTEED") {
      guaranteedUnpaidInterest += Math.max(0, interestAmount - paidAmount);
    } else if (item.status === "PENDING") {
      pendingFutureInterest += interestAmount;
      if (!nextInterestGuaranteeDate) {
        nextInterestGuaranteeDate = item.guaranteeDate.toISOString();
      }
    }
  }

  return {
    guaranteedUnpaidInterest: roundCurrency(guaranteedUnpaidInterest),
    pendingFutureInterest: roundCurrency(pendingFutureInterest),
    projectedFullTermCost: roundCurrency(principalAmount + totalScheduledInterest),
    nextInterestGuaranteeDate,
  };
}

export async function calculateLoanPayoffBreakdown(loanId: string): Promise<LoanPayoffBreakdown> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { interestSchedule: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!loan) throw new Error("NOT_FOUND");

  const principalOutstanding = decimalToNumber(loan.principalOutstanding);
  const summary = summarizeInterestSchedule(
    decimalToNumber(loan.principalAmount),
    loan.interestSchedule,
  );

  const guaranteedUnpaidInterest =
    loan.interestSchedule.length > 0
      ? summary.guaranteedUnpaidInterest
      : decimalToNumber(loan.accruedInterest);

  return {
    principalOutstanding,
    guaranteedUnpaidInterest,
    currentPayoffAmount: roundCurrency(principalOutstanding + guaranteedUnpaidInterest),
    pendingFutureInterest: summary.pendingFutureInterest,
    projectedFullTermCost: summary.projectedFullTermCost,
    nextInterestGuaranteeDate: summary.nextInterestGuaranteeDate,
  };
}

export async function createLoanInterestScheduleInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  principalAmount: number,
  termMonths: number,
  disbursementDate: Date,
  interestRate: number,
  rateType: LoanRateType,
): Promise<{ firstGuaranteedInterest: number; itemCount: number }> {
  const drafts = buildLoanInterestScheduleDrafts(
    principalAmount,
    termMonths,
    disbursementDate,
    interestRate,
    rateType,
  );

  if (drafts.length === 0) {
    return { firstGuaranteedInterest: 0, itemCount: 0 };
  }

  await tx.loanInterestScheduleItem.createMany({
    data: drafts.map((draft) => ({
      loanId,
      installmentNumber: draft.installmentNumber,
      guaranteeDate: draft.guaranteeDate,
      interestAmount: draft.interestAmount,
      paidAmount: 0,
      status: draft.initialStatus,
    })),
  });

  const firstGuaranteedInterest =
    drafts.find((d) => d.initialStatus === "GUARANTEED")?.interestAmount ?? 0;

  return { firstGuaranteedInterest, itemCount: drafts.length };
}

export async function applyGuaranteedInterestPaymentInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  amount: number,
  now = new Date(),
): Promise<number> {
  if (amount <= 0) return 0;

  const items = await tx.loanInterestScheduleItem.findMany({
    where: { loanId, status: "GUARANTEED" },
    orderBy: { installmentNumber: "asc" },
  });

  let remaining = amount;
  let appliedTotal = 0;

  for (const item of items) {
    if (remaining <= 0) break;

    const interestAmount = decimalToNumber(item.interestAmount);
    const paidAmount = decimalToNumber(item.paidAmount);
    const unpaid = roundCurrency(interestAmount - paidAmount);
    if (unpaid <= 0) continue;

    const applied = roundCurrency(Math.min(remaining, unpaid));
    const newPaidAmount = roundCurrency(paidAmount + applied);
    remaining = roundCurrency(remaining - applied);
    appliedTotal = roundCurrency(appliedTotal + applied);

    await tx.loanInterestScheduleItem.update({
      where: { id: item.id },
      data: {
        paidAmount: newPaidAmount,
        ...(newPaidAmount >= interestAmount
          ? { status: "PAID" as const, paidAt: now }
          : {}),
      },
    });
  }

  return appliedTotal;
}

export async function waivePendingInterestScheduleInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
): Promise<number> {
  const result = await tx.loanInterestScheduleItem.updateMany({
    where: { loanId, status: "PENDING" },
    data: { status: "WAIVED" },
  });
  return result.count;
}

/** Waives all unpaid interest schedule items (pending + guaranteed). */
export async function waiveUnpaidInterestScheduleInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
): Promise<number> {
  const result = await tx.loanInterestScheduleItem.updateMany({
    where: { loanId, status: { in: ["PENDING", "GUARANTEED"] } },
    data: { status: "WAIVED" },
  });
  return result.count;
}

export async function guaranteeDueInterestForLoan(
  loanId: string,
  actorUserId?: string,
  now = new Date(),
): Promise<GuaranteeInterestResult> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      interestSchedule: {
        where: { status: "PENDING", guaranteeDate: { lte: now } },
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
  if (!loan) throw new Error("NOT_FOUND");

  if (loan.interestSchedule.length === 0) {
    return { guaranteedCount: 0, waivedCount: 0, totalInterestGuaranteed: 0 };
  }

  let guaranteedCount = 0;
  let waivedCount = 0;
  let totalInterestGuaranteed = 0;

  await prisma.$transaction(async (tx) => {
    let principalOutstanding = decimalToNumber(loan.principalOutstanding);
    let accruedInterest = decimalToNumber(loan.accruedInterest);

    for (const item of loan.interestSchedule) {
      if (loan.status !== "ACTIVE") {
        const waived = await tx.loanInterestScheduleItem.updateMany({
          where: { id: item.id, status: "PENDING" },
          data: { status: "WAIVED" },
        });
        if (waived.count === 1) waivedCount += 1;
        continue;
      }

      const interestAmount = decimalToNumber(item.interestAmount);
      const guaranteed = await tx.loanInterestScheduleItem.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "GUARANTEED" },
      });
      if (guaranteed.count !== 1) continue;

      accruedInterest = roundCurrency(accruedInterest + interestAmount);
      totalInterestGuaranteed = roundCurrency(totalInterestGuaranteed + interestAmount);
      guaranteedCount += 1;

      const newPayoff = roundCurrency(principalOutstanding + accruedInterest);
      await tx.loan.update({
        where: { id: loanId },
        data: {
          accruedInterest,
          outstandingBalance: newPayoff,
          lastInterestAccruedAt: now,
          nextInterestAccrualAt: item.guaranteeDate,
        },
      });

      const { createLedgerEntry } = await import("@/server/loan.service");
      await createLedgerEntry(tx, {
        loanId,
        type: "INTEREST_CHARGE",
        amount: interestAmount,
        balanceAfter: newPayoff,
        description: loanInterestChargePaymentDescription(item.installmentNumber),
        createdById: actorUserId,
      });
    }
  });

  return { guaranteedCount, waivedCount, totalInterestGuaranteed };
}

export async function guaranteeDueLoanInterest(
  actorUserId?: string,
  now = new Date(),
): Promise<{
  loansProcessed: number;
  guaranteedCount: number;
  waivedCount: number;
  totalInterestGuaranteed: number;
}> {
  const loans = await prisma.loan.findMany({
    where: {
      interestSchedule: {
        some: { status: "PENDING", guaranteeDate: { lte: now } },
      },
    },
    select: { id: true },
  });

  let guaranteedCount = 0;
  let waivedCount = 0;
  let totalInterestGuaranteed = 0;

  for (const loan of loans) {
    const result = await guaranteeDueInterestForLoan(loan.id, actorUserId, now);
    guaranteedCount += result.guaranteedCount;
    waivedCount += result.waivedCount;
    totalInterestGuaranteed = roundCurrency(totalInterestGuaranteed + result.totalInterestGuaranteed);
  }

  return {
    loansProcessed: loans.length,
    guaranteedCount,
    waivedCount,
    totalInterestGuaranteed,
  };
}

export function computePrincipalRepaymentProgress(
  principalAmount: number,
  principalOutstanding: number,
): { principalRepaid: number; principalPercentRepaid: number } {
  const principalRepaid = roundCurrency(Math.max(0, principalAmount - principalOutstanding));
  const rawPercent = principalAmount > 0 ? (principalRepaid / principalAmount) * 100 : 0;
  return {
    principalRepaid,
    principalPercentRepaid: Math.min(100, Math.max(0, rawPercent)),
  };
}

export async function backfillLoanInterestGuaranteeSchedules(): Promise<{ updated: number }> {
  const loans = await prisma.loan.findMany({
    where: { termMonths: { gt: 0 } },
    include: { interestSchedule: true },
  });

  let updated = 0;
  const now = new Date();

  for (const loan of loans) {
    if (loan.interestSchedule.length > 0) continue;

    const principalAmount = decimalToNumber(loan.principalAmount);
    const termMonths = loan.termMonths ?? 0;
    if (termMonths <= 0) continue;

    const rateType: LoanRateType =
      loan.interestRateType === "ANNUAL_PERCENT" ? "ANNUAL_PERCENT" : "MONTHLY_PERCENT";
    const drafts = buildLoanInterestScheduleDrafts(
      principalAmount,
      termMonths,
      loan.approvedAt,
      decimalToNumber(loan.interestRate),
      rateType,
    );

    await prisma.$transaction(async (tx) => {
      await tx.loanInterestScheduleItem.createMany({
        data: drafts.map((draft) => {
          const isDue = draft.guaranteeDate <= now;
          const isClosed = loan.status === "PAID_OFF" || loan.status === "CANCELLED";
          const shouldGuarantee =
            loan.status === "ACTIVE" &&
            (draft.initialStatus === "GUARANTEED" ||
              (draft.initialStatus === "PENDING" && isDue));
          const shouldWaive =
            isClosed ||
            (draft.initialStatus === "PENDING" && isDue && loan.status !== "ACTIVE");

          return {
            loanId: loan.id,
            installmentNumber: draft.installmentNumber,
            guaranteeDate: draft.guaranteeDate,
            interestAmount: draft.interestAmount,
            paidAmount: 0,
            status: shouldGuarantee
              ? ("GUARANTEED" as const)
              : shouldWaive
                ? ("WAIVED" as const)
                : draft.initialStatus,
          };
        }),
      });

      const items = await tx.loanInterestScheduleItem.findMany({ where: { loanId: loan.id } });

      let guaranteedUnpaid = 0;
      for (const item of items) {
        if (item.status === "GUARANTEED") {
          guaranteedUnpaid +=
            decimalToNumber(item.interestAmount) - decimalToNumber(item.paidAmount);
        }
      }

      const principalOutstanding = decimalToNumber(loan.principalOutstanding);
      const isClosed = loan.status === "PAID_OFF" || loan.status === "CANCELLED";
      const targetAccrued = isClosed
        ? 0
        : roundCurrency(Math.max(guaranteedUnpaid, decimalToNumber(loan.accruedInterest)));

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          accruedInterest: targetAccrued,
          outstandingBalance: roundCurrency(principalOutstanding + targetAccrued),
        },
      });
    });

    updated += 1;
  }

  return { updated };
}

export interface ApplyLoanPaymentInput {
  loanId: string;
  amount: number;
  principalOutstanding: number;
  accruedInterest: number;
}

export function applyLoanPaymentAllocation(
  input: ApplyLoanPaymentInput,
): PaymentAllocationResult {
  return allocateLoanPayment(input.amount, input.principalOutstanding, input.accruedInterest);
}
