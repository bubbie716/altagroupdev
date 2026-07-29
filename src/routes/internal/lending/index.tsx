import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { OpsSection } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { fetchInternalLendingOps } from "@/lib/bank/lending.functions";
import { florin } from "@/lib/bank/api";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  INTERNAL_LOAN_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import {
  buildLendingAttentionItems,
  formatLoanOutstanding,
  loanNeedsDirectoryAttention,
  nextLoanDueLabel,
  sortLoansForDirectory,
} from "@/lib/internal/lending-desk";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/lending/")({
  loader: () => fetchInternalLendingOps(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Lending", (match.search as { site?: string }).site) }] }),
  component: InternalLending,
});

function InternalLending() {
  const { applications, activeLoans, paidOffLoans, frozenLoans, defaultedLoans } =
    Route.useLoaderData();
  const site = useSiteContext();
  const attention = buildLendingAttentionItems({
    applications,
    frozenLoans,
    defaultedLoans: defaultedLoans ?? [],
    siteKey: site.key,
    withSite: withInternalSiteSearch,
  });
  const preview = sortLoansForDirectory([
    ...frozenLoans,
    ...(defaultedLoans ?? []),
    ...activeLoans,
  ]).slice(0, 4);
  const outstandingPrincipal = activeLoans.reduce((sum, l) => sum + l.principalOutstanding, 0);

  return (
    <InternalPageShell
      title="Lending"
      breadcrumbs={buildBreadcrumbs([
        { label: "Products", to: "/internal/lending", search: withInternalSiteSearch({}, site.key) },
        { label: "Lending" },
      ])}
    >
      <OpsSection title="Needs attention">
        {attention.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2.5 text-[13px] text-muted-foreground">
            No Lending work needs attention
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {attention.map((item) => (
              <OpsQueueCard
                key={item.id}
                label={item.label}
                count={item.count}
                to={item.to}
                search={item.search}
                cta={item.cta}
                tone={item.tone}
              />
            ))}
          </div>
        )}
      </OpsSection>

      <OpsSection title="Loans" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">Browse active, frozen, and paid-off loans.</p>
          <Link
            to="/internal/lending/loans"
            search={withInternalSiteSearch({}, site.key)}
            className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-medium text-gold"
          >
            Browse loans
          </Link>
        </div>
        {preview.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No loans to preview.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((loan) => (
              <li key={loan.id}>
                <Link
                  to="/internal/lending/loans/$loanId"
                  params={{ loanId: loan.id }}
                  search={withInternalSiteSearch(INTERNAL_LOAN_WORKSPACE_SEARCH, site.key)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-3 py-2 hover:border-gold/40"
                  aria-label={`Review loan ${loan.productLabel} for ${loan.borrowerLabel}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[13px]">{loan.productLabel}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {loan.borrowerLabel}
                      {loanNeedsDirectoryAttention(loan) ? ` · ${nextLoanDueLabel(loan)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-[13px]">{formatLoanOutstanding(loan)}</span>
                    <OpsStatusBadge status={loan.statusLabel} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <OpsSection title="Portfolio summary" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active" value={String(activeLoans.length)} />
          <Metric label="Frozen" value={String(frozenLoans.length)} />
          <Metric label="Paid off" value={String(paidOffLoans.length)} />
          <Metric label="Outstanding principal" value={florin(outstandingPrincipal)} />
        </div>
      </OpsSection>

      <p className="mt-6 text-[12px] text-muted-foreground">
        Servicing healthy ·{" "}
        <Link
          to="/internal/jobs"
          search={withInternalSiteSearch({}, site.key)}
          className="text-gold hover:underline"
        >
          System Jobs
        </Link>
      </p>
    </InternalPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/80 bg-surface-1/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
