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

function isCorporatePanelPath(path: string): boolean {
  if (path === "/internal/bank" || path.startsWith("/internal/bank/")) return false;
  if (path === "/internal/terminal" || path.startsWith("/internal/terminal/")) return false;
  if (path === "/internal/exchange" || path.startsWith("/internal/exchange/")) return false;
  if (path.startsWith("/internal/lending")) return false;
  if (path.startsWith("/internal/alta-card")) return false;
  return true;
}

function isBankPanelPath(path: string): boolean {
  if (path === "/internal/bank" || path.startsWith("/internal/bank/")) return true;
  if (path === "/internal/inbox" || path.startsWith("/internal/inbox/")) return true;
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

/**
 * Terminal site / terminal_admin panel paths.
 * Includes investor deep-links into customer/company workspaces (Bank data redacted in UI).
 * Never includes Bank money / lending / card operations.
 */
function isTerminalPanelPath(path: string, siteKey: SiteKey): boolean {
  if (path === "/internal") return true;
  if (siteKey === "terminal") {
    if (path === "/internal/terminal" || path.startsWith("/internal/terminal/")) return true;
    if (path.startsWith("/internal/users")) return true;
    if (path.startsWith("/internal/companies")) return true;
    return false;
  }
  if (siteKey === "exchange") {
    if (path === "/internal/exchange" || path.startsWith("/internal/exchange/")) return true;
    return false;
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

  if (siteKey === "corporate") {
    if (!isCorporatePanelPath(path)) {
      throw redirect({ to: "/internal" });
    }
  } else if (siteKey === "bank") {
    if (!isBankPanelPath(path)) {
      throw redirect({ to: "/internal/bank" });
    }
  } else if (siteKey === "exchange") {
    if (!isTerminalPanelPath(path, "exchange")) {
      throw redirect({ to: "/internal" });
    }
  } else if (siteKey === "terminal") {
    if (!isTerminalPanelPath(path, "terminal")) {
      throw redirect({ to: "/internal" });
    }
  } else if (siteKey === "accounting") {
    if (!user || !isCorporateAdmin(user)) {
      throw redirect({ to: "/access-restricted" });
    }
    throw redirect({ to: "/accounting" });
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

/** Non-throwing access check for nav filtering (mirrors assertEntityInternalRouteAccess). */
export function isInternalPathAllowedForUser(
  siteKey: SiteKey,
  pathname: string,
  user?: AltaUser | null,
): boolean {
  const path = normalizePathname(pathname);

  if (siteKey === "accounting") {
    return Boolean(user && isCorporateAdmin(user));
  }

  if (siteKey === "corporate" && !isCorporatePanelPath(path)) {
    return false;
  }
  if (siteKey === "bank" && !isBankPanelPath(path)) {
    return false;
  }
  if (siteKey === "exchange") {
    return isTerminalPanelPath(path, "exchange");
  }
  if (siteKey === "terminal") {
    return isTerminalPanelPath(path, "terminal");
  }

  if (!user) return true;
  if (isCorporateAdmin(user)) return true;

  if (isBankAdmin(user) && !isCorporateAdmin(user)) {
    if (siteKey !== "bank") return false;
    return !isCorporateOnlyPath(path) && isBankPanelPath(path);
  }

  if (isTerminalAdmin(user)) {
    return false;
  }

  return true;
}
