import type { AltaUser } from "@/lib/auth/types";
import { canBypassMaintenanceMode } from "@/lib/auth/permissions";
import { isUiLabMode } from "@/lib/auth/ui-lab";

/**
 * Paths that must never be redirected to /maintenance.
 * Lockout prevention: auth, APIs, and the maintenance page itself stay reachable.
 */
const MAINTENANCE_EXEMPT_PREFIXES = [
  "/maintenance",
  "/login",
  "/access-restricted",
  "/api/",
] as const;

export function isMaintenanceExemptPath(pathname: string): boolean {
  if (MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }
  return false;
}

export function isMaintenanceBypassUser(user: AltaUser | null | undefined): boolean {
  return canBypassMaintenanceMode(user);
}

export function shouldEnforceMaintenance(pathname: string, user: AltaUser | null): boolean {
  if (isUiLabMode()) return false;
  if (isMaintenanceExemptPath(pathname)) return false;
  // Admins/operators retain full platform access during maintenance.
  if (isMaintenanceBypassUser(user)) return false;
  return true;
}
