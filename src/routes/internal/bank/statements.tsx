import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { fetchInternalStatementOps } from "@/lib/bank/statement.functions";
import type { BankStatementSummary } from "@/lib/bank/statement-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { INTERNAL_ACCOUNT_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/statements")({
  loader: () => fetchInternalStatementOps(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Statements", (match.search as { site?: string }).site ?? "bank") }] }),
  component: InternalStatements,
});

function InternalStatements() {
  const statementOps = Route.useLoaderData();
  const site = useRouterState({
    select: (s) => readDevSiteFromSearch(s.location.search as Record<string, unknown>),
  });
  const job = statementOps.schedulerJob;
  const failures = job.summary?.failureCount ?? 0;
  const lastStatus = job.lastStatus;
  const needsAttention = failures > 0 || /fail/i.test(lastStatus);

  return (
    <InternalPageShell title="Statements">
      <p className="mb-6 max-w-2xl text-[13px] text-muted-foreground">
        Monthly statement generation and delivery status. Batch runs live on System Jobs — this page is for
        inspection and follow-up.
      </p>

      <section className="mb-8 rounded-md border border-border/60 px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Latest generation run
        </h2>
        <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Job</dt>
            <dd>{job.label}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={lastStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last success</dt>
            <dd>{job.lastSuccessAt ? formatActivityDateTime(job.lastSuccessAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last failure</dt>
            <dd>{job.lastFailureAt ? formatActivityDateTime(job.lastFailureAt) : "—"}</dd>
          </div>
          {job.summary?.periodStart ? (
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd>
                {job.summary.periodStart} → {job.summary.periodEnd ?? "—"}
              </dd>
            </div>
          ) : null}
          {job.summary ? (
            <div>
              <dt className="text-muted-foreground">Results</dt>
              <dd>
                Generated {job.summary.successCount ?? 0} · skipped {job.summary.skippedCount ?? 0} · failed{" "}
                {job.summary.failureCount ?? 0}
              </dd>
            </div>
          ) : null}
        </dl>
        {needsAttention ? (
          <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">
            Delivery or generation failures need review. Open affected accounts below or check{" "}
            <Link
              to="/internal/audit"
              search={withInternalSiteSearch({}, site)}
              className="text-gold hover:underline"
            >
              Audit
            </Link>
            .
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-muted-foreground">
          Manual batch generation:{" "}
          <Link
            to="/internal/jobs"
            search={withInternalSiteSearch({}, site)}
            className="text-gold hover:underline"
          >
            System Jobs
          </Link>
          . Voided statements (all time on record): {statementOps.voidedCount}.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Recent statements
        </h2>
        {statementOps.recentStatements.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No recent statements.</p>
        ) : (
          <>
            <ul className="hidden space-y-2 md:block">
              {statementOps.recentStatements.map((s: BankStatementSummary) => (
                <li
                  key={`desktop-${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[12px]">{s.statementNumber}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {s.ownerLabel} · {s.accountNumber} · Period ending {s.periodEnd.slice(0, 10)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.statusLabel} />
                    <Link
                      to="/internal/bank/accounts/$accountId"
                      params={{ accountId: s.bankAccountId }}
                      search={withInternalSiteSearch(
                        { ...INTERNAL_ACCOUNT_WORKSPACE_SEARCH, tab: "more", section: "statements" },
                        site,
                      )}
                      className="text-[12px] font-medium text-gold hover:underline"
                    >
                      Review account statements
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="space-y-2 md:hidden">
              {statementOps.recentStatements.map((s: BankStatementSummary) => (
                <li key={`mobile-${s.id}`}>
                  <Link
                    to="/internal/bank/accounts/$accountId"
                    params={{ accountId: s.bankAccountId }}
                    search={withInternalSiteSearch(
                      { ...INTERNAL_ACCOUNT_WORKSPACE_SEARCH, tab: "more", section: "statements" },
                      site,
                    )}
                    className="block rounded-md border border-border/60 px-3 py-2.5 hover:border-gold/40"
                    aria-label={`Review account statements for ${s.accountNumber}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] font-medium">{s.statementNumber}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {s.ownerLabel} · {s.accountNumber}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Period ending {s.periodEnd.slice(0, 10)}
                        </p>
                      </div>
                      <StatusBadge status={s.statusLabel} />
                    </div>
                    <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                      Review account statements
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </InternalPageShell>
  );
}
