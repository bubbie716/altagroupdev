import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection, OpsEmptyState, buildBreadcrumbs } from "@/components/internal/console";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { cn } from "@/lib/utils";
import { fetchEnhancedDashboard } from "@/lib/internal/ops-platform.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { EntityInternalHome } from "@/components/internal/entity-internal-home";
import { TerminalInternalHome } from "@/components/internal/terminal-internal-home";
import { useSiteContext } from "@/hooks/use-site-context";
import { siteFromRouteContext } from "@/lib/site/site-context";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { readDevSiteFromLocation, siteSearchPatch } from "@/lib/site/preserve-dev-site-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { fetchTerminalOpsHomeSummary } from "@/lib/terminal/terminal-ops.functions";
import {
  formatHomeRelativeTime,
  homeAttentionTotal,
  rankHomeAttention,
  selectHomePlatformStatus,
  selectHomeRecentActivity,
  summarizeHealthyJobs,
  type HomeAttentionItem,
} from "@/lib/internal/home-attention";

export const Route = createFileRoute("/internal/")({
  beforeLoad: ({ context, location }) => {
    // The root route context is intentionally stable across query-only
    // navigation. Resolve the localhost site override from the current
    // location so `/internal?site=bank` cannot render the corporate home.
    const requestedSite = readDevSiteFromLocation(location);
    const currentSearch = requestedSite ? { site: requestedSite } : (typeof location.searchStr === "string" ? location.searchStr : location.search as Record<string, unknown>);
    const siteKey = resolveSiteContextFromRequest(
      currentSearch,
      location.pathname,
    ).key ?? siteFromRouteContext(context).key;
    if (siteKey === "bank") {
      throw redirect({
        to: "/internal/bank",
        search: normalizeInternalSearch(
          siteSearchPatch(requestedSite),
        ),
      });
    }
  },
  loader: ({ context, location }) => {
    const requestedSite = readDevSiteFromLocation(location);
    const currentSearch = requestedSite ? { site: requestedSite } : (typeof location.searchStr === "string" ? location.searchStr : location.search as Record<string, unknown>);
    const siteKey = resolveSiteContextFromRequest(
      currentSearch,
      location.pathname,
    ).key ?? siteFromRouteContext(context).key;
    if (siteKey === "terminal") {
      return fetchTerminalOpsHomeSummary().then((summary) => ({ kind: "terminal" as const, summary }));
    }
    if (siteKey === "exchange") {
      return { kind: "exchange" as const };
    }
    return fetchEnhancedDashboard().then((dashboard) => ({ kind: "corporate" as const, dashboard }));
  },
  head: ({ match, context }) => {
    const siteFromSearch = (match.search as { site?: string }).site;
    const site = siteFromRouteContext(context);
    if (site.key === "exchange" && !siteFromSearch) {
      return { meta: [{ title: `Internal — ${site.displayName}` }] };
    }
    return { meta: [{ title: internalDocumentTitle("Home", siteFromSearch ?? site.key) }] };
  },
  component: InternalOperationsCenter,
});

