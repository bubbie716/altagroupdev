import type { SiteKey } from "@/config/sites";
import {
  isPlainLocalDevHost,
  siteKeyForEntityPath,
  usesLocalhostSiteParam,
} from "@/lib/site/local-dev-site";
import { resolveEntitySiteHostname, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { readRequestHost, resolveSiteKeyFromHost } from "@/lib/site/site-context";

function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/** Legacy Alta subdomains that should 301 to the entity's canonical production host. */
const LEGACY_ENTITY_HOSTS: Record<string, SiteKey> = {
  "ncc.altagroup.dev": "ncc",
};

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

/** Redirect entity app paths served on the wrong host to the entity subdomain (prod only). */
export function resolveEntitySubdomainRedirect(
  pathname: string,
  options?: { host?: string; searchStr?: string },
): string | null {
  const host = options?.host ?? readRequestHost();

  // Local dev on plain localhost uses ?site= + path-based context — no subdomain redirect.
  if (usesLocalhostSiteParam(host)) {
    return null;
  }

  const hostSiteKey = resolveSiteKeyFromHost(host);
  const pathSiteKey = siteKeyForEntityPath(pathname);
  if (!pathSiteKey) return null;

  if (hostSiteKey === pathSiteKey) return null;

  // Plain localhost in production shouldn't happen; subdomain redirect for altagroup.dev, etc.
  if (isPlainLocalDevHost(host)) return null;

  return appendSearchString(
    resolveEntitySiteUrl(pathSiteKey, pathname, host),
    options?.searchStr,
  );
}

export { siteKeyForEntityPath };
