import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { FilingCard } from "@/components/exchange/filing-card";
import { getFilings } from "@/lib/exchange/api";

const sections = [
  { title: "Market Commentary", filter: "commentary" as const },
  { title: "Company Filings", filter: "filings" as const },
  { title: "IPO Prospectuses", filter: "prospectuses" as const },
  { title: "Economic Reports", filter: "economic" as const },
  { title: "Exchange Notices", filter: "notices" as const },
];

export const Route = createFileRoute("/exchange/research")({
  head: () => ({
    meta: [{ title: "Research & Filings — Alta Exchange" }],
  }),
  component: ExchangeResearch,
});

function ExchangeResearch() {
  const researchDocuments = getFilings();

  return (
    <PageShell
      eyebrow="Alta Exchange · Research"
      title="Research & Filings"
      description="Market commentary, issuer filings, IPO prospectuses, and exchange notices — simulated document library."
    >
      <ExchangeSubNav />

      {sections.map((s, i) => {
        const docs = researchDocuments.filter((d) => d.section === s.filter);
        return (
          <Section key={s.title} title={s.title} className={i > 0 ? "mt-12" : undefined}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <FilingCard key={doc.title} doc={doc} />
              ))}
            </div>
          </Section>
        );
      })}
    </PageShell>
  );
}
