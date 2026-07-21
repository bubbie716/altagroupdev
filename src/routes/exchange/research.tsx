import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getFilings } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/research")({
  head: () => ({
    meta: [{ title: "Research & Filings — Alta Exchange" }],
  }),
  component: ExchangeResearch,
});

function ExchangeResearch() {
  const researchDocuments = getFilings();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Research"
        title="Research & Filings"
        description="Market commentary, issuer filings, IPO prospectuses, and exchange notices."
      />

      {researchDocuments.length === 0 ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="No research documents yet."
          description="Filings, prospectuses, and exchange notices will appear here once Alta Exchange document services are available."
          className="max-w-xl"
        />
      ) : null}
    </>
  );
}
