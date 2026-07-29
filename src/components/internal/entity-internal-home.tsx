"use client";

import { Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsEmptyState } from "@/components/internal/console/ops-empty-state";
import type { SiteKey } from "@/config/sites";
import { getSiteConfig } from "@/config/sites";

export function EntityInternalHome({ siteKey }: { siteKey: SiteKey }) {
  const site = getSiteConfig(siteKey);
  const settingsPath =
    siteKey === "exchange" ? "/internal/exchange/settings" : "/internal/terminal/settings";

  return (
    <InternalPageShell title={`${site.displayName} Internal`}>
      <div className="mx-auto max-w-xl">
        <OpsEmptyState
          title="Legacy host maintenance only"
          description={
            siteKey === "exchange"
              ? "This host is a legacy redirect surface for Alta Terminal. Day-to-day Terminal operations live on the Terminal site console. Use maintenance settings here only for this host’s public-site controls."
              : `${site.displayName} internal tools are limited to site maintenance.`
          }
          action={
            <Link
              to={settingsPath}
              className="inline-flex items-center rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-border-strong hover:text-foreground"
            >
              Maintenance settings
            </Link>
          }
          className="px-4 py-10 sm:px-6"
        />
      </div>
    </InternalPageShell>
  );
}
