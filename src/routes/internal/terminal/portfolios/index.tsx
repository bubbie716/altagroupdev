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
  INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH,
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { formatTerminalMoney } from "@/lib/terminal/format";
import { fetchTerminalPortfolios } from "@/lib/terminal/terminal-ops.functions";
import {
  TERMINAL_PORTFOLIO_FILTER_LABELS,
  TERMINAL_PORTFOLIO_LIST_FILTERS,
  parseTerminalPortfolioListFilter,
  portfolioMatchesListFilter,
  type TerminalOpsPortfolioRow,
  type TerminalPortfolioListFilter,
} from "@/lib/terminal/terminal-ops-types";
import {
  TERMINAL_LIST_PAGE_SIZE,
  portfolioOwnerTypeLabel,
  sortPortfoliosForDirectory,
} from "@/lib/terminal/terminal-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TerminalPortfoliosSearch = {
  status?: TerminalPortfolioListFilter;
  q?: string;
  ownerType?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/terminal/portfolios/")({
  validateSearch: (s: Record<string, unknown>): TerminalPortfoliosSearch => {
    const status = parseTerminalPortfolioListFilter(typeof s.status === "string" ? s.status : undefined);
    const ownerType =
      s.ownerType === "personal" || s.ownerType === "company" ? s.ownerType : undefined;
    return {
      status: status === "all" ? undefined : status,
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      ownerType,
      attention: s.attention === "1" ? "1" : undefined,
      site: validateDevSiteSearch(s).site,
    };
  },
  loader: (): Promise<TerminalOpsPortfolioRow[]> => fetchTerminalPortfolios(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Portfolios", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: TerminalPortfoliosPage,
});

