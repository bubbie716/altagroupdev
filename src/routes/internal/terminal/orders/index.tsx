import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { OpsFilterChip } from "@/components/internal/console/ops-filter-chip";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  INTERNAL_TERMINAL_ORDER_RECORD_SEARCH,
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { fetchTerminalOrders, fetchTerminalScheduledTrades } from "@/lib/terminal/terminal-ops.functions";
import {
  TERMINAL_ORDER_FILTER_LABELS,
  TERMINAL_ORDER_LIST_FILTERS,
  orderMatchesListFilter,
  parseTerminalOrderListFilter,
  plainOrderSideLabel,
  plainOrderStatusLabel,
  plainOrderTypeLabel,
  type TerminalOpsOrderRow,
  type TerminalOpsScheduledTradeRow,
  type TerminalOrderListFilter,
} from "@/lib/terminal/terminal-ops-types";
import {
  TERMINAL_LIST_PAGE_SIZE,
  orderFillProgressLabel,
  sortOrdersForDirectory,
} from "@/lib/terminal/terminal-desk";
import { formatTerminalMoney } from "@/lib/terminal/format";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";

export type TerminalOrdersSearch = {
  tab?: "orders" | "scheduled";
  status?: TerminalOrderListFilter;
  q?: string;
  side?: string;
  orderType?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/terminal/orders/")({
  validateSearch: (s: Record<string, unknown>): TerminalOrdersSearch => {
    const status = parseTerminalOrderListFilter(typeof s.status === "string" ? s.status : undefined);
    const side = s.side === "buy" || s.side === "sell" ? s.side : undefined;
    const orderType = s.orderType === "market" || s.orderType === "limit" ? s.orderType : undefined;
    return {
      tab: s.tab === "scheduled" ? "scheduled" : "orders",
      status: status === "all" ? undefined : status,
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      side,
      orderType,
      attention: s.attention === "1" ? "1" : undefined,
      site: validateDevSiteSearch(s).site,
    };
  },
  loaderDeps: ({ search }) => ({ tab: search.tab ?? "orders" }),
  loader: async ({ deps }) => {
    if (deps.tab === "scheduled") {
      const scheduled = await fetchTerminalScheduledTrades();
      return { tab: "scheduled" as const, orders: [] as TerminalOpsOrderRow[], scheduled };
    }
    const orders = await fetchTerminalOrders();
    return { tab: "orders" as const, orders, scheduled: [] as TerminalOpsScheduledTradeRow[] };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Orders", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: TerminalOrdersPage,
});

function TerminalOrdersPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab = search.tab ?? "orders";
  const env = resolveTerminalOpsEnvironmentStatus();
  const filter = search.status ?? "all";
  const attentionOnly = search.attention === "1";
  const q = search.q?.toLowerCase() ?? "";
  const filtersOn = Boolean(
    (filter && filter !== "all") || search.q || search.side || search.orderType || search.attention,
  );

  const filtered = data.orders.filter((row) => {
    if (!orderMatchesListFilter(row, filter)) return false;
    if (search.side && row.side !== search.side) return false;
    if (search.orderType && row.type !== search.orderType) return false;
    if (!q) return true;
    const hay = [
      row.symbol,
      row.name,
      row.portfolioName,
      row.investorLabel,
      row.status,
      row.id,
      row.rejectReason ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  const sorted = sortOrdersForDirectory(filtered, attentionOnly);

  const scheduledFiltered = data.scheduled.filter((row) => {
    if (attentionOnly && !row.needsAttention) return false;
    if (search.side && row.side !== search.side) return false;
    if (!q) return true;
    const hay = [
      row.symbol,
      row.portfolioName,
      row.investorLabel,
      row.status,
      row.id,
      row.lastFailureSummary ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const [visible, setVisible] = useState(TERMINAL_LIST_PAGE_SIZE);
  useEffect(() => {
    setVisible(TERMINAL_LIST_PAGE_SIZE);
  }, [filter, q, attentionOnly, search.side, search.orderType, tab]);
  const page = sorted.slice(0, visible);
  const scheduledPage = scheduledFiltered.slice(0, visible);

  const returnFrom = buildListReturnPath("/internal/terminal/orders", {
    tab: tab === "orders" ? undefined : tab,
    status: filter === "all" ? undefined : filter,
    q: search.q,
    side: search.side,
    orderType: search.orderType,
    attention: search.attention,
    site: search.site,
  });

  function patchSearch(patch: Partial<TerminalOrdersSearch>) {
    void navigate({
      to: "/internal/terminal/orders",
      search: withInternalSiteSearch(
        {
          tab: patch.tab ?? search.tab,
          status: patch.status === "all" ? undefined : (patch.status ?? search.status),
          q: patch.q !== undefined ? patch.q || undefined : search.q,
          side: patch.side !== undefined ? patch.side || undefined : search.side,
          orderType: patch.orderType !== undefined ? patch.orderType || undefined : search.orderType,
          attention: patch.attention !== undefined ? patch.attention : search.attention,
        },
        search.site,
      ),
      replace: true,
    });
  }

  function recordSearch() {
    return withInternalSiteSearch(
      { ...INTERNAL_TERMINAL_ORDER_RECORD_SEARCH, from: returnFrom },
      search.site,
    );
  }

  return (
    <InternalPageShell title="Orders">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        {tab === "scheduled"
          ? "Scheduled and recurring Terminal trade instructions."
          : "Terminal order ledger for operator review."}
      </p>

      {env.connectionState !== "live" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground"
        >
          <span className="font-medium text-foreground">{env.label}</span>
          <span className="mt-0.5 block">{env.detail}</span>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "orders" as const, label: "Orders" },
            { id: "scheduled" as const, label: "Scheduled" },
          ] as const
        ).map((item) => (
          <OpsFilterChip
            key={item.id}
            to="/internal/terminal/orders"
            search={withInternalSiteSearch(
              { tab: item.id === "orders" ? undefined : item.id, q: search.q, attention: search.attention },
              search.site,
            )}
            pressed={tab === item.id}
          >
            {item.label}
          </OpsFilterChip>
        ))}
      </div>

      {tab === "orders" ? (
        <>
      <div className="mb-4 flex flex-wrap gap-2">
        {TERMINAL_ORDER_LIST_FILTERS.map((id) => (
          <OpsFilterChip
            key={id}
            to="/internal/terminal/orders"
            search={withInternalSiteSearch(
              {
                status: id === "all" ? undefined : id,
                q: search.q,
                side: search.side,
                orderType: search.orderType,
                attention: search.attention,
              },
              search.site,
            )}
            pressed={filter === id}
          >
            {TERMINAL_ORDER_FILTER_LABELS[id]}
          </OpsFilterChip>
        ))}
      </div>

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/terminal/orders",
                  search: withInternalSiteSearch({}, search.site),
                  replace: true,
                })
            : undefined
        }
      >
        <OpsFilterField label="Search">
          <input
            className={OPS_FILTER_FIELD_CLASS}
            value={search.q ?? ""}
            onChange={(e) => patchSearch({ q: e.target.value || undefined })}
            placeholder="Symbol, investor, portfolio…"
            aria-label="Search orders"
          />
        </OpsFilterField>
        <OpsFilterField label="Side">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.side ?? ""}
            onChange={(e) => patchSearch({ side: e.target.value || undefined })}
            aria-label="Filter by side"
          >
            <option value="">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Order type">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.orderType ?? ""}
            onChange={(e) => patchSearch({ orderType: e.target.value || undefined })}
            aria-label="Filter by order type"
          >
            <option value="">All</option>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Needs attention">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.attention ?? ""}
            onChange={(e) => patchSearch({ attention: e.target.value === "1" ? "1" : undefined })}
            aria-label="Needs attention filter"
          >
            <option value="">Any</option>
            <option value="1">Needs attention</option>
          </select>
        </OpsFilterField>
      </OpsFilterBar>

      {sorted.length === 0 ? (
        <p className="mt-6 text-[13px] text-muted-foreground">
          {filtersOn ? "No orders match this filter." : "No orders yet."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 font-medium">Side / type</th>
                  <th className="py-2 pr-3 font-medium">Quantity</th>
                  <th className="py-2 pr-3 font-medium">Investor</th>
                  <th className="py-2 pr-3 font-medium">Portfolio</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => (
                  <tr key={`desktop-${row.id}`} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-3">
                      <Link
                        to="/internal/terminal/orders/$orderId"
                        params={{ orderId: row.id }}
                        search={recordSearch()}
                        className="font-mono font-medium hover:text-gold"
                      >
                        {row.symbol}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{row.name}</div>
                      {row.type === "limit" && row.limitPrice != null ? (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          Limit {formatTerminalMoney(row.limitPrice)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {plainOrderSideLabel(row.side)} · {plainOrderTypeLabel(row.type)}
                    </td>
                    <td className="py-3 pr-3 text-[12px] tabular-nums">
                      {orderFillProgressLabel(row)}
                    </td>
                    <td className="py-3 pr-3">{row.investorLabel}</td>
                    <td className="py-3 pr-3">{row.portfolioName}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={plainOrderStatusLabel(row.status)} />
                      {row.needsAttention ? (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          Needs action
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(row.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {page.map((row) => (
              <li key={`mobile-${row.id}`}>
                <Link
                  to="/internal/terminal/orders/$orderId"
                  params={{ orderId: row.id }}
                  search={recordSearch()}
                  className={cn(
                    "block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-gold/40",
                    row.needsAttention ? "border-amber-500/40" : undefined,
                  )}
                  aria-label={`Review order ${row.symbol}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-medium">{row.symbol}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {plainOrderSideLabel(row.side)} · {plainOrderTypeLabel(row.type)}
                      </div>
                    </div>
                    <StatusBadge status={plainOrderStatusLabel(row.status)} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                    <span className="tabular-nums">{orderFillProgressLabel(row)}</span>
                    <span className="text-muted-foreground">
                      {row.portfolioName} · {row.investorLabel}
                    </span>
                  </div>
                  <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                    Review order
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {sorted.length > visible ? (
            <div className="mt-4">
              <button
                type="button"
                className="h-8 rounded border border-border px-3 text-[12px] hover:border-border-strong"
                onClick={() => setVisible((n) => n + TERMINAL_LIST_PAGE_SIZE)}
              >
                Show more
              </button>
            </div>
          ) : null}
        </>
      )}
        </>
      ) : (
        <>
          <OpsFilterBar
            onClear={
              filtersOn
                ? () =>
                    void navigate({
                      to: "/internal/terminal/orders",
                      search: withInternalSiteSearch({ tab: "scheduled" }, search.site),
                      replace: true,
                    })
                : undefined
            }
          >
            <OpsFilterField label="Search">
              <input
                className={OPS_FILTER_FIELD_CLASS}
                value={search.q ?? ""}
                onChange={(e) => patchSearch({ q: e.target.value || undefined })}
                placeholder="Symbol, investor, portfolio, id"
                aria-label="Search scheduled trades"
              />
            </OpsFilterField>
            <OpsFilterField label="Attention">
              <select
                className={OPS_FILTER_FIELD_CLASS}
                value={search.attention ?? ""}
                onChange={(e) => patchSearch({ attention: e.target.value === "1" ? "1" : undefined })}
                aria-label="Needs attention filter"
              >
                <option value="">Any</option>
                <option value="1">Needs attention</option>
              </select>
            </OpsFilterField>
          </OpsFilterBar>

          {scheduledFiltered.length === 0 ? (
            <p className="mt-6 text-[13px] text-muted-foreground">
              {filtersOn ? "No scheduled trades match this filter." : "No scheduled trades yet."}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {scheduledPage.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-md border border-border/70 bg-surface-1/40 px-3 py-3",
                    row.needsAttention ? "border-amber-500/40" : undefined,
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-medium">
                        {row.side.toUpperCase()} {row.quantity} {row.symbol}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {row.scheduleType === "one_time"
                          ? "One-time"
                          : `Recurring · ${row.frequency ?? ""}`}{" "}
                        · {row.portfolioName} · {row.investorLabel}
                      </div>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    Next attempt:{" "}
                    {row.nextRunAt ? formatActivityDateTime(row.nextRunAt) : "—"}
                  </div>
                  {row.lastFailureSummary ? (
                    <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">
                      {row.lastFailureSummary}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                    <Link
                      to="/internal/terminal/portfolios/$portfolioId"
                      params={{ portfolioId: row.portfolioId }}
                      search={withInternalSiteSearch({}, search.site)}
                      className="text-gold hover:underline"
                    >
                      Portfolio
                    </Link>
                    <span className="font-mono text-muted-foreground">{row.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {scheduledFiltered.length > visible ? (
            <div className="mt-4">
              <button
                type="button"
                className="h-8 rounded border border-border px-3 text-[12px] hover:border-border-strong"
                onClick={() => setVisible((n) => n + TERMINAL_LIST_PAGE_SIZE)}
              >
                Show more
              </button>
            </div>
          ) : null}
        </>
      )}
    </InternalPageShell>
  );
}
