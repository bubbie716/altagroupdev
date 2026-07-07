import type { SiteKey } from "@/config/sites";
import { resolveEntitySiteHostname, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";
import { readRequestHost, resolveSiteKey } from "@/lib/site/site-context";

function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/** Legacy Alta subdomains that should 301 to the entity's canonical production host. */
const LEGACY_ENTITY_HOSTS: Record<string, SiteKey> = {
  "ncc.altagroup.dev": "ncc",
};

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

/** Redirect deprecated entity subdomains to their canonical production domain. */
export function resolveLegacyEntityHostRedirect(
  pathname: string,
  options?: { host?: string; searchStr?: string },
): string | null {
  const host = options?.host ?? readRequestHost();
  const hostname = normalizeHostname(host);
  const siteKey = LEGACY_ENTITY_HOSTS[hostname];
  if (!siteKey) return null;

  const canonicalHost = normalizeHostname(resolveEntitySiteHostname(siteKey));
  if (hostname === canonicalHost) return null;

  return appendSearchString(resolveEntitySiteUrl(siteKey, pathname, host), options?.searchStr);
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
