import { createFileRoute } from "@tanstack/react-router";
import { FadeIn } from "@/components/ui/fade-in";
import { Section, Card } from "@/components/page-shell";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { GroupHierarchy } from "@/components/governance/group-hierarchy";
import { EntityOverview } from "@/components/governance/entity-overview";
import { GovernanceMetricsGrid } from "@/components/governance/governance-metrics-grid";
import { entityOverviewItems, groupHierarchy } from "@/lib/governance/content";
import { fetchPlatformMetrics } from "@/lib/metrics/platform-metrics.functions";
import { buildGovernancePlatformMetrics } from "@/lib/metrics/governance-metrics";
import { CorporatePageShell } from "@/components/site/corporate-page-shell";

export const Route = createFileRoute("/structure/")({
  loader: () => fetchPlatformMetrics(),
  head: () => ({
    meta: [
      { title: "Structure — Alta Group" },
      {
        name: "description",
        content:
          "Corporate structure of Alta Group N.V. — parent holding company of Alta Bank N.V., Alta Terminal, and Newport Clearing Corporation.",
      },
      { property: "og:title", content: "Alta Group — Structure" },
      {
        property: "og:description",
        content: "The financial holding company behind Newport's banking, brokerage, and clearing infrastructure.",
      },
    ],
  }),
  component: StructurePage,
});

function StructurePage() {
  const metrics = Route.useLoaderData();
  const platformItems = buildGovernancePlatformMetrics(metrics);

  return (
    <CorporatePageShell>
      <FadeIn className="border-b border-border/60 pb-12">
        <div className={type.eyebrow}>Structure</div>
        <h1 className={cn(type.displayGovernance, "mt-5")}>Alta Group</h1>
        <p className="mt-4 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-foreground">
          Live Like the 1%
        </p>
        <p className="mt-2 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-muted-foreground">
          Corporate Structure
        </p>
        <p className={cn(type.body, "mt-6 max-w-2xl text-muted-foreground")}>
          A single parent holding company — Alta Group N.V. — operating banking, brokerage, and clearing
          infrastructure for the Republic of Newport.
        </p>
      </FadeIn>

      <main className="py-12">
        <div className="mb-12 grid gap-6 lg:grid-cols-3">
          <Card>
            <div className="type-meta">Entity</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">Alta Group N.V.</div>
            <div className="mt-2 text-sm font-medium tracking-tight text-foreground">
              Live Like the 1%
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Financial Infrastructure Holding
            </div>
          </Card>
          <Card>
            <div className="type-meta">Mandate</div>
            <div className="mt-2 text-sm leading-relaxed">
              Operate banking, brokerage, and clearing infrastructure for the Republic of Newport under
              unified governance.
            </div>
          </Card>
          <Card>
            <div className="type-meta">Disclosures</div>
            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Alta platform data reflects live platform records where available. Brokerage market data
              is unavailable in this release. Florin-denominated. Not a real-money venue.
            </div>
          </Card>
        </div>

        <Section title="Group hierarchy" className="hidden md:block">
          <GroupHierarchy nodes={groupHierarchy} />
        </Section>

        <Section title="Entity overview" className="mt-12">
          <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Division mandates and service lines. Ownership and reporting relationships are detailed in
            each entity profile below.
          </p>
          <EntityOverview entities={entityOverviewItems} />
        </Section>

        <Section title="Platform status" className="mt-12">
          <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Entity posture and live platform records. Brokerage market statistics are unavailable in
            this release.
          </p>
          <GovernanceMetricsGrid items={platformItems} />
        </Section>
      </main>
    </CorporatePageShell>
  );
}
