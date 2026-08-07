/** Format cents as Alta florins (e.g. 12345 -> "ƒ123.45"). */
export function centsToFlorins(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `−ƒ${formatted}` : `ƒ${formatted}`;
}

/** Parse florin/dollar input string to cents (e.g. "123.45" -> 12345). */
export function florinsToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
