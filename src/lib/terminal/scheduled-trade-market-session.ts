import type { MarketSessionStatus } from "@/lib/terminal/types";

export type ScheduledTradeMarketSessionDecision =
  | { allow: true }
  | { allow: false; deferUntil: Date; reason: "market_unavailable" };

/**
 * Provisional regular-session gate until Newport exposes authoritative hours.
 * Closed/holiday → defer to next UTC calendar day 14:30 (09:30 ET approximation).
 * Pre/after hours → defer to next regular open (same provisional anchor).
 */
export function canAttemptScheduledTrade(
  now: Date,
  marketStatus: MarketSessionStatus,
): ScheduledTradeMarketSessionDecision {
  if (marketStatus === "open") {
    return { allow: true };
  }

  return {
    allow: false,
    deferUntil: nextProvisionalRegularOpenUtc(now),
    reason: "market_unavailable",
  };
}

/** Next UTC day at 14:30 — provisional regular-session open until Newport hours API exists. */
export function nextProvisionalRegularOpenUtc(from: Date): Date {
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 14, 30, 0, 0),
  );
  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}
