import { redirect } from "@tanstack/react-router";
import type { SiteKey } from "@/config/sites";
import type { AltaUser } from "@/lib/auth/types";
import {
  isBankAdmin,
  isCorporateAdmin,
  isTerminalAdmin,
} from "@/lib/auth/permissions";

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

/** Corporate-only internal paths (not available to bank_admin). */
const CORPORATE_ONLY_PREFIXES = ["/internal/settings", "/internal/compliance"] as const;

function isCorporateOnlyPath(path: string): boolean {
  if (path === "/internal") return true;
  return CORPORATE_ONLY_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isBankPanelPath(path: string): boolean {
  if (path === "/internal/bank" || path.startsWith("/internal/bank/")) return true;
  if (path.startsWith("/internal/queues")) return true;
  if (path.startsWith("/internal/users")) return true;
  if (path.startsWith("/internal/companies")) return true;
  if (path.startsWith("/internal/lending")) return true;
  if (path.startsWith("/internal/alta-card")) return true;
  if (path.startsWith("/internal/jobs")) return true;
  if (path.startsWith("/internal/audit")) return true;
  if (path.startsWith("/internal/reports")) return true;
  if (path.startsWith("/internal/embeds")) return true;
  if (path.startsWith("/internal/relationships")) return true;
  return false;
}

function isTerminalPanelPath(path: string, siteKey: SiteKey): boolean {
  if (path === "/internal") return true;
  if (siteKey === "terminal" && (path === "/internal/terminal/settings" || path.startsWith("/internal/terminal/"))) {
    return true;
  }
  if (siteKey === "exchange" && (path === "/internal/exchange/settings" || path.startsWith("/internal/exchange/"))) {
    return true;
  }
  return false;
}

/**
 * Restrict entity internal consoles to site-appropriate routes,
 * then further restrict by staff tag.
 */
export function assertEntityInternalRouteAccess(
  siteKey: SiteKey,
  pathname: string,
  user?: AltaUser | null,
): void {
  const path = normalizePathname(pathname);

  if (siteKey === "exchange") {
    if (path === "/internal" || path === "/internal/exchange/settings") {
      // Tag check below
    } else {
      throw redirect({ to: "/internal" });
    }
  } else if (siteKey === "terminal") {
    if (path === "/internal" || path === "/internal/terminal/settings") {
      // Tag check below
    } else {
      throw redirect({ to: "/internal" });
    }
  }

  if (!user) return;

  if (isCorporateAdmin(user)) return;

  if (isBankAdmin(user) && !isCorporateAdmin(user)) {
    if (siteKey !== "bank") {
      throw redirect({ to: "/access-restricted" });
    }
    // Bank admins never use the corporate master dashboard / group settings.
    if (isCorporateOnlyPath(path) || !isBankPanelPath(path)) {
      throw redirect({ to: "/internal/bank" });
    }
    return;
  }

  if (isTerminalAdmin(user)) {
    if (siteKey !== "terminal" && siteKey !== "exchange") {
      throw redirect({ to: "/access-restricted" });
    }
    if (!isTerminalPanelPath(path, siteKey)) {
      throw redirect({ to: "/internal" });
    }
  }
}

/** Default internal home route for the active site / staff role. */
export function internalHomePathForSite(siteKey: SiteKey, user?: AltaUser | null): string {
  if (user && isBankAdmin(user) && !isCorporateAdmin(user)) {
    return "/internal/bank";
  }
  if (siteKey === "bank") return "/internal/bank";
  return "/internal";
}
