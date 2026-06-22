import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { IPOCard } from "@/components/exchange/ipo-card";
import { getIPOs } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/ipo")({
  head: () => ({
    meta: [{ title: "IPO Center — Alta Exchange" }],
  }),
  component: ExchangeIPO,
});

function ExchangeIPO() {
  const open = getIPOs("open");
  const upcoming = getIPOs("upcoming");
  const recent = getIPOs("recent");

  return (
    <PageShell
      eyebrow="Alta Exchange · IPO Center"
      title="IPO Center"
      description="Primary market offerings, bookbuilding, and recently listed issuers on Alta Exchange — simulated preview."
    >
      <ExchangeSubNav />

      <Card className="mb-10 border-gold/30 bg-gold/5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          IPO participation is simulated in this preview.
        </p>
      </Card>

      <Section title="Open IPOs">
        <div className="grid gap-4 md:grid-cols-2">
          {open.map((ipo) => (
            <IPOCard key={ipo.ticker} ipo={ipo} />
          ))}
        </div>
      </Section>

      <Section title="Upcoming IPOs" className="mt-12">
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((ipo) => (
            <IPOCard key={ipo.ticker} ipo={ipo} />
          ))}
        </div>
      </Section>

      <Section title="Recently Listed" className="mt-12">
        <div className="grid gap-4 md:grid-cols-2">
          {recent.map((ipo) => (
            <IPOCard key={ipo.ticker} ipo={ipo} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
