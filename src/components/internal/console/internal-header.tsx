"use client";

import { Menu } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useInternalShell } from "@/components/internal/console/internal-shell-context";
import { InternalBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { InternalGlobalSearch } from "@/components/internal/internal-global-search";
import { InternalInboxShortcut } from "@/components/internal/internal-inbox-shortcut";
import { AdminCopilotTrigger } from "@/components/internal/copilot/admin-copilot-panel";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";

export function InternalHeader() {
  const { page, mobileNavOpen, setMobileNavOpen } = useInternalShell();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pageForRoute = page.pathname === pathname ? page : null;
  const title = pageForRoute?.title?.trim() || resolveInternalRouteTitle(pathname);
  const breadcrumbs = pageForRoute?.breadcrumbs ?? [];
  const actions = pageForRoute?.actions ?? null;

  return (
    <header className="internal-header sticky top-0 z-30 order-1 shrink-0 border-b border-border/80 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          className="internal-mobile-nav-trigger inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border/80 text-foreground hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
          aria-controls={undefined}
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <Menu className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <InternalBreadcrumbs items={breadcrumbs} />
          <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">{title}</h1>
        </div>

        {actions ? (
          <div className="order-last flex w-full shrink-0 flex-wrap items-center gap-2 sm:order-none sm:w-auto">
            {actions}
          </div>
        ) : null}

        <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto sm:min-w-[14rem] sm:max-w-xs lg:max-w-sm">
          <InternalGlobalSearch variant="header" />
          <AdminCopilotTrigger />
          <InternalInboxShortcut />
        </div>
      </div>
    </header>
  );
}
