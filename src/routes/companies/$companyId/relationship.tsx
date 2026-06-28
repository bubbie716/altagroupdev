import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { CompanySubNav } from "@/components/companies/company-sub-nav";
import {
  ProductTags,
  RelationshipAssetValue,
  RelationshipProgressBar,
  RelationshipTierPill,
  RelationshipTimelineList,
  RELATIONSHIP_METRIC_LABEL,
  RELATIONSHIP_METRIC_VALUE,
  RELATIONSHIP_SECTION_GAP,
} from "@/components/bank/customer-relationship-shared";
import { florin } from "@/lib/bank/api";
import {
  companyProductLabels,
  formatCompanyRelationshipDuration,
} from "@/lib/bank/customer-relationship-display";
import { fetchCustomerCompanyRelationshipView } from "@/lib/company/company-relationship-intelligence.functions";
import { formatDueDate } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { Route as CompanyRoute } from "@/routes/companies/$companyId/route";

export const Route = createFileRoute("/companies/$companyId/relationship")({
  loader: async ({ params }) => fetchCustomerCompanyRelationshipView({ data: params.companyId }),
  head: ({ matches }) => {
    const companyMatch = matches.find((m) => (m.routeId as string) === "/companies/$companyId");
    const company = companyMatch?.loaderData as { name?: string } | undefined;
    return {
      meta: [{ title: `${company?.name ?? "Company"} — Relationship Profile` }],
    };
  },
  component: CompanyRelationshipPage,
});

function CompanyRelationshipPage() {
  const company = CompanyRoute.useLoaderData();
  const view = Route.useLoaderData();
  const productLabels = companyProductLabels(view.productHoldings);
  const relationshipDuration = formatCompanyRelationshipDuration(view.relationshipSince);

  return (
    <PageShell
      eyebrow="Company workspace"
      title="Company relationship profile"
      description={`Business-only relationship view for ${view.companyName}. Separate from personal Relationship Intelligence.`}
    >
      <CompanySubNav companyId={company.id} />

      <Section title="Relationship overview">
        <Card className="!p-5 sm:!p-6 hover:!border-border">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className={RELATIONSHIP_METRIC_LABEL}>Relationship tier</dt>
              <dd className="mt-2">
                <RelationshipTierPill label={view.relationshipTierLabel} />
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className={RELATIONSHIP_METRIC_LABEL}>Total business assets</dt>
              <dd className="mt-1.5">
                <RelationshipAssetValue>{florin(view.totalBusinessAssets)}</RelationshipAssetValue>
              </dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Relationship since</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "font-medium")}>
                {formatDueDate(view.relationshipSince)}
              </dd>
              {relationshipDuration ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">{relationshipDuration}</p>
              ) : null}
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Products held</dt>
              <dd className="mt-2">
                <ProductTags labels={productLabels} />
              </dd>
            </div>
          </dl>

          <RelationshipProgressBar {...view.relationshipProgress} />

          {view.commercialBankingEligible ? (
            <div className="mt-5 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[14px]">
              Your company may be eligible for Alta Commercial Banking review.
            </div>
          ) : null}

          {view.opportunities.length > 0 ? (
            <div className="mt-5 space-y-2.5">
              <p className={RELATIONSHIP_METRIC_LABEL}>Opportunities</p>
              {view.opportunities.map((opportunity) => (
                <div
                  key={opportunity.title}
                  className="rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[14px]"
                >
                  <p className="font-medium">{opportunity.title}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{opportunity.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Lifetime activity" className={RELATIONSHIP_SECTION_GAP}>
        <Card className="!p-5 sm:!p-6 hover:!border-border">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Deposits</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeDeposits)}
              </dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Withdrawals</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeWithdrawals)}
              </dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Alta Pay volume</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeAltaPayVolume)}
              </dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Interest earned</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeInterestEarned)}
              </dd>
            </div>
          </dl>
        </Card>
      </Section>

      <Section title="Business products" className={RELATIONSHIP_SECTION_GAP}>
        <Card className="!p-5 sm:!p-6 hover:!border-border">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Business accounts</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>
                {view.productHoldings.activeBusinessAccounts}
              </dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Active business loans</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.activeBusinessLoans}</dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Active business Alta Cards</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.activeBusinessCards}</dd>
            </div>
            <div>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Paid-off loans</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>
                {view.productHoldings.paidOffBusinessLoans}
              </dd>
            </div>
          </dl>
        </Card>
      </Section>

      <Section title="Relationship timeline" className="mt-10 sm:mt-11">
        <Card className="!p-5 sm:!p-6 hover:!border-border">
          <RelationshipTimelineList
            events={view.timeline}
            emptyMessage="Milestones from your company's Alta products and activity will appear here as the relationship grows."
          />
        </Card>
      </Section>
    </PageShell>
  );
}
