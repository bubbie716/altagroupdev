import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { CompanyTable } from "@/components/exchange/company-table";
import { EmptyState } from "@/components/data/empty-state";
import { getCompanies } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/listings")({
  head: () => ({
    meta: [{ title: "Listed Companies — Alta Exchange" }],
  }),
  component: ExchangeListings,
});

function ExchangeListings() {
  const companies = getCompanies();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Listings"
        title="Listed Companies"
        description="Florin-denominated issuers listed on Alta Exchange."
      />

      {companies.length === 0 ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="No listed companies yet."
          description="Issuer listings will appear here once Alta Exchange listing services publish live market data."
          className="max-w-xl"
        />
      ) : (
        <CompanyTable companies={companies} />
      )}
    </>
  );
}
