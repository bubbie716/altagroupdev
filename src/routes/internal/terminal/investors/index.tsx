import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { fetchTerminalInvestors } from "@/lib/terminal/terminal-ops.functions";
import {
  TERMINAL_INVESTOR_FILTER_LABELS,
  TERMINAL_INVESTOR_LIST_FILTERS,
  investorMatchesListFilter,
  parseTerminalInvestorListFilter,
  type TerminalInvestorListFilter,
  type TerminalInvestorRow,
} from "@/lib/terminal/terminal-ops-types";
import {
  TERMINAL_LIST_PAGE_SIZE,
  investorPortfolioCountLabel,
  investorTypeLabel,
  sortInvestorsForDirectory,
} from "@/lib/terminal/terminal-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TerminalInvestorsSearch = {
  status?: TerminalInvestorListFilter;
  q?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/terminal/investors/")({
  validateSearch: (s: Record<string, unknown>): TerminalInvestorsSearch => {
    const status = parseTerminalInvestorListFilter(typeof s.status === "string" ? s.status : undefined);
    return {
      status: status === "all" ? undefined : status,
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      attention: s.attention === "1" ? "1" : undefined,
      site: validateDevSiteSearch(s).site,
    };
  },
  loader: (): Promise<TerminalInvestorRow[]> => fetchTerminalInvestors(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Investors", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: TerminalInvestorsPage,
});

function accessLabel(status: TerminalInvestorRow["accessStatus"]) {
  if (status === "active") return "Active";
  if (status === "restricted") return "Restricted";
  return "Unknown";
}

function TerminalInvestorsPage() {
  const investors = Route.useLoaderData() as TerminalInvestorRow[];
  const search = Route.useSearch();
  const navigate = useNavigate();
  const filter = search.status ?? "all";
  const attentionOnly = search.attention === "1";
  const q = search.q?.toLowerCase() ?? "";
  const filtersOn = Boolean((filter && filter !== "all") || search.q || search.attention);

  const filtered = investors.filter((row) => {
    if (!investorMatchesListFilter(row, filter)) return false;
    if (!q) return true;
    const hay = [row.label, row.kind, row.accessStatus, row.attentionDetail ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  const sorted = sortInvestorsForDirectory(filtered, attentionOnly);
  const [visible, setVisible] = useState(TERMINAL_LIST_PAGE_SIZE);
  useEffect(() => {
    setVisible(TERMINAL_LIST_PAGE_SIZE);
  }, [filter, q, attentionOnly]);
  const page = sorted.slice(0, visible);

  const returnFrom = buildListReturnPath("/internal/terminal/investors", {
    status: filter === "all" ? undefined : filter,
    q: search.q,
    attention: search.attention,
    site: search.site,
  });

  const ownerSearch = withInternalSiteSearch(
    {
      tab: "overview" as const,
      section: "terminal",
      from: returnFrom,
    },
    search.site,
  );

  function patchSearch(patch: Partial<TerminalInvestorsSearch>) {
    void navigate({
      to: "/internal/terminal/investors",
      search: withInternalSiteSearch(
        {
          status: patch.status === "all" ? undefined : (patch.status ?? search.status),
          q: patch.q !== undefined ? patch.q || undefined : search.q,
          attention: patch.attention !== undefined ? patch.attention : search.attention,
        },
        search.site,
      ),
      replace: true,
    });
  }

  function investorLink(row: TerminalInvestorRow, children: ReactNode, className?: string) {
    if (row.kind === "company" && row.ownerCompanyId) {
      return (
        <Link
          to="/internal/companies/$companyId"
          params={{ companyId: row.ownerCompanyId }}
          search={ownerSearch}
          className={className}
          aria-label={`Review investor ${row.label}`}
        >
          {children}
        </Link>
      );
    }
    if (row.ownerUserId) {
      return (
        <Link
          to="/internal/users/$userId"
          params={{ userId: row.ownerUserId }}
          search={ownerSearch}
          className={className}
          aria-label={`Review investor ${row.label}`}
        >
          {children}
        </Link>
      );
    }
    return <div className={className}>{children}</div>;
  }

  return (
    <InternalPageShell title="Investors">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Individuals and companies with Terminal portfolios.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TERMINAL_INVESTOR_LIST_FILTERS.map((id) => (
          <OpsFilterChip
            key={id}
            to="/internal/terminal/investors"
            search={withInternalSiteSearch(
              { status: id === "all" ? undefined : id, q: search.q, attention: search.attention },
              search.site,
            )}
            pressed={filter === id}
          >
            {TERMINAL_INVESTOR_FILTER_LABELS[id]}
          </OpsFilterChip>
        ))}
      </div>

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/terminal/investors",
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
            placeholder="Investor name…"
            aria-label="Search investors"
          />
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
          {filtersOn ? "No investors match this filter." : "No investors yet."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Investor</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Portfolios</th>
                  <th className="py-2 pr-3 font-medium">Access</th>
                  <th className="py-2 pr-3 font-medium">Last Terminal activity</th>
                  <th className="py-2 font-medium">Attention</th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => (
                  <tr key={`desktop-${row.id}`} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-3">
                      {investorLink(
                        row,
                        <span className="font-medium hover:text-gold">{row.label}</span>,
                      )}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{investorTypeLabel(row.kind)}</td>
                    <td className="py-3 pr-3 text-[12px]">{investorPortfolioCountLabel(row)}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={accessLabel(row.accessStatus)} />
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground">
                      {row.lastActivityAt ? formatActivityDateTime(row.lastActivityAt) : "—"}
                    </td>
                    <td className="py-3 text-[11px] text-amber-700 dark:text-amber-300">
                      {row.needsAttention ? row.attentionDetail ?? "Needs attention" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {page.map((row) => (
              <li key={`mobile-${row.id}`}>
                {investorLink(
                  row,
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.label}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {investorTypeLabel(row.kind)}
                        </div>
                      </div>
                      <StatusBadge status={accessLabel(row.accessStatus)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                      <span>{investorPortfolioCountLabel(row)}</span>
                      {row.lastActivityAt ? (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatActivityDateTime(row.lastActivityAt)}
                        </span>
                      ) : null}
                      {row.needsAttention ? (
                        <span className="text-amber-700 dark:text-amber-300">Needs attention</span>
                      ) : null}
                    </div>
                    <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                      Review investor
                    </span>
                  </>,
                  cn(
                    "block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-gold/40",
                    row.needsAttention ? "border-amber-500/40" : undefined,
                  ),
                )}
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
