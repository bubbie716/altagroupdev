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
  paidAmount?: number;
  status: "pending" | "partial" | "paid" | "overdue" | "failed";
}

export function scheduleInstallmentRemaining(
  item: Pick<ScheduleItemLike, "scheduledAmount" | "paidAmount" | "status">,
): number {
  if (item.status === "paid") return 0;
  const paid = item.paidAmount ?? 0;
  return Math.max(0, Math.round((item.scheduledAmount - paid) * 100) / 100);
}

export function resolveNextInstallmentPaymentAmount(
  installment: Pick<ScheduleItemLike, "scheduledAmount" | "paidAmount" | "status"> | null,
): number {
  if (!installment) return 0;
  return scheduleInstallmentRemaining(installment);
}

export function isPartiallyPaidInstallment(scheduledAmount: number, paidAmount: number): boolean {
  return paidAmount > 0.005 && paidAmount < scheduledAmount - 0.005;
}

export function resolveScheduleItemStatus(
  status: ScheduleItemLike["status"],
  dueDate: Date,
  now = new Date(),
): ScheduleItemLike["status"] {
  if (status === "paid" || status === "failed" || status === "partial") return status;
  return dueDate < now ? "overdue" : "pending";
}

/** Derive customer-facing installment status including partial payments. */
export function resolveScheduleInstallmentDisplayStatus(
  dbStatus: "pending" | "paid" | "overdue" | "failed",
  dueDate: Date,
  scheduledAmount: number,
  paidAmount: number,
  now = new Date(),
): ScheduleItemLike["status"] {
  if (dbStatus === "paid") return "paid";
  if (dbStatus === "failed") return "failed";
  if (isPartiallyPaidInstallment(scheduledAmount, paidAmount)) return "partial";
  return resolveScheduleItemStatus(dbStatus, dueDate, now);
}

export function findNextDueInstallment<T extends ScheduleItemLike>(
  items: T[],
  now = new Date(),
): T | null {
  const open = items
    .filter((item) => scheduleInstallmentRemaining(item) > 0.005)
    .map((item) => ({
      ...item,
      status:
        item.status === "partial"
          ? "partial"
          : resolveScheduleItemStatus(item.status, new Date(item.dueDate), now),
    }))
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  return open[0] ?? null;
}

export function formatNextPaymentDueLabel(
  next: Pick<ScheduleItemLike, "dueDate" | "scheduledAmount" | "paidAmount" | "status"> | null,
  formatDate: (value: Date) => string,
): string {
  if (!next) return "No payments scheduled";
  const remaining = scheduleInstallmentRemaining(next);
  if (remaining <= 0.005) return "No payments scheduled";
  const formatted = remaining.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatDate(new Date(next.dueDate))} · ƒ${formatted}`;
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
      schedule.reduce((sum, item) => sum + scheduleInstallmentRemaining(item), 0) * 100,
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

export type ScheduleInstallmentPaymentState = {
  id: string;
  scheduledAmount: number;
  paidAmount: number;
};

export type ScheduleInstallmentPaymentUpdate = {
  id: string;
  paidAmount: number;
  fullyPaid: boolean;
};

/** Apply a payment across open installments in order (supports partial payments). */
export function allocatePaymentToScheduleInstallments(
  installments: ScheduleInstallmentPaymentState[],
  amount: number,
): {
  updates: ScheduleInstallmentPaymentUpdate[];
  primaryInstallmentId: string | null;
  remaining: number;
} {
  if (amount <= 0 || installments.length === 0) {
    return { updates: [], primaryInstallmentId: null, remaining: amount };
  }

  let remaining = Math.round(amount * 100) / 100;
  let primaryInstallmentId: string | null = null;
  const updates: ScheduleInstallmentPaymentUpdate[] = [];

  for (const item of installments) {
    if (remaining <= 0) break;

    const unpaid = Math.round((item.scheduledAmount - item.paidAmount) * 100) / 100;
    if (unpaid <= 0) continue;

    if (!primaryInstallmentId) primaryInstallmentId = item.id;

    const applied = Math.round(Math.min(remaining, unpaid) * 100) / 100;
    const paidAmount = Math.round((item.paidAmount + applied) * 100) / 100;
    remaining = Math.round((remaining - applied) * 100) / 100;
    const fullyPaid = paidAmount >= item.scheduledAmount - 0.005;

    updates.push({ id: item.id, paidAmount, fullyPaid });
  }

  return { updates, primaryInstallmentId, remaining };
}

/** Rebuild installment paid amounts from chronological completed payments. */
export function rebuildScheduleInstallmentPayments(
  installments: ScheduleInstallmentPaymentState[],
  paymentAmounts: number[],
): {
  installmentStates: Array<ScheduleInstallmentPaymentState & { fullyPaid: boolean }>;
  paymentInstallmentIds: Array<string | null>;
} {
  const states = installments.map((item) => ({
    ...item,
    paidAmount: 0,
    fullyPaid: false,
  }));
  const paymentInstallmentIds: Array<string | null> = [];

  for (const paymentAmount of paymentAmounts) {
    const snapshot = states.map((item) => ({
      id: item.id,
      scheduledAmount: item.scheduledAmount,
      paidAmount: item.paidAmount,
    }));
    const { updates, primaryInstallmentId } = allocatePaymentToScheduleInstallments(
      snapshot,
      paymentAmount,
    );
    for (const update of updates) {
      const state = states.find((entry) => entry.id === update.id);
      if (!state) continue;
      state.paidAmount = update.paidAmount;
      state.fullyPaid = update.fullyPaid;
    }
    paymentInstallmentIds.push(primaryInstallmentId);
  }

  return { installmentStates: states, paymentInstallmentIds };
}