function InternalOperationsCenter() {
  const site = useSiteContext();
  const loaderData = Route.useLoaderData();

  if (loaderData?.kind === "terminal") {
    return <TerminalInternalHome summary={loaderData.summary} />;
  }

  if (site.key === "exchange" || loaderData?.kind === "exchange") {
    return <EntityInternalHome siteKey="exchange" />;
  }

  if (!loaderData || loaderData.kind !== "corporate") {
    return null;
  }

  const {
    metrics: m,
    health,
    activity,
    negativeBalances,
    largeAdjustments,
    maintenance,
  } = loaderData.dashboard;

  const attention = rankHomeAttention([
    {
      id: "deposits",
      label: "Pending deposits",
      count: m.pendingDeposits,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "money" as const, type: "deposit" as const }, site.key),
      urgency: 90,
      tone: "alert",
    },
    {
      id: "withdrawals",
      label: "Pending withdrawals",
      count: m.pendingWithdrawals,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "money" as const, type: "withdrawal" as const }, site.key),
      urgency: 95,
      tone: "alert",
    },
    {
      id: "lending",
      label: "Loan applications",
      count: m.pendingLoanApplications,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "lending" as const }, site.key),
      urgency: 70,
      tone: "warn",
    },
    {
      id: "companies",
      label: "Company verifications",
      count: m.pendingCompanyVerifications,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "companies" as const }, site.key),
      urgency: 60,
      tone: "warn",
    },
    {
      id: "openings",
      label: "Account openings",
      count: m.pendingAccountOpenings,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "account_opening" as const }, site.key),
      urgency: 65,
      tone: "warn",
    },
    {
      id: "failed-transfers",
      label: "Failed transfers",
      count: m.failedScheduledTransfers,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "risk" as const, type: "exception" as const }, site.key),
      urgency: 85,
      tone: "alert",
    },
    {
      id: "negative",
      label: "Negative balances",
      count: negativeBalances,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "risk" as const }, site.key),
      urgency: 100,
      tone: "alert",
    },
    {
      id: "frozen",
      label: "Frozen accounts",
      count: m.frozenAccounts,
      to: "/internal/bank/accounts",
      search: withInternalSiteSearch({ status: "frozen" }, site.key),
      urgency: 75,
      tone: "warn",
    },
    {
      id: "restricted",
      label: "Restricted people",
      count: m.restrictedUsers,
      to: "/internal/users",
      search: withInternalSiteSearch({ accountStatus: "restricted" }, site.key),
      urgency: 72,
      tone: "warn",
    },
    {
      id: "adjustments",
      label: "Large adjustments (30d)",
      count: largeAdjustments,
      to: "/internal/audit",
      search: withInternalSiteSearch({ action: "ADJUSTMENT" }, site.key),
      urgency: 40,
      tone: "warn",
    },
  ] satisfies HomeAttentionItem[]);

  const attentionTotal = homeAttentionTotal(attention);
  const platformStatus = selectHomePlatformStatus(health);
  const healthySummary = summarizeHealthyJobs(health);
  const recent = selectHomeRecentActivity(activity, 6);

  return (
    <InternalPageShell title="Home" breadcrumbs={buildBreadcrumbs([{ label: "Home" }])}>
      {maintenance.enabled ? (
        <div className="mb-6 rounded border-l-2 border-l-amber-400 border-y border-r border-amber-400/30 bg-amber-400/[0.06] px-5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-300" aria-hidden />
                Maintenance mode active
              </div>
              <p className="mt-1.5 text-[13px] text-foreground">
                {maintenance.activeScopes.length > 0
                  ? `Active: ${maintenance.activeScopes.join(", ")}`
                  : "Public platform pages are offline for normal users."}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {maintenance.startedAt
                  ? `Started ${formatActivityDateTime(maintenance.startedAt)}`
                  : "Start time unavailable"}
                {maintenance.updatedByUsername ? ` · Updated by ${maintenance.updatedByUsername}` : ""}
              </p>
            </div>
            <Link
              to="/internal/settings"
              search={withInternalSiteSearch({}, site.key)}
              className="rounded border border-amber-300/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-400/10"
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}

      <OpsSection title="Work requiring attention">
        {attention.length === 0 ? (
          <OpsEmptyState
            title="No open work"
            description="Queues are clear. New deposits, openings, lending, and risk cases will appear here."
          />
        ) : (
          <>
            <p className="mb-2 text-[12px] text-muted-foreground">
              {attentionTotal} item{attentionTotal === 1 ? "" : "s"} need attention
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {attention.map((item) => (
                <OpsQueueCard
                  key={item.id}
                  label={item.label}
                  count={item.count}
                  to={item.to}
                  search={item.search}
                  tone={item.tone}
                  cta="Open"
                />
              ))}
            </div>
          </>
        )}
      </OpsSection>

      <OpsSection
        title="Platform status"
        className="mt-6"
        action={
          <Link
            to="/internal/jobs"
            search={withInternalSiteSearch({}, site.key)}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
          >
            System Jobs
          </Link>
        }
      >
        <div className="grid gap-1.5 sm:grid-cols-2">
          {platformStatus.map((h) => (
            <div key={h.key} className="rounded border border-border bg-surface-1/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-foreground">{h.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em]",
                    h.status === "operational"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : h.status === "degraded"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      h.status === "operational"
                        ? "bg-emerald-500"
                        : h.status === "degraded"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/50",
                    )}
                    aria-hidden
                  />
                  {h.status === "operational" ? "Healthy" : h.status === "degraded" ? "Needs attention" : "Unknown"}
                </span>
              </div>
              <p className="mt-1 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                {h.detail}
              </p>
              {h.lastSuccessAt && h.status !== "operational" ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Last success {formatHomeRelativeTime(h.lastSuccessAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        {healthySummary ? (
          <p className="mt-2 text-[12px] text-muted-foreground">{healthySummary}</p>
        ) : null}
      </OpsSection>

      {recent.length > 0 ? (
        <OpsSection
          title="Recent operator activity"
          className="mt-6"
          action={
            <Link
              to="/internal/audit"
              search={withInternalSiteSearch({}, site.key)}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
            >
              View audit log
            </Link>
          }
        >
          <ul className="divide-y divide-border/60 overflow-hidden rounded border border-border/70 bg-surface-1/40">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  {a.href ? (
                    <Link
                      to={a.href}
                      search={withInternalSiteSearch(a.search ?? {}, site.key)}
                      className="text-[13px] font-medium text-foreground hover:text-gold"
                    >
                      {a.title}
                    </Link>
                  ) : (
                    <p className="text-[13px] font-medium text-foreground">{a.title}</p>
                  )}
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {[a.actorLabel, a.accountLabel].filter(Boolean).join(" · ") || a.detail}
                  </p>
                </div>
                <time
                  className="shrink-0 font-mono text-[10px] text-muted-foreground"
                  dateTime={a.createdAt}
                >
                  {formatHomeRelativeTime(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </OpsSection>
      ) : null}

      <nav aria-label="Quick navigation" className="mt-6 flex flex-wrap gap-2">
        <QuickLink to="/internal/inbox">Inbox</QuickLink>
        <QuickLink to="/internal/reports">Reports</QuickLink>
        <QuickLink to="/internal/jobs">System</QuickLink>
      </nav>
    </InternalPageShell>
  );
}

function QuickLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  const site = useSiteContext();
  return (
    <Link
      to={to}
      search={withInternalSiteSearch({}, site.key)}
      className="inline-flex items-center rounded border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-border-strong hover:text-foreground"
    >
      {children}
    </Link>
  );
}
