import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { IPOAccessCard } from "@/components/terminal/ipo-access-card";
import { getTerminalIpoAccess } from "@/lib/terminal/api";

export const Route = createFileRoute("/terminal/ipo")({
  head: () => ({
    meta: [{ title: "IPO Access — Alta Terminal" }],
  }),
  component: TerminalIPO,
});

function TerminalIPO() {
  const terminalIpoAccess = getTerminalIpoAccess();
  const open = terminalIpoAccess.filter((i) => i.stage === "open");
  const upcoming = terminalIpoAccess.filter((i) => i.stage === "upcoming");
  const recent = terminalIpoAccess.filter((i) => i.stage === "recent");

  return (
    <PageShell
      eyebrow="Alta Terminal · IPO Access"
      title="IPO Access"
      description="Track open offerings, upcoming listings, and allocation status on Alta Exchange — simulated preview."
    >
      <TerminalSubNav />

      <Card className="mb-10 border-gold/30 bg-gold/5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          IPO participation and allocation are simulated in this preview. No subscriptions are processed.
        </p>
      </Card>

      <Section title="Open IPOs">
        <div className="grid gap-4 md:grid-cols-2">
          {open.map((ipo) => (
            <IPOAccessCard
              key={ipo.ticker}
              company={ipo.company}
              ticker={ipo.ticker}
              status={ipo.status}
              allocationStatus={ipo.allocationStatus}
              detail={`Offering ${ipo.offeringPrice} · Raise ${ipo.raiseSize}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Upcoming IPOs" className="mt-12">
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((ipo) => (
            <IPOAccessCard
              key={ipo.ticker}
              company={ipo.company}
              ticker={ipo.ticker}
              status={ipo.status}
              allocationStatus={ipo.allocationStatus}
              detail={`Expected ${ipo.expectedPrice}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Recently Listed" className="mt-12">
        <div className="grid gap-4 md:grid-cols-2">
          {recent.map((ipo) => (
            <IPOAccessCard
              key={ipo.ticker}
              company={ipo.company}
              ticker={ipo.ticker}
              status={ipo.status}
              allocationStatus={ipo.allocationStatus}
              detail={`Listed ${ipo.listingPrice} · Now ${ipo.currentPrice} (${ipo.returnSinceListing})`}
            />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
