import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
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
    <PageShell
      eyebrow="Alta Exchange · Listings"
      title="Listed Companies"
      description="184 Florin-denominated issuers listed on Alta Exchange — simulated market data."
    >
      <ExchangeSubNav />

      <Section title="All Listings">
        <CompanyTable companies={getCompanies()} />
      </Section>
    </PageShell>
  );
}
