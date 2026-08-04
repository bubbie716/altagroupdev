import { findNextDueInstallment } from "@/lib/bank/loan-payment-schedule";
import type { LoanRow, LoanStatusCode } from "@/lib/bank/lending-types";
import { formatInNewYork } from "@/lib/format-datetime";

/** Normalize persisted/UI-Lab status casing at the customer presentation boundary. */
export function normalizeLoanStatus(status: LoanStatusCode | string): LoanStatusCode {
  switch (String(status).trim().toLowerCase()) {
    case "active":
      return "active";
    case "frozen":
      return "frozen";
    case "paid_off":
    case "paid-off":
      return "paid_off";
    case "defaulted":
      return "defaulted";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      // Unknown states are safest in history until the server supplies a
      // supported servicing state; never present them as payable.
      return "cancelled";
  }
}

export function isActiveLoan(status: LoanStatusCode | string): boolean {
  const normalized = normalizeLoanStatus(status);
  return normalized === "active" || normalized === "frozen";
}

export function isPreviousLoan(status: LoanStatusCode | string): boolean {
  const normalized = normalizeLoanStatus(status);
  return normalized === "paid_off" || normalized === "cancelled" || normalized === "defaulted";
}

export function splitLoansByServicing(loans: LoanRow[]): {
  active: LoanRow[];
  previous: LoanRow[];
} {
  const active: LoanRow[] = [];
  const previous: LoanRow[] = [];
  for (const loan of loans) {
    if (isActiveLoan(loan.status)) active.push(loan);
    else previous.push(loan);
  }
  return { active, previous };
}

export function resolveLoanNextDue(loan: LoanRow): { date: string; amount: number } | null {
  const status = normalizeLoanStatus(loan.status);
  if (status === "paid_off" || status === "cancelled" || loan.currentPayoffAmount <= 0.005) {
    return null;
  }
  const next = findNextDueInstallment(loan.paymentSchedule);
  if (!next || loan.nextPaymentDueAmount == null || loan.nextPaymentDueAmount <= 0) return null;
  return { date: next.dueDate, amount: loan.nextPaymentDueAmount };
}

export function formatLoanDueDate(date: string, style: "short" | "long" = "short"): string {
  return formatInNewYork(date, {
    month: "short",
    day: "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

export function formatLoanReference(loanId: string): string {
  return loanId.slice(0, 10).toUpperCase();
}

export type ActiveLoansSummary = {
  totalBalance: number;
  nextDue: { date: string; amount: number } | null;
  activeCount: number;
};

export function computeActiveLoansSummary(activeLoans: LoanRow[]): ActiveLoansSummary {
  let totalBalance = 0;
  let nextDue: { date: string; amount: number } | null = null;

  for (const loan of activeLoans) {
    totalBalance += loan.currentPayoffAmount;
    const due = resolveLoanNextDue(loan);
    if (due && (!nextDue || new Date(due.date) < new Date(nextDue.date))) {
      nextDue = due;
    }
  }

  return { totalBalance, nextDue, activeCount: activeLoans.length };
}
