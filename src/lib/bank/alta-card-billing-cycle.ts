/** Alta Card V1 calendar billing — statement closes last day of month; due 15 days later. */

export const ALTA_CARD_PAYMENT_DUE_DAYS = 15;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

/** Last day of the calendar month containing `date` (end of day UTC). */
export function getStatementCloseDate(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return endOfUtcDay(lastDay);
}

/** Payment due date: 15 calendar days after statement close (end of day UTC). */
export function getAltaCardDueDate(statementCloseDate: Date): Date {
  const close = startOfUtcDay(statementCloseDate);
  const due = new Date(close);
  due.setUTCDate(due.getUTCDate() + ALTA_CARD_PAYMENT_DUE_DAYS);
  return endOfUtcDay(due);
}

export type AltaCardBillingCycle = {
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  dueDate: Date;
};

/** First billing cycle for a newly opened card. */
export function getInitialBillingCycle(anchorDate: Date): AltaCardBillingCycle {
  const billingPeriodStart = startOfUtcDay(anchorDate);
  const billingPeriodEnd = getStatementCloseDate(anchorDate);
  const dueDate = getAltaCardDueDate(billingPeriodEnd);
  return { billingPeriodStart, billingPeriodEnd, dueDate };
}

/**
 * Next cycle after a closed period.
 * Starts the day after `previousCycleEnd` and ends on the last day of that month.
 */
export function getNextBillingCycle(previousCycleEnd: Date): AltaCardBillingCycle {
  const prevEnd = startOfUtcDay(previousCycleEnd);
  const nextStart = new Date(prevEnd);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  const billingPeriodStart = startOfUtcDay(nextStart);
  const billingPeriodEnd = getStatementCloseDate(billingPeriodStart);
  const dueDate = getAltaCardDueDate(billingPeriodEnd);
  return { billingPeriodStart, billingPeriodEnd, dueDate };
}

/** Payment due for a billing period, derived from its start (calendar month-end policy). */
export function getCalendarPaymentDueForPeriodStart(periodStart: Date): Date {
  return getAltaCardDueDate(getStatementCloseDate(periodStart));
}

/** Statement close for a billing period, derived from its start (calendar month-end policy). */
export function getCalendarStatementCloseForPeriodStart(periodStart: Date): Date {
  return getStatementCloseDate(periodStart);
}

export const ALTA_CARD_BILLING_HELPER_TEXT =
  "New purchases after your statement date appear on your next statement.";

import { formatUtcCalendarDate } from "@/lib/format-datetime";

/** Format a billing calendar date stored as UTC end-of-day (avoids local TZ shifting month-end). */
export function formatAltaCardBillingDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatUtcCalendarDate(iso);
}

export const ALTA_CARD_BILLING_POLICY_LINES = [
  "Statement closes on the last day of every month.",
  "Payment is due 15 days after statement close.",
  "Minimum payment is the greater of 5% of the statement balance or ƒ100 (capped at the statement balance).",
] as const;

/** True when `date` is the last calendar day of its month (UTC). */
export function isLastCalendarDayOfMonth(date = new Date()): boolean {
  const today = startOfUtcDay(date);
  const monthEnd = startOfUtcDay(getStatementCloseDate(date));
  return today.getTime() === monthEnd.getTime();
}

/** True when `date` is the first calendar day of its month (UTC). */
export function isFirstCalendarDayOfMonth(date = new Date()): boolean {
  return date.getUTCDate() === 1;
}

/** True when the billing period for `nextStatementDate` has closed on or before `runDate` (UTC calendar days). */
export function isAltaCardStatementCloseDue(
  nextStatementDate: Date,
  runDate = new Date(),
): boolean {
  return startOfUtcDay(nextStatementDate).getTime() <= startOfUtcDay(runDate).getTime();
}

export type AltaCardStatementSchedulerWindow =
  | { shouldRun: true; mode: "month_end_close" | "month_start_catch_up" | "forced" }
  | { shouldRun: false; skipReason: string };

/**
 * Daily cron runs on month-end after the period closes, or on the 1st as catch-up.
 * Mid-month-end morning runs skip — close is end-of-day UTC, not midnight at day start.
 */
export function resolveAltaCardStatementSchedulerWindow(
  date = new Date(),
  force = false,
): AltaCardStatementSchedulerWindow {
  if (force) return { shouldRun: true, mode: "forced" };

  if (isFirstCalendarDayOfMonth(date)) {
    return { shouldRun: true, mode: "month_start_catch_up" };
  }

  if (isLastCalendarDayOfMonth(date)) {
    if (date.getTime() >= endOfUtcDay(date).getTime()) {
      return { shouldRun: true, mode: "month_end_close" };
    }
    return {
      shouldRun: false,
      skipReason:
        "Billing period still open until end of day (statements generate after close or on the 1st)",
    };
  }

  return {
    shouldRun: false,
    skipReason: "Not the last calendar day of the month",
  };
}