function TerminalPortfoliosPage() {
  const portfolios = Route.useLoaderData() as TerminalOpsPortfolioRow[];
  const search = Route.useSearch();
  const navigate = useNavigate();
  const filter = search.status ?? "all";
  const attentionOnly = search.attention === "1";
  const q = search.q?.toLowerCase() ?? "";
  const filtersOn = Boolean(
    (filter && filter !== "all") || search.q || search.ownerType || search.attention,
  );
  const anyTrustworthy = portfolios.some((p) => p.dataTrustworthy);

  const filtered = portfolios.filter((row) => {
    if (!portfolioMatchesListFilter(row, filter)) return false;
    if (search.ownerType && row.ownerType !== search.ownerType) return false;
    if (!q) return true;
    const hay = [row.name, row.ownerLabel, row.ownerType, row.status, row.id].join(" ").toLowerCase();
    return hay.includes(q);
  });
  const sorted = sortPortfoliosForDirectory(filtered, attentionOnly);
  const [visible, setVisible] = useState(TERMINAL_LIST_PAGE_SIZE);
  useEffect(() => {
    setVisible(TERMINAL_LIST_PAGE_SIZE);
  }, [filter, q, attentionOnly, search.ownerType]);
  const page = sorted.slice(0, visible);

  const returnFrom = buildListReturnPath("/internal/terminal/portfolios", {
    status: filter === "all" ? undefined : filter,
    q: search.q,
    ownerType: search.ownerType,
    attention: search.attention,
    site: search.site,
  });

  function patchSearch(patch: Partial<TerminalPortfoliosSearch>) {
    void navigate({
      to: "/internal/terminal/portfolios",
      search: withInternalSiteSearch(
        {
          status: patch.status === "all" ? undefined : (patch.status ?? search.status),
          q: patch.q !== undefined ? patch.q || undefined : search.q,
          ownerType: patch.ownerType !== undefined ? patch.ownerType || undefined : search.ownerType,
          attention: patch.attention !== undefined ? patch.attention : search.attention,
        },
        search.site,
      ),
      replace: true,
    });
  }

  function recordSearch() {
    return withInternalSiteSearch(
      { ...INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH, from: returnFrom },
      search.site,
    );
  }

  return (
    <InternalPageShell title="Portfolios">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Terminal portfolios for operator review.
      </p>

      {!anyTrustworthy ? (
        <p className="mb-4 rounded-md border border-border/70 bg-surface-1/40 px-3 py-2 text-[12px] text-muted-foreground">
          Financial values (market value and cash) are unavailable in this environment and are omitted
          from the list.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {TERMINAL_PORTFOLIO_LIST_FILTERS.map((id) => (
          <OpsFilterChip
            key={id}
            to="/internal/terminal/portfolios"
            search={withInternalSiteSearch(
              {
                status: id === "all" ? undefined : id,
                q: search.q,
                ownerType: search.ownerType,
                attention: search.attention,
              },
              search.site,
            )}
            pressed={filter === id}
          >
            {TERMINAL_PORTFOLIO_FILTER_LABELS[id]}
          </OpsFilterChip>
        ))}
      </div>

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/terminal/portfolios",
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
            placeholder="Portfolio, owner, company…"
            aria-label="Search portfolios"
          />
        </OpsFilterField>
        <OpsFilterField label="Owner type">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.ownerType ?? ""}
            onChange={(e) => patchSearch({ ownerType: e.target.value || undefined })}
            aria-label="Filter by owner type"
          >
            <option value="">All</option>
            <option value="personal">Personal</option>
            <option value="company">Company</option>
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
          {filtersOn ? "No portfolios match this filter." : "No portfolios yet."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Portfolio</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  {anyTrustworthy ? (
                    <>
                      <th className="py-2 pr-3 font-medium">Value</th>
                      <th className="py-2 pr-3 font-medium">Cash</th>
                    </>
                  ) : (
                    <th className="py-2 pr-3 font-medium">Type</th>
                  )}
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => (
                  <tr
                    key={`desktop-${row.id}`}
                    className={cn(
                      "border-b border-border/60 align-top",
                      row.status === "archived" ? "opacity-70" : undefined,
                    )}
                  >
                    <td className="py-3 pr-3">
                      <Link
                        to="/internal/terminal/portfolios/$portfolioId"
                        params={{ portfolioId: row.id }}
                        search={recordSearch()}
                        className="font-medium hover:text-gold"
                      >
                        {row.name}
                      </Link>
                      {row.isDefault ? (
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Default
                        </div>
                      ) : null}
                      {row.needsAttention ? (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          {row.attentionDetail ?? "Needs attention"}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <div>{row.ownerLabel}</div>
                      {anyTrustworthy ? (
                        <div className="text-[11px] text-muted-foreground">
                          {portfolioOwnerTypeLabel(row.ownerType)}
                        </div>
                      ) : null}
                    </td>
                    {anyTrustworthy ? (
                      <>
                        <td className="py-3 pr-3 tabular-nums">
                          {row.dataTrustworthy && row.totalValue != null
                            ? formatTerminalMoney(row.totalValue)
                            : "—"}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {row.dataTrustworthy && row.cashBalance != null
                            ? formatTerminalMoney(row.cashBalance)
                            : "—"}
                        </td>
                      </>
                    ) : (
                      <td className="py-3 pr-3 text-muted-foreground">
                        {portfolioOwnerTypeLabel(row.ownerType)}
                      </td>
                    )}
                    <td className="py-3 pr-3">
                      <StatusBadge status={row.status === "active" ? "Active" : "Archived"} />
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(row.updatedAt)}
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
                  to="/internal/terminal/portfolios/$portfolioId"
                  params={{ portfolioId: row.id }}
                  search={recordSearch()}
                  className={cn(
                    "block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-gold/40",
                    row.status === "archived" ? "opacity-70" : undefined,
                    row.needsAttention ? "border-amber-500/40" : undefined,
                  )}
                  aria-label={`Review portfolio ${row.name}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{row.ownerLabel}</div>
                    </div>
                    <StatusBadge status={row.status === "active" ? "Active" : "Archived"} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                    <span className="text-muted-foreground">
                      {portfolioOwnerTypeLabel(row.ownerType)}
                      {row.isDefault ? " · Default" : ""}
                    </span>
                    {anyTrustworthy && row.dataTrustworthy && row.totalValue != null ? (
                      <span className="tabular-nums">{formatTerminalMoney(row.totalValue)}</span>
                    ) : null}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(row.updatedAt)}
                    </span>
                  </div>
                  <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                    Review portfolio
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
    </InternalPageShell>
  );
}
