import { findNextDueInstallment } from "@/lib/bank/loan-payment-schedule";
import type { LoanRow, LoanStatusCode } from "@/lib/bank/lending-types";

export function isActiveLoan(status: LoanStatusCode): boolean {
  return status === "active" || status === "frozen";
}

export function isPreviousLoan(status: LoanStatusCode): boolean {
  return status === "paid_off" || status === "cancelled" || status === "defaulted";
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
  if (loan.status === "paid_off" || loan.status === "cancelled" || loan.currentPayoffAmount <= 0.005) {
    return null;
  }
  const next = findNextDueInstallment(loan.paymentSchedule);
  if (!next || loan.nextPaymentDueAmount == null || loan.nextPaymentDueAmount <= 0) return null;
  return { date: next.dueDate, amount: loan.nextPaymentDueAmount };
}

export function formatLoanDueDate(date: string, style: "short" | "long" = "short"): string {
  return new Date(date).toLocaleDateString(undefined, {
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
