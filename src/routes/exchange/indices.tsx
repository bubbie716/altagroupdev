import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { IndexCard } from "@/components/exchange/index-card";
import { getIndices } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/indices")({
  head: () => ({
    meta: [{ title: "Market Indices — Alta Exchange" }],
  }),
  component: ExchangeIndices,
});

function ExchangeIndices() {
  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Indices"
        title="Market Indices"
        description="NSX benchmark indices calculated and published on Alta Exchange — simulated market data."
      />

      <p className="mb-8 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        NSX indices are market products on Alta Exchange. Alta Exchange is the institution; NSX is the
        index family used for benchmarking Republic equities.
      </p>

      <Section title="NSX Index Suite">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getIndices().map((idx) => (
            <IndexCard key={idx.symbol} index={idx} />
          ))}
        </div>
      </Section>
    </>
  );
}
