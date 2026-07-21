import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getIPOs } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/ipo")({
  head: () => ({
    meta: [{ title: "IPO Center — Alta Exchange" }],
  }),
  component: ExchangeIPO,
});

function ExchangeIPO() {
  const ipos = getIPOs();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · IPO Center"
        title="IPO Center"
        description="Primary market offerings, bookbuilding, and recently listed issuers on Alta Exchange."
      />

      {ipos.length === 0 ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="No IPOs listed yet."
          description="Open offerings, bookbuilding, and recently listed issuers will appear here once Alta Exchange primary market services launch."
          className="max-w-xl"
        />
      ) : null}
    </>
  );
}
