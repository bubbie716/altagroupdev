import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { CompanyTable } from "@/components/exchange/company-table";
import { getCompanies } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/listings")({
  head: () => ({
    meta: [{ title: "Listed Companies — Alta Exchange" }],
  }),
  component: ExchangeListings,
});

function ExchangeListings() {
  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Listings"
        title="Listed Companies"
        description="184 Florin-denominated issuers listed on Alta Exchange — simulated market data."
      />

      <Section title="All Listings">
        <CompanyTable companies={getCompanies()} />
      </Section>
    </>
  );
}
