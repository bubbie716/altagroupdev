import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
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
          "Corporate structure of Alta Group N.V. — parent holding company of Alta Bank N.V., Alta Exchange N.V. (including Alta Terminal), and Newport Clearing Corporation.",
      },
      { property: "og:title", content: "Alta Group — Structure" },
      {
        property: "og:description",
        content: "The financial holding company behind Newport's banking, exchange, and clearing infrastructure.",
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border/60 pb-12"
      >
        <div className={type.eyebrow}>Structure</div>
        <h1 className={cn(type.displayGovernance, "mt-5")}>Alta Group</h1>
        <p className="mt-4 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-foreground">
          Live Like the 1%
        </p>
        <p className="mt-2 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-muted-foreground">
          Corporate Structure
        </p>
        <p className={cn(type.body, "mt-6 max-w-2xl text-muted-foreground")}>
          A single parent holding company — Alta Group N.V. — operating banking, exchange, and clearing
          infrastructure for the Republic of Newport.
        </p>
      </motion.div>

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
              Operate banking, exchange, market technology, and clearing infrastructure for the
              Republic of Newport under unified governance.
            </div>
          </Card>
          <Card>
            <div className="type-meta">Disclosures</div>
            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Alta platform data reflects live platform records where available. Market data remains
              simulated. Florin-denominated. Not a real-money venue.
            </div>
          </Card>
        </div>

        <Section title="Group hierarchy" className="hidden md:block">
          <GroupHierarchy nodes={groupHierarchy} />
        </Section>

        <Section title="Entity overview" className="mt-12">
          <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Division mandates, service lines, and exchange products. Ownership and reporting
            relationships are detailed in each entity profile below.
          </p>
          <EntityOverview entities={entityOverviewItems} />
        </Section>

        <Section title="Platform status" className="mt-12">
          <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Entity posture and live platform records. Exchange market statistics remain simulated for
            product testing.
          </p>
          <GovernanceMetricsGrid items={platformItems} />
        </Section>
      </main>
    </CorporatePageShell>
  );
}
