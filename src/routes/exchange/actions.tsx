import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { CorporateActionTable } from "@/components/exchange/corporate-action-table";
import { getCorporateActions } from "@/lib/exchange/api";

const sections = [
  { title: "Dividends", filter: "dividends" as const },
  { title: "Stock Splits", filter: "splits" as const },
  { title: "Buybacks", filter: "buybacks" as const },
  { title: "Mergers", filter: "mergers" as const },
  { title: "Tender Offers", filter: "tenders" as const },
];

export const Route = createFileRoute("/exchange/actions")({
  head: () => ({
    meta: [{ title: "Corporate Actions — Alta Exchange" }],
  }),
  component: ExchangeActions,
});

function ExchangeActions() {
  const corporateActions = getCorporateActions();

  return (
    <PageShell
      eyebrow="Alta Exchange · Corporate Actions"
      title="Corporate Actions"
      description="Dividends, splits, buybacks, mergers, and tender offers across Alta Exchange listed issuers — simulated data."
    >
      <ExchangeSubNav />

      {sections.map((s) => {
        const rows = corporateActions.filter((a) => a.category === s.filter);
        if (rows.length === 0) return null;
        return (
          <Section key={s.title} title={s.title} className="mt-10 first:mt-0">
            <CorporateActionTable actions={rows} />
          </Section>
        );
      })}
    </PageShell>
  );
}
