import type { SiteKey } from "@/config/sites";
import { resolveEntitySiteHostname } from "@/lib/site/entity-site-url";

/** Canonical OAuth origin for a site — keeps www/apex and callback/return URLs aligned. */
export function normalizeOAuthOrigin(requestUrl: URL, siteKey: SiteKey): string {
  if (process.env.NODE_ENV !== "production" || siteKey === "corporate") {
    return requestUrl.origin;
  }

  const canonicalHost = resolveEntitySiteHostname(siteKey);
  const secure = requestUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${canonicalHost}`;
}
