/**
 * Merchant analytics percentage contract.
 *
 * Canonical values are whole percentage points in [0, 100]
 * (e.g. 97 means 97%). Never store 0–1 fractions in MerchantAnalytics.
 */

/** Format a 0–100 percentage for customer UI (e.g. `97%`, `3%`, `100%`). */
export function formatMerchantAnalyticsPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = Math.round(clamped * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded}%`;
}

/** True when a value looks like a mistaken 0–1 fraction rather than 0–100 points. */
export function looksLikeFractionalPercent(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 1;
}

export function assertWholePercentagePoints(
  value: number,
  label = "percentage",
): void {
  if (looksLikeFractionalPercent(value)) {
    throw new Error(
      `${label} must be whole percentage points (0–100), not a 0–1 fraction. Got ${value}.`,
    );
  }
}
