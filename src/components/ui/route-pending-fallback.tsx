import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  SkeletonAccountPage,
  SkeletonAccountSurface,
  SkeletonBankContentPage,
  SkeletonBankDashboard,
  SkeletonCorporatePage,
  SkeletonGenericPage,
  SkeletonInternalDashboard,
  SkeletonInternalTablePage,
  SkeletonLegalPage,
  SkeletonMarketsDashboard,
  SkeletonNccDashboard,
} from "@/components/ui/skeleton-pages";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { cn } from "@/lib/utils";

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

/**
 * Pick a structural skeleton that mirrors the destination route.
 * Parent layouts (nav/hero) stay mounted; this fills the outlet only.
 */
export function resolveRouteSkeleton(pathname: string): ReactNode {
  const path = normalizePath(pathname);

  if (path === "/legal" || path.startsWith("/legal/")) {
    return <SkeletonLegalPage />;
  }

  if (path === "/admin" || path === "/dashboard" || path.startsWith("/dashboard/")) {
    return <SkeletonNccDashboard />;
  }

  if (path.startsWith("/internal")) {
    if (path === "/internal" || path === "/internal/bank") {
      return <SkeletonInternalDashboard />;
    }
    if (path.includes("/settings")) {
      return <SkeletonBankContentPage variant="cards" />;
    }
    return <SkeletonInternalTablePage />;
  }

  if (path.startsWith("/bank")) {
    if (path === "/bank") return <SkeletonBankDashboard />;
    if (path.includes("/account/") || path.includes("/accounts/")) {
      return <SkeletonAccountPage />;
    }
    if (
      path.includes("/deposit") ||
      path.includes("/withdraw") ||
      path.includes("/transfer") ||
      path.includes("/open-account")
    ) {
      return <SkeletonBankContentPage variant="form" />;
    }
    if (path.includes("/pay") || path.includes("/commercial") || path.includes("/alta-card")) {
      return <SkeletonBankContentPage variant="cards" />;
    }
    return <SkeletonBankContentPage variant="table" />;
  }

  if (path.startsWith("/terminal") || path.startsWith("/exchange")) {
    return <SkeletonMarketsDashboard />;
  }

  if (path === "/profile" || path.startsWith("/companies")) {
    return <SkeletonAccountSurface />;
  }

  if (path === "/home" || path === "/") {
    return <SkeletonCorporatePage withHeader={false} />;
  }

  if (
    path.startsWith("/company") ||
    path.startsWith("/support") ||
    path.startsWith("/governance") ||
    path.startsWith("/leadership") ||
    path.startsWith("/subsidiaries")
  ) {
    return <SkeletonCorporatePage />;
  }

  return <SkeletonGenericPage />;
}

/**
 * Global TanStack Router pending UI — structural skeletons instead of a spinner.
 * Site chrome from parent layouts remains visible.
 */
export function RoutePendingFallback({
  label = LOADING_COPY.route,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <div className={cn("min-h-0 flex-1 py-2", className)} data-pending-label={label}>
      {resolveRouteSkeleton(pathname)}
    </div>
  );
}
