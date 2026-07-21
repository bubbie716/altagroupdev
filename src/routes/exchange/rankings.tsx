import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getMarketStats } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/rankings")({
  head: () => ({
    meta: [{ title: "Market Rankings — Alta Exchange" }],
  }),
  component: ExchangeRankings,
});

function ExchangeRankings() {
  const rankings = getMarketStats().rankings;
  const hasRankings = Object.values(rankings).some((rows) => rows.length > 0);

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Rankings"
        title="Market Rankings"
        description="Top gainers, losers, most active, and largest issuers on Alta Exchange."
      />

      {!hasRankings ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="Market rankings are not available yet."
          description="Gainers, losers, volume, and market-cap leaderboards will publish here once Alta Exchange market data is live."
          className="max-w-xl"
        />
      ) : null}
    </>
  );
}
