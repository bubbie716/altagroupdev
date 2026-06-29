import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { florin } from "@/lib/bank/api";
import { displayRelationshipTierLabelFromCode } from "@/lib/bank/relationship-terminology";
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
      <div className="mb-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Profiles on file" value={String(data.totalProfiles)} />
        <InternalStatCard label="Eligible for Alta Private" value={String(data.privateEligibleCount)} />
        <InternalStatCard label="Preferred / Premier" value={String(data.preferredOrPremierCount)} />
        <InternalStatCard label="Top tracked" value={String(data.topByAssets.length)} />
      </div>

      <section className="mb-10 min-w-0 space-y-4">
        <h2 className="font-serif text-[22px]">Highest relationship value</h2>
        <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
          {data.topByAssets.map((row) => (
            <div key={row.userId} className="space-y-2 px-4 py-4">
              <Link
                to="/internal/relationships/$userId"
                params={{ userId: row.userId }}
                className="break-words font-medium hover:text-gold"
              >
                {row.discordUsername}
              </Link>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <dt className="text-muted-foreground">Score</dt>
                  <dd className="tabular-nums">{row.relationshipScore}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tier</dt>
                  <dd>{displayRelationshipTierLabelFromCode(row.relationshipTier)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Total Alta assets</dt>
                  <dd className="tabular-nums">{florin(row.totalAltaAssets)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {data.topByAssets.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground">
              No persisted profiles yet. Open a customer profile and refresh to create one.
            </p>
          ) : null}
        </div>
        <div className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border md:block">
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
                  <td className="px-4 py-3">{displayRelationshipTierLabelFromCode(row.relationshipTier)}</td>
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

      <section className="min-w-0 space-y-4">
        <h2 className="font-serif text-[22px]">Recently changed scores</h2>
        <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
          {data.recentlyChanged.map((row) => (
            <div key={`${row.userId}-${row.calculatedAt}`} className="space-y-2 px-4 py-4">
              <Link
                to="/internal/relationships/$userId"
                params={{ userId: row.userId }}
                className="break-words font-medium hover:text-gold"
              >
                {row.discordUsername}
              </Link>
              <dl className="grid gap-2 text-[12px]">
                <div>
                  <dt className="text-muted-foreground">Score</dt>
                  <dd className="tabular-nums">
                    {row.oldScore} → {row.newScore}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tier</dt>
                  <dd>
                    {displayRelationshipTierLabelFromCode(row.oldTier)} →{" "}
                    {displayRelationshipTierLabelFromCode(row.newTier)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="text-muted-foreground">{formatActivityDateTime(row.calculatedAt)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {data.recentlyChanged.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground">
              No score changes recorded yet.
            </p>
          ) : null}
        </div>
        <div className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border md:block">
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
                    {displayRelationshipTierLabelFromCode(row.oldTier)} →{" "}
                    {displayRelationshipTierLabelFromCode(row.newTier)}
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
