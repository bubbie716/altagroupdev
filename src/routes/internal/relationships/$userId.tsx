import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { RelationshipIntelligenceDetailPanel } from "@/components/internal/relationship-intelligence-detail-panel";
import { RelationshipRecommendationsPanel } from "@/components/internal/relationship-recommendations-panel";
import { RelationshipTimelinePanel } from "@/components/internal/relationship-timeline-panel";
import { PrivateBankingIntelligencePanel } from "@/components/internal/relationship-intelligence-operator-panel";
import {
  fetchAdminRelationshipDetail,
  fetchRelationshipIntegrationBundle,
  fetchRelationshipRecommendations,
  fetchRelationshipTimeline,
} from "@/lib/internal/relationship-intelligence.functions";

export const Route = createFileRoute("/internal/relationships/$userId")({
  loader: async ({ params }) => {
    const [detail, recommendations, timeline, privateBanking] = await Promise.all([
      fetchAdminRelationshipDetail({ data: params.userId }),
      fetchRelationshipRecommendations({ data: params.userId }),
      fetchRelationshipTimeline({ data: params.userId }),
      fetchRelationshipIntegrationBundle({ data: { userId: params.userId, context: "PRIVATE_BANKING" } }),
    ]);
    return { ...detail, recommendations, timeline, privateBanking };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.user.discordUsername ?? "Customer"} — Relationship Intelligence` }],
  }),
  component: InternalRelationshipDetailPage,
});

function InternalRelationshipDetailPage() {
  const { userId } = Route.useParams();
  const { profile, calculated, user, recommendations, timeline, timelineSummary, privateBanking } =
    Route.useLoaderData();

  return (
    <InternalPageShell
      title={user.discordUsername}
      description="Customer relationship profile — read-only intelligence."
    >
      <Link
        to="/internal/relationships"
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← Relationship Intelligence
      </Link>
      <Link
        to="/internal/users/$userId"
        params={{ userId }}
        className="mb-6 ml-4 inline-block font-mono text-[12px] text-muted-foreground hover:text-foreground hover:underline"
      >
        User record →
      </Link>

      <RelationshipIntelligenceDetailPanel
        userId={userId}
        profile={profile}
        calculated={calculated}
        timelineSummary={timelineSummary}
      />

      <div className="mt-8">
        <PrivateBankingIntelligencePanel
          panel={privateBanking.panel}
          recommendations={privateBanking.recommendations}
        />
      </div>

      <div className="mt-8">
        <RelationshipRecommendationsPanel userId={userId} recommendations={recommendations} />
      </div>

      <div className="mt-8">
        <RelationshipTimelinePanel userId={userId} timeline={timeline} />
      </div>
    </InternalPageShell>
  );
}
