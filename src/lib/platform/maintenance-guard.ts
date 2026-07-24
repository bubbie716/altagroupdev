import type { AltaUser } from "@/lib/auth/types";
import { canBypassMaintenanceMode } from "@/lib/auth/permissions";
import { isUiLabMode } from "@/lib/auth/ui-lab";

/**
 * Paths that stay reachable during maintenance for everyone
 * (lockout prevention + the maintenance page itself).
 */
const MAINTENANCE_ALWAYS_EXEMPT_PREFIXES = [
  "/maintenance",
  "/access-restricted",
  "/api/",
] as const;

/** Sign-in surfaces — reachable while unsigned so users can authenticate during maintenance. */
const MAINTENANCE_SIGN_IN_PATHS = new Set(["/", "/login"]);

export function isMaintenanceAlwaysExemptPath(pathname: string): boolean {
  return MAINTENANCE_ALWAYS_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function isMaintenanceSignInPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return MAINTENANCE_SIGN_IN_PATHS.has(normalized);
}

/** @deprecated Prefer isMaintenanceAlwaysExemptPath / isMaintenanceSignInPath. */
export function isMaintenanceExemptPath(pathname: string): boolean {
  return isMaintenanceAlwaysExemptPath(pathname) || isMaintenanceSignInPath(pathname);
}

export function isMaintenanceBypassUser(user: AltaUser | null | undefined): boolean {
  return canBypassMaintenanceMode(user);
}

/**
 * Whether to force redirect to /maintenance.
 * Unsigned users may still reach sign-in (`/` or `/login`).
 * Only admins bypass maintenance after signing in.
 */
export function shouldEnforceMaintenance(pathname: string, user: AltaUser | null): boolean {
  if (isUiLabMode()) return false;
  if (isMaintenanceAlwaysExemptPath(pathname)) return false;
  if (isMaintenanceBypassUser(user)) return false;
  // Allow Discord sign-in while maintenance is up; signed-in non-admins still get redirected.
  if (!user && isMaintenanceSignInPath(pathname)) return false;
  return true;
}
