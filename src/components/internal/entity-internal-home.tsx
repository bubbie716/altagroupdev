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
      <OpsEmptyState
        title="Operations console coming soon"
        description={`${site.displayName} internal tools are not available yet. Alta Group operators can manage the full platform from the group internal console.`}
        action={
          <Link
            to={settingsPath}
            className="inline-flex items-center rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-border-strong hover:text-foreground"
          >
            Maintenance settings
          </Link>
        }
      />
    </InternalPageShell>
  );
}
