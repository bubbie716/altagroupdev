"use client";

import { Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection, buildBreadcrumbs } from "@/components/internal/console";
import { TerminalEnvironmentBanner } from "@/components/internal/terminal-environment-banner";
import { useSiteContext } from "@/hooks/use-site-context";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import type { TerminalOpsHomeSummary } from "@/lib/terminal/terminal-ops-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

function appendSiteToHref(href: string, site?: string): string {
  if (!site?.trim()) return href;
  try {
    const url = new URL(href, "https://alta.local");
    if (!url.pathname.startsWith("/internal")) return href;
    url.searchParams.set("site", site.trim());
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

export function TerminalInternalHome({ summary }: { summary: TerminalOpsHomeSummary }) {
  const { environment, attention } = summary;
  const site = useSiteContext();
  const siteSearch = withInternalSiteSearch({}, site.key);
  const uniqueAttention = [...new Map(attention.map((item) => [item.id, item])).values()];

  return (
    <InternalPageShell title="Home" breadcrumbs={buildBreadcrumbs([{ label: "Home" }])}>
      <div className="mb-6">
        <TerminalEnvironmentBanner environment={environment} compact />
      </div>

      {uniqueAttention.length > 0 ? (
        <OpsSection title="Needs attention">
          <ul className="space-y-2">
            {uniqueAttention.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-2.5"
              >
                <Link to={appendSiteToHref(item.href, site.key) as "/"} className="block min-w-0">
                  <div className="text-[13px] font-medium hover:text-gold">{item.title}</div>
                  <p className="mt-0.5 break-words text-[12px] text-muted-foreground">{item.detail}</p>
                </Link>
              </li>
            ))}
          </ul>
        </OpsSection>
      ) : null}

      <OpsSection title="Operations snapshot" className={uniqueAttention.length > 0 ? "mt-6" : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Open orders" value={String(summary.openOrderCount)} />
          <Metric label="Rejected orders" value={String(summary.rejectedOrderCount)} />
          <Metric label="Investors" value={String(summary.investorCount)} />
          <Metric label="Active portfolios" value={String(summary.activePortfolioCount)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Metric
            label="Last Terminal activity"
            value={
              summary.lastActivityAt ? formatActivityDateTime(summary.lastActivityAt) : "—"
            }
          />
          {summary.recordedPortfolioValue != null ? (
            <Metric
              label="Portfolio value"
              value={`ƒ${summary.recordedPortfolioValue.toLocaleString()}`}
            />
          ) : (
            <div className="rounded border border-border/70 bg-surface-1/40 px-3 py-2 text-[12px] text-muted-foreground">
              Portfolio value is not shown without trustworthy market data.
            </div>
          )}
        </div>
      </OpsSection>

      <OpsSection title="Directories" className="mt-6">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
          <Link
            to="/internal/terminal/investors"
            search={siteSearch}
            className="text-gold hover:underline"
          >
            Investors
          </Link>
          <Link
            to="/internal/terminal/portfolios"
            search={siteSearch}
            className="text-gold hover:underline"
          >
            Portfolios
          </Link>
          <Link
            to="/internal/terminal/orders"
            search={siteSearch}
            className="text-gold hover:underline"
          >
            Orders
          </Link>
        </div>
      </OpsSection>

      <p className="mt-6 text-[13px] text-muted-foreground">
        System: {environment.label}.{" "}
        <Link to="/internal/terminal/system" search={siteSearch} className="text-gold hover:underline">
          View System
        </Link>
      </p>
    </InternalPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/70 bg-surface-1/40 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}
