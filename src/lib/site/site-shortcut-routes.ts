import type { SiteKey } from "@/config/sites";
import { getSiteConfig } from "@/config/sites";

/**
 * Paths that exist on every Alta host and resolve to a site-specific destination.
 * These must stay out of single-site path ownership to avoid cross-domain redirects.
 */
export const SITE_SHORTCUT_PATH_PREFIXES = [
  "/dashboard",
  "/markets",
] as const;

export type SiteShortcutPath = (typeof SITE_SHORTCUT_PATH_PREFIXES)[number];

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

export function isSiteShortcutPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return SITE_SHORTCUT_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Legacy / convenience paths → each site's primary authenticated destination. */
export function resolveLegacyDashboardPath(siteKey: SiteKey): string {
  return getSiteConfig(siteKey).dashboardRoute;
}

/** Legacy "markets" shortcut — all sites resolve to Alta Terminal. */
export function resolveLegacyMarketsPath(_siteKey: SiteKey): string {
  return "/terminal";
}
