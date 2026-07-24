import type { SiteKey } from "@/config/sites";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";
import { readRequestHost, resolveSiteKey } from "@/lib/site/site-context";

function parseSearchRecord(searchStr?: string): Record<string, unknown> | undefined {
  if (!searchStr || searchStr === "?") return undefined;
  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  if (!normalized) return undefined;
  return Object.fromEntries(new URLSearchParams(normalized));
}

function appendSearchString(href: string, searchStr?: string): string {
  if (!searchStr || searchStr === "?") return href;
  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  if (!normalized) return href;
  const url = new URL(href);
  const incoming = new URLSearchParams(normalized);
  incoming.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/** @deprecated Legacy entity subdomain redirects are no longer used. */
export function resolveLegacyEntityHostRedirect(
  _pathname: string,
  _options?: { host?: string; searchStr?: string },
): string | null {
  return null;
}

/**
 * Redirect when a path is visited on the wrong Alta site host
 * (e.g. /structure on bank.altagroup.dev → altagroup.dev/structure).
 */
export function resolveCrossSitePathRedirect(
  pathname: string,
  options?: {
    host?: string;
    searchStr?: string;
    search?: Record<string, unknown>;
  },
): string | null {
  const host = options?.host ?? readRequestHost();
  const pathOwner = siteKeyForOwnedPath(pathname);
  if (!pathOwner) return null;

  const search =
    options?.search ??
    parseSearchRecord(typeof options?.searchStr === "string" ? options.searchStr : undefined);

  const currentSiteKey = resolveSiteKey({
    host,
    search,
    pathname,
    allowDevOverride: true,
  });

  if (currentSiteKey === pathOwner) return null;

  return appendSearchString(
    resolveEntitySiteUrl(pathOwner, pathname, host),
    options?.searchStr,
  );
}

/** @deprecated Use resolveCrossSitePathRedirect */
export function resolveEntitySubdomainRedirect(
  pathname: string,
  options?: { host?: string; searchStr?: string },
): string | null {
  return resolveCrossSitePathRedirect(pathname, options);
}

export { siteKeyForEntityPath } from "@/lib/site/site-path-ownership";
