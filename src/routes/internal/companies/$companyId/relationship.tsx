import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import {
  CompanyRelationshipDetailPanel,
  CompanyProductHoldingsPanel,
} from "@/components/internal/company-relationship-intelligence-panel";
import { CompanyRelationshipRecommendationsPanel } from "@/components/internal/company-relationship-recommendations-panel";
import { CompanyRelationshipTimelinePanel } from "@/components/internal/company-relationship-timeline-panel";
import {
  backfillCompanyRelationshipTimelineRecord,
  fetchAdminCompanyRelationshipDetail,
  fetchCompanyRelationshipRecommendations,
  fetchCompanyRelationshipTimeline,
  refreshCompanyRelationshipProfileRecord,
} from "@/lib/internal/company-relationship-intelligence.functions";

export const Route = createFileRoute("/internal/companies/$companyId/relationship")({
  loader: async ({ params }) => {
    const [detail, recommendations, timeline] = await Promise.all([
      fetchAdminCompanyRelationshipDetail({ data: params.companyId }),
      fetchCompanyRelationshipRecommendations({ data: params.companyId }),
      fetchCompanyRelationshipTimeline({ data: params.companyId }),
    ]);
    return { ...detail, recommendations, timeline };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.company.name ?? "Company"} — Relationship Intelligence` }],
  }),
  component: InternalCompanyRelationshipPage,
});

function InternalCompanyRelationshipPage() {
  const { companyId } = Route.useParams();
  const { company, profile, calculated, timelineSummary, recommendations, timeline } = Route.useLoaderData();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  return (
    <InternalPageShell
      title={company.name}
      description="Company Relationship Profile — business products only."
    >
      <Link
        to="/internal/companies/$companyId"
        params={{ companyId }}
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← Company 360
      </Link>

      <CompanyRelationshipDetailPanel
        companyId={companyId}
        companyName={company.name}
        profile={profile}
        calculated={calculated}
        timelineSummary={timelineSummary}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          try {
            await refreshCompanyRelationshipProfileRecord({ data: companyId });
            await router.invalidate();
          } finally {
            setRefreshing(false);
          }
        }}
      />

      <div className="mt-8">
        <CompanyProductHoldingsPanel holdings={calculated.productHoldings} />
      </div>

      <div className="mt-8">
        <CompanyRelationshipRecommendationsPanel companyId={companyId} recommendations={recommendations} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Timeline</h3>
        <button
          type="button"
          disabled={backfilling}
          onClick={async () => {
            setBackfilling(true);
            try {
              await backfillCompanyRelationshipTimelineRecord({ data: companyId });
              await router.invalidate();
            } finally {
              setBackfilling(false);
            }
          }}
          className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-60"
        >
          {backfilling ? "Backfilling…" : "Backfill timeline"}
        </button>
      </div>

      <div className="mt-4">
        <CompanyRelationshipTimelinePanel companyId={companyId} timeline={timeline} />
      </div>
    </InternalPageShell>
  );
}
