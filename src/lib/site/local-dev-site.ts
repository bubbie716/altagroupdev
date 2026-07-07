import type { SiteKey } from "@/config/sites";
import { siteKeyForEntityPath as ownedEntityPath } from "@/lib/site/site-path-ownership";

export const DEV_SITE_SEARCH_KEY = "site" as const;

export function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/** Plain localhost without an entity subdomain (e.g. localhost:3000). */
export function isPlainLocalDevHost(host: string): boolean {
  const hostname = normalizeHostname(host);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** Use ?site= and path-based context instead of *.localhost subdomains. */
export function usesLocalhostSiteParam(host: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return isPlainLocalDevHost(host);
}

export function siteKeyForEntityPath(pathname: string): SiteKey | null {
  return ownedEntityPath(pathname);
}

export function devSiteSearchParams(
  siteKey: SiteKey,
): Record<string, string> | undefined {
  if (siteKey === "corporate") return undefined;
  return { [DEV_SITE_SEARCH_KEY]: siteKey };
}

/** Whether a localhost link needs ?site= to preserve entity chrome. */
export function needsDevSiteSearchParam(siteKey: SiteKey, to: string): boolean {
  if (siteKey === "corporate") return false;
  const normalized = to.split("?")[0].replace(/\/$/, "") || "/";
  if (normalized === "/") return true;
  return siteKeyForEntityPath(normalized) !== siteKey;
}
