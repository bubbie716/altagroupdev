/**
 * Preserve localhost multi-site `?site=` when composing internal search updates.
 * Production host-based sites ignore this (devSiteSearchParams returns undefined for corporate).
 */
import type { SiteKey } from "@/config/sites";
import { DEV_SITE_SEARCH_KEY } from "@/lib/site/local-dev-site";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";

export function readDevSiteFromSearch(
  search: unknown,
): string | undefined {
  let record: Record<string, unknown> | null = null;
  if (typeof search === "string") {
    const query = search.startsWith("?") ? search.slice(1) : search;
    record = Object.fromEntries(new URLSearchParams(query).entries());
  } else if (search && typeof search === "object") {
    record = search as Record<string, unknown>;
  }
  if (!record) return undefined;
  const raw = record[DEV_SITE_SEARCH_KEY];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

/** Read the localhost site override from any TanStack location shape. */
export function readDevSiteFromLocation(location: {
  search?: unknown;
  searchStr?: string;
  href?: string;
}): string | undefined {
  const direct = readDevSiteFromSearch(location.searchStr ?? location.search);
  if (direct) return direct;
  if (typeof location.href === "string") {
    try {
      return readDevSiteFromSearch(new URL(location.href).search);
    } catch {
      // Relative hrefs are handled by the search/searchStr branch above.
    }
  }
  return undefined;
}

/**
 * Merge a next search object with the previous validated search so `site`
 * (and optionally other keys) survive tab/filter/case updates.
 * Always returns a deterministically ordered object for Link href parity.
 */
export function preserveDevSiteSearch<T extends Record<string, unknown>>(
  prev: Record<string, unknown> | undefined | null,
  next: T,
  explicitSite?: string | null,
): T & { site?: string } {
  const site =
    (typeof explicitSite === "string" && explicitSite.trim() ? explicitSite.trim() : undefined) ??
    readDevSiteFromSearch(prev) ??
    (typeof next.site === "string" && next.site.trim() ? next.site.trim() : undefined);

  const merged = (site ? { ...next, site } : { ...next }) as T & { site?: string };
  return normalizeInternalSearch(merged);
}

/** Normalize an optional site string for redirect search payloads. */
export function siteSearchPatch(site: string | undefined | null): { site?: string } {
  if (typeof site === "string" && site.trim()) {
    return normalizeInternalSearch({ site: site.trim() });
  }
  return {};
}

export function isKnownDevSiteKey(value: string | undefined | null): value is SiteKey {
  return (
    value === "corporate" ||
    value === "bank" ||
    value === "terminal" ||
    value === "exchange" ||
    value === "accounting"
  );
}

/** Shared validateSearch for legacy redirect routes that only carry `site`. */
export function validateDevSiteSearch(s: Record<string, unknown>): { site?: string } {
  const site = readDevSiteFromSearch(s);
  return site ? normalizeInternalSearch({ site }) : {};
}
