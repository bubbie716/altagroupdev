import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { downloadCsv } from "@/lib/internal/csv-export";
import { fetchOpsReports, exportOpsReportsCsvOps } from "@/lib/internal/ops-v1.functions";
import { partitionReportRows } from "@/lib/internal/ops-reports-presentation";
import type { OpsReportPeriod, OpsReportRow } from "@/lib/internal/ops-report.types";
import { florin } from "@/lib/bank/api";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { useSiteContext } from "@/hooks/use-site-context";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type ReportsSearch = {
  period?: OpsReportPeriod;
  from?: string;
  to?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/reports")({
  validateSearch: (s: Record<string, unknown>): ReportsSearch => ({
    period:
      s.period === "7d" || s.period === "30d" || s.period === "custom" || s.period === "today"
        ? s.period
        : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    site: readDevSiteFromSearch(s),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchOpsReports({
      data: {
        period: deps.period ?? "today",
        from: deps.from,
        to: deps.to,
      },
    }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Operational Reports", (match.search as { site?: string }).site) }] }),
  component: ReportsPage,
});

type ReportLinkTarget = {
  to: string;
  search?: Record<string, unknown>;
  label: string;
};

/** Canonical destinations with descriptive CTAs — never generic "Queue". */
const REPORT_LINKS: Record<string, ReportLinkTarget[]> = {
  Deposits: [
    {
      label: "Review deposits",
      to: "/internal/inbox",
      search: { category: "money" as const, type: "deposit" as const },
    },
    {
      label: "View deposit transactions",
      to: "/internal/bank/transactions",
      search: { type: "DEPOSIT" },
    },
  ],
  Withdrawals: [
    {
      label: "Review withdrawals",
      to: "/internal/inbox",
      search: { category: "money" as const, type: "withdrawal" as const },
    },
    {
      label: "View withdrawal transactions",
      to: "/internal/bank/transactions",
      search: { type: "WITHDRAWAL" },
    },
  ],
  Transfers: [{ label: "View transfers", to: "/internal/bank/transfers", search: {} }],
  "Alta Pay": [{ label: "View Alta Pay activity", to: "/internal/bank/alta-pay", search: {} }],
  "Loan applications": [
    {
      label: "Review lending applications",
      to: "/internal/inbox",
      search: { category: "lending" as const, type: "lending_application" as const },
    },
  ],
  "Loan originations": [
    {
      label: "Review lending applications",
      to: "/internal/inbox",
      search: { category: "lending" as const, type: "lending_application" as const },
    },
  ],
  "Manual adjustments": [
    { label: "View adjustments in audit", to: "/internal/audit", search: { action: "ADJUSTMENT" } },
    {
      label: "View adjustment transactions",
      to: "/internal/bank/transactions",
      search: { type: "ADJUSTMENT" },
    },
  ],
  "Exception actions": [
    {
      label: "Review exceptions",
      to: "/internal/inbox",
      search: { category: "risk" as const, type: "exception" as const },
    },
  ],
};

function ReportsPage() {
  const bundle = Route.useLoaderData();
  const search = Route.useSearch();
  const site = useSiteContext();
  const siteKey = search.site ?? site.key;
  const navigate = useNavigate();
  const exportFn = useServerFn(exportOpsReportsCsvOps);
  const period = search.period ?? "today";
  const { active, zero } = partitionReportRows(bundle.reports);
  const [showZero, setShowZero] = useState(false);

  async function handleExport() {
    const csv = await exportFn({
      data: { period, from: search.from, to: search.to },
    });
    downloadCsv(`ops-reports-${period}.csv`, csv);
  }

  return (
    <InternalPageShell
      title="Operational Reports"
      description="Activity totals by period — nonzero categories first."
      breadcrumbs={buildBreadcrumbs([
        { label: "System", to: "/internal/jobs", search: withInternalSiteSearch({}, siteKey) },
        { label: "Reports" },
      ])}
      actions={
        <button
          type="button"
          onClick={() => void handleExport()}
          className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
        >
          Export CSV
        </button>
      }
    >
      <OpsSection title="Period">
        <form
          className="flex flex-wrap items-end gap-3 rounded border border-border/60 bg-surface-1/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void navigate({
              to: "/internal/reports",
              search: withInternalSiteSearch(
                {
                  period: (fd.get("period") as OpsReportPeriod) || "today",
                  from: (fd.get("from") as string) || undefined,
                  to: (fd.get("to") as string) || undefined,
                },
                siteKey,
              ),
            });
          }}
        >
          <label className="grid gap-1 text-[11px]">
            <span className="font-mono uppercase tracking-[0.12em] text-muted-foreground">Range</span>
            <select
              name="period"
              defaultValue={period}
              className="rounded border border-border bg-background px-2 py-1.5 text-[13px]"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="grid gap-1 text-[11px]">
                <span className="font-mono uppercase tracking-[0.12em] text-muted-foreground">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={search.from?.slice(0, 10)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-[13px]"
                />
              </label>
              <label className="grid gap-1 text-[11px]">
                <span className="font-mono uppercase tracking-[0.12em] text-muted-foreground">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={search.to?.slice(0, 10)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-[13px]"
                />
              </label>
            </>
          ) : null}
          <button
            type="submit"
            className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            Apply
          </button>
        </form>
        <p className="mt-2 text-[12px] text-muted-foreground">{bundle.periodLabel}</p>
      </OpsSection>

      <OpsSection title="Activity" className="mt-8">
        {active.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-3 text-[13px] text-muted-foreground">
            No activity in this period
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((row) => (
              <ReportCard key={row.key} row={row} siteKey={siteKey} />
            ))}
          </div>
        )}

        {zero.length > 0 ? (
          <div className="mt-6">
            <button
              type="button"
              className="text-[12px] text-muted-foreground hover:text-foreground"
              aria-expanded={showZero}
              onClick={() => setShowZero((v) => !v)}
            >
              {showZero ? "Hide" : "Show"} no activity ({zero.length})
            </button>
            {showZero ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {zero.map((row) => (
                  <ReportCard key={row.key} row={row} siteKey={siteKey} muted />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </OpsSection>
    </InternalPageShell>
  );
}

function ReportCard({
  row,
  siteKey,
  muted,
}: {
  row: OpsReportRow;
  siteKey: string;
  muted?: boolean;
}) {
  const links = REPORT_LINKS[row.label] ?? [];
  const primary = links[0];
  const showAmount = row.totalAmount > 0;

  return (
    <div
      className={
        muted
          ? "rounded-lg border border-border/40 bg-surface-1/30 px-4 py-4 opacity-80"
          : "rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4"
      }
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {row.label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">
        {showAmount ? florin(row.totalAmount) : row.count.toLocaleString()}
      </div>
      {showAmount ? (
        <div className="mt-1 text-[12px] text-muted-foreground">
          {row.count.toLocaleString()} {row.count === 1 ? "record" : "records"}
        </div>
      ) : row.count === 0 ? (
        <div className="mt-1 text-[12px] text-muted-foreground">No records</div>
      ) : null}
      {primary ? (
        <div className="mt-3">
          <Link
            to={primary.to}
            search={withInternalSiteSearch(primary.search ?? {}, siteKey)}
            className="rounded border border-border px-2.5 py-1 text-[12px] hover:border-gold/40 hover:text-gold"
          >
            {primary.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
