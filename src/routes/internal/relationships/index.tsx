import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { florin } from "@/lib/bank/api";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import { fetchRelationshipIntelligenceDashboard } from "@/lib/internal/relationship-intelligence.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const Route = createFileRoute("/internal/relationships/")({
  loader: async () => fetchRelationshipIntelligenceDashboard(),
  head: () => ({ meta: [{ title: "Relationship Intelligence — Alta Internal" }] }),
  component: InternalRelationshipsIndexPage,
});

function InternalRelationshipsIndexPage() {
  const data = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Relationship Intelligence"
      description="Central relationship profiles across Alta Bank, Card, lending, and business banking."
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Profiles on file" value={String(data.totalProfiles)} />
        <InternalStatCard label="Private eligible" value={String(data.privateEligibleCount)} />
        <InternalStatCard label="Preferred / Premier+" value={String(data.preferredOrPremierCount)} />
        <InternalStatCard label="Top tracked" value={String(data.topByAssets.length)} />
      </div>

      <section className="mb-10 space-y-4">
        <h2 className="font-serif text-[22px]">Highest relationship value</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-surface-1/60 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Total Alta assets</th>
              </tr>
            </thead>
            <tbody>
              {data.topByAssets.map((row) => (
                <tr key={row.userId} className="border-b border-border/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/internal/relationships/$userId"
                      params={{ userId: row.userId }}
                      className="font-medium hover:text-gold"
                    >
                      {row.discordUsername}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.relationshipScore}</td>
                  <td className="px-4 py-3">{RELATIONSHIP_TIER_LABELS[row.relationshipTier]}</td>
                  <td className="px-4 py-3 tabular-nums">{florin(row.totalAltaAssets)}</td>
                </tr>
              ))}
              {data.topByAssets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No persisted profiles yet. Open a customer profile and refresh to create one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-[22px]">Recently changed scores</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-surface-1/60 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.recentlyChanged.map((row) => (
                <tr key={`${row.userId}-${row.calculatedAt}`} className="border-b border-border/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/internal/relationships/$userId"
                      params={{ userId: row.userId }}
                      className="font-medium hover:text-gold"
                    >
                      {row.discordUsername}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.oldScore} → {row.newScore}
                  </td>
                  <td className="px-4 py-3">
                    {RELATIONSHIP_TIER_LABELS[row.oldTier]} → {RELATIONSHIP_TIER_LABELS[row.newTier]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatActivityDateTime(row.calculatedAt)}
                  </td>
                </tr>
              ))}
              {data.recentlyChanged.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No score changes recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </InternalPageShell>
  );
}
