import { addMonths, computeMonthlyInterestCharge, type LoanRateType } from "@/lib/bank/loan-interest";

export interface LoanScheduleInstallmentDraft {
  installmentNumber: number;
  dueDate: Date;
  scheduledAmount: number;
  principalPortion: number;
  interestPortion: number;
}

/** Equal principal per month plus projected monthly interest on the remaining balance. */
export function buildRepaymentScheduleWithInterest(
  principalAmount: number,
  termMonths: number,
  firstDueDate: Date,
  monthlyRatePercent: number,
  rateType: LoanRateType = "MONTHLY_PERCENT",
): LoanScheduleInstallmentDraft[] {
  if (principalAmount <= 0 || termMonths <= 0) return [];

  const basePrincipal = Math.floor((principalAmount / termMonths) * 100) / 100;
  let allocatedPrincipal = 0;
  let balance = principalAmount;
  const items: LoanScheduleInstallmentDraft[] = [];

  for (let i = 1; i <= termMonths; i++) {
    const isLast = i === termMonths;
    const principalPortion = isLast
      ? Math.round((principalAmount - allocatedPrincipal) * 100) / 100
      : basePrincipal;
    const interestPortion = computeMonthlyInterestCharge(balance, monthlyRatePercent, rateType);
    const scheduledAmount = Math.round((principalPortion + interestPortion) * 100) / 100;

    items.push({
      installmentNumber: i,
      dueDate: addMonths(firstDueDate, i - 1),
      scheduledAmount,
      principalPortion,
      interestPortion,
    });

    allocatedPrincipal = Math.round((allocatedPrincipal + principalPortion) * 100) / 100;
    balance = Math.round((balance - principalPortion) * 100) / 100;
  }

  return items;
}

/** @deprecated Use buildRepaymentScheduleWithInterest */
export function buildEqualPrincipalSchedule(
  principalAmount: number,
  termMonths: number,
  firstDueDate: Date,
): LoanScheduleInstallmentDraft[] {
  return buildRepaymentScheduleWithInterest(principalAmount, termMonths, firstDueDate, 0);
}

export function monthlyPrincipalPercent(termMonths: number): number {
  if (termMonths <= 0) return 0;
  return Math.round((100 / termMonths) * 100) / 100;
}

export interface ScheduleItemLike {
  installmentNumber: number;
  dueDate: Date | string;
  scheduledAmount: number;
  status: "pending" | "paid" | "overdue" | "failed";
}

export function resolveScheduleItemStatus(
  status: ScheduleItemLike["status"],
  dueDate: Date,
  now = new Date(),
): ScheduleItemLike["status"] {
  if (status === "paid" || status === "failed") return status;
  return dueDate < now ? "overdue" : "pending";
}

export function findNextDueInstallment<T extends ScheduleItemLike>(
  items: T[],
  now = new Date(),
): T | null {
  const open = items
    .filter((item) => item.status !== "paid" && item.status !== "failed")
    .map((item) => ({
      ...item,
      status: resolveScheduleItemStatus(item.status, new Date(item.dueDate), now),
    }))
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  return open[0] ?? null;
}

export function formatNextPaymentDueLabel(
  next: Pick<ScheduleItemLike, "dueDate" | "scheduledAmount"> | null,
  formatDate: (value: Date) => string,
): string {
  if (!next) return "No payments scheduled";
  const amount = next.scheduledAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatDate(new Date(next.dueDate))} · ƒ${amount}`;
}

export function computeScheduleRepaymentTotals(
  schedule: ScheduleItemLike[],
  fallback: { totalRepaymentObligation: number; amountRepaid: number },
): {
  projectedOutstanding: number;
  totalRepaymentObligation: number;
  amountRepaid: number;
  percentRepaid: number;
} {
  if (schedule.length === 0) {
    const { totalRepaymentObligation, amountRepaid } = fallback;
    const projectedOutstanding = Math.max(0, totalRepaymentObligation - amountRepaid);
    const rawPercent =
      totalRepaymentObligation > 0 ? (amountRepaid / totalRepaymentObligation) * 100 : 0;
    return {
      projectedOutstanding,
      totalRepaymentObligation,
      amountRepaid,
      percentRepaid: Math.min(100, Math.max(0, rawPercent)),
    };
  }

  const totalRepaymentObligation =
    Math.round(schedule.reduce((sum, item) => sum + item.scheduledAmount, 0) * 100) / 100;
  const projectedOutstanding =
    Math.round(
      schedule
        .filter((item) => item.status !== "paid")
        .reduce((sum, item) => sum + item.scheduledAmount, 0) * 100,
    ) / 100;
  const amountRepaid =
    Math.round((totalRepaymentObligation - projectedOutstanding) * 100) / 100;
  const rawPercent =
    totalRepaymentObligation > 0 ? (amountRepaid / totalRepaymentObligation) * 100 : 0;

  return {
    projectedOutstanding,
    totalRepaymentObligation,
    amountRepaid,
    percentRepaid: Math.min(100, Math.max(0, rawPercent)),
  };
}
