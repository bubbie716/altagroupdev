import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { getBusinessMetrics, getBusinessServices } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/business")({
  head: () => ({
    meta: [{ title: "Alta Bank Business — Alta Group" }],
  }),
  component: BankBusiness,
});

function BankBusiness() {
  const businessMetrics = getBusinessMetrics();
  const businessServices = getBusinessServices();

  return (
    <PageShell
      eyebrow="Alta Bank · Business"
      title="Business Banking"
      description="The institutional banking platform for Newport companies, founders, and corporate treasury desks."
    >
      <BankSubNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {businessMetrics.map((m) => (
          <BankStatCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {businessServices.map((s) => (
          <Card key={s.name}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {s.name}
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{s.desc}</p>
            <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-gold">{s.metric}</div>
          </Card>
        ))}
      </div>

      <Section title="Institutional Coverage" className="mt-12">
        <Card>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Alta Bank business clients receive dedicated coverage, multi-entity cash management, and
            integrated access to Alta Terminal and Alta Exchange infrastructure. Wire settlement routes
            through NCC-Net — planned clearing infrastructure for Newport interbank transfers.
          </p>
        </Card>
      </Section>
    </PageShell>
  );
}
