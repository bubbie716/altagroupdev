"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_TERMINAL_ORDER_RECORD_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordWorkspacePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
  type RecordWorkspaceTab,
} from "@/components/internal/workspace/record-workspace-layout";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { formatTerminalMoney, formatTerminalPercent } from "@/lib/terminal/format";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  TERMINAL_PORTFOLIO_ACTIVITY_FILTERS,
  activityMatchesTerminalFilter,
  plainActivityKindTitle,
  plainOrderSideLabel,
  plainOrderStatusLabel,
  type TerminalOpsPortfolioDetail,
  type TerminalPortfolioActivityFilter,
} from "@/lib/terminal/terminal-ops-types";
import { orderFillProgressLabel } from "@/lib/terminal/terminal-desk";
import { cn } from "@/lib/utils";

const TERMINAL_ACTIVITY_FILTER_LABELS: Record<TerminalPortfolioActivityFilter, string> = {
  all: "All",
  cash: "Cash",
  orders: "Orders",
  dividends: "Dividends",
  fees: "Fees",
  adjustments: "Adjustments",
  operator: "Operator",
};

function parseTerminalActivityFilter(
  raw: string | undefined,
): TerminalPortfolioActivityFilter {
  if (raw && (TERMINAL_PORTFOLIO_ACTIVITY_FILTERS as readonly string[]).includes(raw)) {
    return raw as TerminalPortfolioActivityFilter;
  }
  return "all";
}

