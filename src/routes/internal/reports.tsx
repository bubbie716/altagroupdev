import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { downloadCsv } from "@/lib/internal/csv-export";
import { fetchOpsReports, exportOpsReportsCsvOps } from "@/lib/internal/ops-v1.functions";
import type { OpsReportPeriod } from "@/lib/internal/ops-report.types";
import { florin } from "@/lib/bank/api";

export type ReportsSearch = {
  period?: OpsReportPeriod;
  from?: string;
  to?: string;
};

export const Route = createFileRoute("/internal/reports")({
  validateSearch: (s: Record<string, unknown>): ReportsSearch => ({
    period:
      s.period === "7d" || s.period === "30d" || s.period === "custom" || s.period === "today"
        ? s.period
        : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
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
  head: () => ({ meta: [{ title: "Operational Reports — Alta Internal" }] }),
  component: ReportsPage,
});

const REPORT_LINKS: Record<string, { queue?: string; transactions?: string; audit?: string }> = {
  Deposits: {
    queue: "/internal/queues/deposits",
    transactions: "/internal/bank/transactions?type=DEPOSIT",
  },
  Withdrawals: {
    queue: "/internal/queues/withdrawals",
    transactions: "/internal/bank/transactions?type=WITHDRAWAL",
  },
  Transfers: { queue: "/internal/bank/transfers" },
  "Alta Pay": { queue: "/internal/bank/alta-pay" },
  "Loan applications": { queue: "/internal/queues/lending-applications" },
  "Loan originations": { queue: "/internal/queues/lending-applications" },
  "Manual adjustments": {
    audit: "/internal/audit?action=ADJUSTMENT",
    transactions: "/internal/bank/transactions?type=ADJUSTMENT",
  },
  "Exception actions": { queue: "/internal/queues/exceptions" },
};

function ReportsPage() {
  const bundle = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const exportFn = useServerFn(exportOpsReportsCsvOps);
  const period = search.period ?? "today";

  async function handleExport() {
    const csv = await exportFn({
      data: { period, from: search.from, to: search.to },
    });
    downloadCsv(`ops-reports-${period}.csv`, csv);
  }

  return (
    <InternalPageShell
      title="Operational Reports"
      description="Real operational totals by period with CSV export."
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
              search: {
                period: (fd.get("period") as OpsReportPeriod) || "today",
                from: (fd.get("from") as string) || undefined,
                to: (fd.get("to") as string) || undefined,
              },
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

      <OpsSection title={bundle.periodLabel} className="mt-8">
        <div className="mb-3 flex justify-end">
          <OpsCsvExportButton
            filename={`ops-reports-${period}.csv`}
            headers={["report", "count", "total_amount"]}
            getRows={() =>
              bundle.reports.map((r) => [r.label, r.count, r.totalAmount.toFixed(2)])
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bundle.reports.map((row) => {
            const links = REPORT_LINKS[row.label] ?? {};
            return (
              <div
                key={row.key}
                className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {row.label}
                </div>
                {row.totalAmount > 0 ? (
                  <div className="mt-2 text-2xl font-semibold tabular">{florin(row.totalAmount)}</div>
                ) : (
                  <div className="mt-2 text-2xl font-semibold tabular">{row.count.toLocaleString()}</div>
                )}
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {row.count} record{row.count === 1 ? "" : "s"}
                  {row.totalAmount > 0 ? ` · ${florin(row.totalAmount)} total` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {links.queue ? <ReportLink to={links.queue}>Queue</ReportLink> : null}
                  {links.transactions ? (
                    <ReportLink to={links.transactions}>Transactions</ReportLink>
                  ) : null}
                  {links.audit ? <ReportLink to={links.audit}>Audit</ReportLink> : null}
                </div>
              </div>
            );
          })}
        </div>
      </OpsSection>
    </InternalPageShell>
  );
}

function ReportLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] hover:border-gold/40 hover:text-gold"
    >
      {children}
    </Link>
  );
}
