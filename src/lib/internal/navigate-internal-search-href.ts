/**
 * Safely parse an internal search-result destination into pathname + search
 * for TanStack Router navigate({ to, search, hash }).
 *
 * Never pass a full URL that already contains `?` as `to` alone — that can
 * produce malformed query concatenation such as `?site=bank?tab=overview`.
 */
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";

export type InternalSearchNavigation = {
  to: string;
  search: Record<string, string>;
  hash?: string;
};

/**
 * Parse an absolute-path internal href into a navigable destination.
 * Rejects non-`/internal` destinations (returns null).
 */
export function parseInternalSearchHref(
  href: string,
  siteKey?: string | null,
): InternalSearchNavigation | null {
  const raw = href?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw, "https://alta.local");
  } catch {
    return null;
  }

  if (!url.pathname.startsWith("/internal")) return null;

  const search: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (value !== "") search[key] = value;
  });

  if (siteKey && siteKey.trim() && !search.site) {
    search.site = siteKey.trim();
  }

  const hash = url.hash.replace(/^#/, "");
  return {
    to: url.pathname,
    search: normalizeInternalSearch(search) as Record<string, string>,
    ...(hash ? { hash } : {}),
  };
}

/** True when a serialized href would contain a second `?` (malformed). */
export function hrefHasDuplicateQueryDelimiter(href: string): boolean {
  const q = href.indexOf("?");
  if (q < 0) return false;
  return href.indexOf("?", q + 1) >= 0;
}
