import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
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
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Corporate Actions"
        title="Corporate Actions"
        description="Dividends, splits, buybacks, mergers, and tender offers across Alta Exchange listed issuers — simulated data."
      />

      {sections.map((s) => {
        const rows = corporateActions.filter((a) => a.category === s.filter);
        if (rows.length === 0) return null;
        return (
          <Section key={s.title} title={s.title} className="mt-10 first:mt-0">
            <CorporateActionTable actions={rows} />
          </Section>
        );
      })}
    </>
  );
}
