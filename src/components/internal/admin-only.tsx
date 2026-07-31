"use client";

import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { SiteKey } from "@/config/sites";
import { canAccessInternalForSite } from "@/lib/auth/permissions";
import { OPS_COPY } from "@/lib/internal/console/ops-copy";

export function useIsAdmin(siteKey: SiteKey = "corporate"): boolean {
  const user = useCurrentUser();
  return user ? canAccessInternalForSite(user, siteKey) : false;
}

/** Renders children for an admin of the action's owning Alta site. */
export function AdminOnly({
  children,
  fallback,
  siteKey = "corporate",
}: {
  children: ReactNode;
  fallback?: ReactNode;
  siteKey?: SiteKey;
}) {
  const admin = useIsAdmin(siteKey);
  if (!admin) {
    return (
      fallback ?? (
        <p className="text-[12px] text-muted-foreground">{OPS_COPY.adminRequired}</p>
      )
    );
  }
  return children;
}
