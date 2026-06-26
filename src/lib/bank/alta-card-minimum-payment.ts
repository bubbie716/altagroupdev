/** Minimum payment rule for Alta Card statements — isolated for future policy changes. */

export const MINIMUM_PAYMENT_FLOOR_FLR = 100;
export const MINIMUM_PAYMENT_PERCENT = 0.05;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * V1 rule: greater of 5% of statement balance or ƒ100, capped at statement balance.
 */
export function calculateMinimumPayment(statementBalance: number): number {
  if (statementBalance <= 0) return 0;
  const percentDue = statementBalance * MINIMUM_PAYMENT_PERCENT;
  const raw = Math.max(percentDue, MINIMUM_PAYMENT_FLOOR_FLR);
  return roundMoney(Math.min(statementBalance, raw));
}

/** Canonical name for minimum payment calculation (V1 billing policy). */
export const calculateAltaCardMinimumPayment = calculateMinimumPayment;

export function calculateRemainingStatementBalance(
  statementBalance: number,
  amountPaid: number,
): number {
  return roundMoney(Math.max(0, statementBalance - amountPaid));
}

export function deriveStatementStatus(
  statementBalance: number,
  amountPaid: number,
  currentStatus: "issued" | "partially_paid" | "paid" | "overdue",
): "issued" | "partially_paid" | "paid" | "overdue" {
  const remaining = calculateRemainingStatementBalance(statementBalance, amountPaid);
  if (remaining <= 0) return "paid";
  if (amountPaid > 0) return "partially_paid";
  return currentStatus === "overdue" ? "overdue" : "issued";
}
