import { redirect } from "@tanstack/react-router";
import type { SiteKey } from "@/config/sites";

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

/** Restrict entity internal consoles to site-appropriate routes. */
export function assertEntityInternalRouteAccess(siteKey: SiteKey, pathname: string): void {
  const path = normalizePathname(pathname);

  if (siteKey === "corporate" || siteKey === "bank") {
    return;
  }

  if (siteKey === "exchange") {
    if (path === "/internal" || path === "/internal/exchange/settings") return;
    throw redirect({ to: "/internal" });
  }

  if (siteKey === "terminal") {
    if (path === "/internal" || path === "/internal/terminal/settings") return;
    throw redirect({ to: "/internal" });
  }

  if (siteKey === "ncc") {
    throw redirect({ to: "/access-restricted" });
  }
}

/** Default internal home route for the active site. */
export function internalHomePathForSite(siteKey: SiteKey): string {
  if (siteKey === "bank") return "/internal/bank";
  return "/internal";
}
