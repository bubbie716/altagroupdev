import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { fetchInternalComplianceSnapshot } from "@/lib/internal/internal-dashboard.functions";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { useSiteContext } from "@/hooks/use-site-context";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { buildActiveRiskSignals } from "@/lib/internal/risk-signals";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type ComplianceSearch = { site?: string };

export const Route = createFileRoute("/internal/compliance")({
  validateSearch: (s: Record<string, unknown>): ComplianceSearch => ({
    site: readDevSiteFromSearch(s),
  }),
  loader: () => fetchInternalComplianceSnapshot(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Risk Signals", (match.search as { site?: string }).site) }] }),
  component: InternalRiskSignals,
});

function InternalRiskSignals() {
  const s = Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const site = useSiteContext();
  const siteKey = routeSearch.site ?? site.key;
  const signals = buildActiveRiskSignals(s, siteKey);

  return (
    <InternalPageShell
      title="Risk Signals"
      description="Active operational risk conditions. Investigations live on the related record and audit trail."
      breadcrumbs={buildBreadcrumbs([
        { label: "System", to: "/internal/jobs", search: withInternalSiteSearch({}, siteKey) },
        { label: "Risk" },
      ])}
    >
      <OpsSection title="Active signals">
        {signals.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-5 text-[13px] text-muted-foreground">
            No active risk signals
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((signal) => (
              <Link
                key={signal.id}
                to={signal.to}
                search={signal.search}
                className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4 transition-colors hover:border-gold/40"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {signal.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular">{signal.count}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{signal.hint}</div>
              </Link>
            ))}
          </div>
        )}
      </OpsSection>

      <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Investigations are managed through the relevant customer, company, account, or transaction
        record. The{" "}
        <Link
          to="/internal/audit"
          search={withInternalSiteSearch({}, siteKey)}
          className="text-gold hover:underline"
        >
          Audit Log
        </Link>{" "}
        contains the complete compliance trail.
      </p>
    </InternalPageShell>
  );
}
