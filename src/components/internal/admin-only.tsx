"use client";

import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/auth/permissions";
import { OPS_COPY } from "@/lib/internal/console/ops-copy";

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user ? isAdmin(user) : false;
}

/** Renders children only for admin users; operators see clean permission copy. */
export function AdminOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const admin = useIsAdmin();
  if (!admin) {
    return (
      fallback ?? (
        <p className="text-[12px] text-muted-foreground">{OPS_COPY.adminRequired}</p>
      )
    );
  }
  return children;
}
