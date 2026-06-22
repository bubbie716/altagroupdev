import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { RankingTable } from "@/components/exchange/ranking-table";
import { getMarketStats } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/rankings")({
  head: () => ({
    meta: [{ title: "Market Rankings — Alta Exchange" }],
  }),
  component: ExchangeRankings,
});

function ExchangeRankings() {
  const r = getMarketStats().rankings;

  return (
    <PageShell
      eyebrow="Alta Exchange · Rankings"
      title="Market Rankings"
      description="Top gainers, losers, most active, and largest issuers on Alta Exchange — simulated session data."
    >
      <ExchangeSubNav />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top Gainers">
          <RankingTable title="Top Gainers" rows={r.gainers} showChange />
        </Section>
        <Section title="Top Losers">
          <RankingTable title="Top Losers" rows={r.losers} showChange />
        </Section>
        <Section title="Most Active">
          <RankingTable title="Most Active" rows={r.mostActive} />
        </Section>
        <Section title="Largest Companies">
          <RankingTable title="Largest Companies" rows={r.largest} />
        </Section>
        <Section title="Highest Volume" className="lg:col-span-2">
          <RankingTable title="Highest Volume" rows={r.highestVolume} />
        </Section>
      </div>
    </PageShell>
  );
}