export function TerminalPortfolioWorkspaceView({
  portfolio,
  search,
}: {
  portfolio: TerminalOpsPortfolioDetail;
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const trustworthy = portfolio.dataTrustworthy;
  const demonstration = resolveTerminalOpsEnvironmentStatus().isDemonstration;
  const activityFilter = parseTerminalActivityFilter(search.filter);
  const filteredActivity = portfolio.activity.filter((a) =>
    activityMatchesTerminalFilter(a.kind, activityFilter),
  );

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/terminal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Terminal Inbox", to: "/internal/terminal/inbox", search: returnCtx.search },
          { label: portfolio.name },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Portfolios", to: "/internal/terminal/portfolios" },
          { label: portfolio.name },
        ]);

  function setActivityFilter(filter: TerminalPortfolioActivityFilter) {
    void navigate({
      to: ".",
      search: () =>
        toRecordWorkspaceSearchParams({
          tab: "activity",
          filter: filter === "all" ? undefined : filter,
          from: search.from,
          site: search.site,
        }),
    });
  }

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {portfolio.needsAttention ? (
          <RecordAttentionBanner
            items={[
              {
                id: "portfolio-attention",
                label: "Needs attention",
                detail: portfolio.attentionDetail ?? "This portfolio needs review.",
              },
            ]}
          />
        ) : null}

        <RecordSummaryCard title="Ownership and access" id={recordSectionId("owner")}>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Owner">{portfolio.ownerLabel}</WorkspaceField>
            <WorkspaceField label="Type">
              {portfolio.ownerType === "company" ? "Company" : "Personal"}
              {portfolio.isDefault ? " · Default" : ""}
            </WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={portfolio.status === "active" ? "Active" : "Archived"} />
            </WorkspaceField>
            <WorkspaceField label="Open orders">
              <span className="tabular-nums">{portfolio.openOrderCount}</span>
            </WorkspaceField>
            {portfolio.ownerUserId ? (
              <WorkspaceField label="Investor">
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: portfolio.ownerUserId }}
                  search={withInternalSiteSearch(
                    { ...INTERNAL_USER_WORKSPACE_SEARCH, section: "terminal", from: search.from },
                    search.site,
                  )}
                  className="break-words hover:text-gold"
                >
                  Review investor
                </Link>
              </WorkspaceField>
            ) : null}
            {portfolio.ownerCompanyId ? (
              <WorkspaceField label="Company">
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: portfolio.ownerCompanyId }}
                  search={withInternalSiteSearch(
                    { ...INTERNAL_COMPANY_WORKSPACE_SEARCH, section: "terminal", from: search.from },
                    search.site,
                  )}
                  className="break-words hover:text-gold"
                >
                  Review company
                </Link>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        {trustworthy ? (
          <RecordSummaryCard title="Financial summary" id={recordSectionId("summary")}>
            <WorkspaceFieldGrid columns={3}>
              <WorkspaceField label="Total value">
                <span className="tabular-nums">
                  {portfolio.totalValue != null ? formatTerminalMoney(portfolio.totalValue) : "—"}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Cash">
                <span className="tabular-nums">
                  {portfolio.cashBalance != null ? formatTerminalMoney(portfolio.cashBalance) : "—"}
                </span>
              </WorkspaceField>
              <WorkspaceField label="Buying power">
                <span className="tabular-nums">
                  {portfolio.buyingPower != null ? formatTerminalMoney(portfolio.buyingPower) : "—"}
                </span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </RecordSummaryCard>
        ) : (
          <p className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2.5 text-[12px] text-muted-foreground">
            Market and cash figures are unavailable — TSE data is not trustworthy in this
            environment. Missing values are not zeros.
          </p>
        )}

        <RecordSummaryCard title="Holdings" id={recordSectionId("holdings")}>
          {!trustworthy && portfolio.holdings.length === 0 ? (
            <RecordEmptyCopy>
              {demonstration
                ? "No holdings in this portfolio."
                : "Holdings are unavailable while market data is not trustworthy."}
            </RecordEmptyCopy>
          ) : portfolio.holdings.length === 0 ? (
            <RecordEmptyCopy>No holdings in this portfolio.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-2">
              {portfolio.holdings.map((h) => (
                <li
                  key={h.symbol}
                  className="flex flex-wrap items-start justify-between gap-2 rounded border border-border/60 bg-surface-1/40 px-3 py-2"
                >
                  <div>
                    <div className="font-mono text-[13px] font-medium">{h.symbol}</div>
                    <div className="text-[12px] text-muted-foreground">{h.name}</div>
                  </div>
                  <div className="text-right text-[12px]">
                    {trustworthy ? (
                      <>
                        <div className="tabular-nums">{formatTerminalMoney(h.marketValue)}</div>
                        <div className="text-muted-foreground">
                          {h.quantity} sh · {formatTerminalPercent(h.totalReturnPercent)}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground">{h.quantity} sh</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Orders" id={recordSectionId("orders")}>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Open
              </div>
              {portfolio.openOrders.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No open orders.</p>
              ) : (
                <ul className="space-y-1.5">
                  {portfolio.openOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        to="/internal/terminal/orders/$orderId"
                        params={{ orderId: o.id }}
                        search={withInternalSiteSearch({ ...INTERNAL_TERMINAL_ORDER_RECORD_SEARCH, from: search.from }, search.site)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 px-2.5 py-1.5 text-[12px] hover:border-border-strong"
                      >
                        <span>
                          <span className="font-mono font-medium">{o.symbol}</span>{" "}
                          <span className="text-muted-foreground">
                            {plainOrderSideLabel(o.side)} · {orderFillProgressLabel(o)}
                          </span>
                        </span>
                        <StatusBadge status={plainOrderStatusLabel(o.status)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Recent
              </div>
              {portfolio.recentOrders.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No recent orders.</p>
              ) : (
                <ul className="space-y-1.5">
                  {portfolio.recentOrders.slice(0, 8).map((o) => (
                    <li key={o.id}>
                      <Link
                        to="/internal/terminal/orders/$orderId"
                        params={{ orderId: o.id }}
                        search={withInternalSiteSearch({ ...INTERNAL_TERMINAL_ORDER_RECORD_SEARCH, from: search.from }, search.site)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 px-2.5 py-1.5 text-[12px] hover:border-border-strong"
                      >
                        <span>
                          <span className="font-mono font-medium">{o.symbol}</span>{" "}
                          <span className="text-muted-foreground">
                            {plainOrderSideLabel(o.side)} · {plainOrderStatusLabel(o.status)}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatActivityDateTime(o.submittedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related" id={recordSectionId("related")}>
          <div className="flex flex-col gap-1.5 text-[12px]">
            {portfolio.ownerUserId ? (
              <Link
                to="/internal/users/$userId"
                params={{ userId: portfolio.ownerUserId }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_USER_WORKSPACE_SEARCH, section: "terminal" },
                  search.site,
                )}
                className="text-gold hover:underline"
              >
                Customer · {portfolio.ownerLabel}
              </Link>
            ) : null}
            {portfolio.ownerCompanyId ? (
              <Link
                to="/internal/companies/$companyId"
                params={{ companyId: portfolio.ownerCompanyId }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_COMPANY_WORKSPACE_SEARCH, section: "terminal" },
                  search.site,
                )}
                className="text-gold hover:underline"
              >
                Company · {portfolio.ownerLabel}
              </Link>
            ) : null}
            <Link
              to="/internal/terminal/orders"
              search={withInternalSiteSearch({}, search.site)}
              className="text-gold hover:underline"
            >
              Inspect orders
            </Link>
          </div>
        </RecordSummaryCard>
      </div>
    ),
  };

  const activity: RecordWorkspaceTab = {
    id: "activity",
    label: "Activity",
    content: (
      <div className="space-y-3" data-record-activity>
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Activity filters">
          {TERMINAL_PORTFOLIO_ACTIVITY_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivityFilter(id)}
              className={cn(
                "rounded border px-2.5 py-1 text-[12px] transition-colors",
                activityFilter === id
                  ? "border-gold/40 bg-gold/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
              aria-pressed={activityFilter === id}
            >
              {TERMINAL_ACTIVITY_FILTER_LABELS[id]}
            </button>
          ))}
        </div>

        {filteredActivity.length === 0 ? (
          <RecordEmptyCopy>
            {portfolio.activity.length === 0
              ? "No activity recorded yet."
              : "No events match this filter."}
          </RecordEmptyCopy>
        ) : (
          <ol className="space-y-2.5">
            {filteredActivity.map((a) => (
              <li
                key={a.id}
                className="rounded border border-border/60 bg-surface-1/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{a.title}</div>
                    {a.detail ? (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{a.detail}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded bg-surface-2/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {plainActivityKindTitle(a.kind)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{formatActivityDateTime(a.occurredAt)}</span>
                  {a.amount != null && trustworthy ? (
                    <span className="tabular-nums">{formatTerminalMoney(a.amount, { signed: true })}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("ownership")}
          title="Ownership"
          defaultOpen={search.section === "ownership"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Type">
              {portfolio.ownerType === "company" ? "Company" : "Personal"}
            </WorkspaceField>
            <WorkspaceField label="Owner">{portfolio.ownerLabel}</WorkspaceField>
            {portfolio.ownerUserId ? (
              <WorkspaceField label="User ID">
                <span className="font-mono text-[11px]">{portfolio.ownerUserId}</span>
              </WorkspaceField>
            ) : null}
            {portfolio.ownerCompanyId ? (
              <WorkspaceField label="Company ID">
                <span className="font-mono text-[11px]">{portfolio.ownerCompanyId}</span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("status")}
          title="Status"
          defaultOpen={search.section === "status"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Portfolio status">
              <StatusBadge status={portfolio.status === "active" ? "Active" : "Archived"} />
            </WorkspaceField>
            <WorkspaceField label="Default">{portfolio.isDefault ? "Yes" : "No"}</WorkspaceField>
            <WorkspaceField label="Created">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(portfolio.createdAt)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Updated">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(portfolio.updatedAt)}
              </span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("technical")}
          title="Technical IDs"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Portfolio ID">
              <span className="break-all font-mono text-[11px]">{portfolio.id}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("data-source")}
          title="Data source"
          defaultOpen={search.section === "data-source"}
        >
          <p className="text-[12px] text-muted-foreground">
            {trustworthy
              ? "Figures shown are from the current Terminal data source for this environment."
              : "Cash, buying power, and market values are unavailable because market data is not trustworthy in this environment. Do not treat missing values as zero."}
          </p>
        </RecordMoreSection>
      </div>
    ),
  };

  return (
    <RecordWorkspacePage
      title={portfolio.name}
      breadcrumbs={breadcrumbs}
      recordType="Terminal portfolio"
      primaryId={<span className="font-mono">{portfolio.id}</span>}
      status={portfolio.status === "active" ? "Active" : "Archived"}
      warning={
        portfolio.needsAttention ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs attention</span>
        ) : !trustworthy ? (
          <span className="text-[12px] text-muted-foreground">Values unavailable</span>
        ) : null
      }
      meta={
        <>
          <span>{portfolio.ownerLabel}</span>
          {portfolio.lastActivityAt ? (
            <span className="font-mono">{formatActivityDateTime(portfolio.lastActivityAt)}</span>
          ) : null}
        </>
      }
      tabs={[overview, activity, more]}
      search={search}
    />
  );
}
