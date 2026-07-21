import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getIndices } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/indices")({
  head: () => ({
    meta: [{ title: "Market Indices — Alta Exchange" }],
  }),
  component: ExchangeIndices,
});

function ExchangeIndices() {
  const indices = getIndices();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Indices"
        title="Market Indices"
        description="NSX benchmark indices calculated and published on Alta Exchange."
      />

      <p className="mb-8 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        NSX indices are market products on Alta Exchange. Alta Exchange is the institution; NSX is the
        index family used for benchmarking Republic equities.
      </p>

      {indices.length === 0 ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="No indices published yet."
          description="NSX index values and charts will appear here once Alta Exchange index calculation services are live."
          className="max-w-xl"
        />
      ) : null}
    </>
  );
}
