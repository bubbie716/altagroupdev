import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getMarketStats } from "@/lib/exchange/api";
import { ALTA_EXCHANGE_TAGLINE } from "@/lib/branding/alta-products";

export const Route = createFileRoute("/exchange/")({
  head: () => ({
    meta: [
      { title: "Alta Exchange — The capital markets platform of Newport." },
      { name: "description", content: getMarketStats().description },
    ],
  }),
  component: ExchangeOverview,
});

function ExchangeOverview() {
  const market = getMarketStats();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange"
        title={ALTA_EXCHANGE_TAGLINE}
        description="Alta Exchange operates Newport's primary market infrastructure for listings, price discovery, execution, market data, and Alta Terminal."
      />

      <EmptyState
        eyebrow="Alta Exchange"
        title="Market data is not available yet."
        description="Listings, indices, IPOs, and market statistics will publish here once Alta Exchange market services are live."
        className="max-w-xl"
        actions={[
          { label: "View listings", to: "/exchange/listings", variant: "secondary" },
          { label: "Developer API", to: "/exchange/api" },
        ]}
      />

      <Section title="Market Snapshot" className="mt-12">
        <Card className="px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
                {market.snapshot.index.symbol}
              </div>
              <div className="mt-2 text-[15px] text-muted-foreground">Index values unavailable</div>
            </div>
            <div className="shrink-0 sm:text-right">
              <div className="type-meta hidden sm:block">Status</div>
              <div className="mt-0 inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-[11px] sm:mt-1">
                <span className="font-mono uppercase tracking-wide text-muted-foreground">
                  {market.snapshot.status}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </Section>

      <Section
        title="Explore Alta Exchange"
        className="mt-12"
        action={
          <Link to="/exchange/listings" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            Listings →
          </Link>
        }
      >
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Alta Exchange product pages remain available while market datasets are being connected to
          persisted listing and pricing services.
        </p>
      </Section>
    </>
  );
}
