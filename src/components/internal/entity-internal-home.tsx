"use client";

import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsEmptyState } from "@/components/internal/console/ops-empty-state";
import type { SiteKey } from "@/config/sites";
import { getSiteConfig } from "@/config/sites";

export function EntityInternalHome({ siteKey }: { siteKey: SiteKey }) {
  const site = getSiteConfig(siteKey);

  return (
    <InternalPageShell title={`${site.displayName} Internal`}>
      <OpsEmptyState
        title="Operations console coming soon"
        description={`${site.displayName} internal tools are not available yet. Alta Group operators can manage the full platform from the group internal console.`}
      />
    </InternalPageShell>
  );
}
