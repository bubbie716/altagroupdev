/** Monthly interest calculations for Alta Bank loans V1. */

export type LoanRateType = "ANNUAL_PERCENT" | "MONTHLY_PERCENT";

export function monthlyRateFromAnnual(annualPercent: number): number {
  return annualPercent / 12 / 100;
}

export function monthlyRateFromPercent(monthlyPercent: number): number {
  return monthlyPercent / 100;
}

export function computeMonthlyInterestCharge(
  outstandingBalance: number,
  ratePercent: number,
  rateType: LoanRateType = "MONTHLY_PERCENT",
): number {
  if (outstandingBalance <= 0 || ratePercent <= 0) return 0;
  const monthlyRate =
    rateType === "MONTHLY_PERCENT"
      ? monthlyRateFromPercent(ratePercent)
      : monthlyRateFromAnnual(ratePercent);
  const charge = outstandingBalance * monthlyRate;
  return Math.round(charge * 100) / 100;
}

/** Project outstanding balance after monthly compounding with no payments. */
export function estimateOutstandingAfterTerm(
  principal: number,
  monthlyRatePercent: number,
  termMonths: number,
): { totalOutstanding: number; totalInterest: number } {
  if (principal <= 0 || termMonths <= 0 || monthlyRatePercent <= 0) {
    return { totalOutstanding: principal, totalInterest: 0 };
  }

  let balance = principal;
  for (let month = 0; month < termMonths; month++) {
    const charge = computeMonthlyInterestCharge(balance, monthlyRatePercent, "MONTHLY_PERCENT");
    balance = Math.round((balance + charge) * 100) / 100;
  }

  return {
    totalOutstanding: balance,
    totalInterest: Math.round((balance - principal) * 100) / 100,
  };
}

export function formatInterestRateLabel(
  ratePercent: number,
  rateType: LoanRateType = "MONTHLY_PERCENT",
): string {
  if (rateType === "MONTHLY_PERCENT") {
    return `${ratePercent.toFixed(2)}% monthly`;
  }
  return `${ratePercent.toFixed(2)}% APR`;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
