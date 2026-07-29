/**
 * Deterministic internal search-object key order for SSR/client Link href parity.
 * React hydration compares literal href attributes — query order must match.
 */

/** Preferred key order; remaining keys sort alphabetically. */
export const INTERNAL_SEARCH_KEY_PRIORITY = [
  "site",
  "tab",
  "section",
  "filter",
  "from",
  "category",
  "type",
  "status",
  "sort",
  "case",
  "caseId",
  "q",
  "action",
  "entityType",
  "entityId",
] as const;

const PRIORITY = new Map<string, number>(
  INTERNAL_SEARCH_KEY_PRIORITY.map((key, index) => [key, index]),
);

function isOmittedSearchValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Rebuild a search object with stable key order (same on server and client). */
export function normalizeInternalSearch<T extends Record<string, unknown>>(
  input: T | null | undefined,
): T {
  if (!input || typeof input !== "object") return {} as T;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isOmittedSearchValue(value)) continue;
    cleaned[key] = value;
  }

  const keys = Object.keys(cleaned).sort((a, b) => {
    const pa = PRIORITY.get(a) ?? 1_000;
    const pb = PRIORITY.get(b) ?? 1_000;
    if (pa !== pb) return pa - pb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = cleaned[key];
  }
  return out as T;
}

/** Serialize normalized search for href assertions / return paths. */
export function serializeInternalSearch(
  input: Record<string, unknown> | null | undefined,
): string {
  const normalized = normalizeInternalSearch(input);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    qs.set(key, String(value));
  }
  return qs.toString();
}
