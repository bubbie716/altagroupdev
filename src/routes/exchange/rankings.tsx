import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
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
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Rankings"
        title="Market Rankings"
        description="Top gainers, losers, most active, and largest issuers on Alta Exchange — simulated session data."
      />

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
    </>
  );
}
