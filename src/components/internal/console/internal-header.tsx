"use client";

import { useInternalShell } from "@/components/internal/console/internal-shell-context";
import { InternalBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { InternalGlobalSearch } from "@/components/internal/internal-global-search";
import { InternalNotificationsBell } from "@/components/internal/internal-notifications-bell";

export function InternalHeader() {
  const { page } = useInternalShell();

  return (
    <header className="internal-header sticky top-0 z-30 shrink-0 border-b border-border/80 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <InternalBreadcrumbs items={page.breadcrumbs} />
          <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">{page.title}</h1>
        </div>

        {page.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{page.actions}</div> : null}

        <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto sm:min-w-[14rem] sm:max-w-xs lg:max-w-sm">
          <InternalGlobalSearch variant="header" />
          <InternalNotificationsBell variant="header" />
        </div>
      </div>
    </header>
  );
}
