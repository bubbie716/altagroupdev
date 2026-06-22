import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { ListingApplicationForm } from "@/components/exchange/listing-application-form";

export const Route = createFileRoute("/exchange/apply")({
  head: () => ({
    meta: [{ title: "List on Alta Exchange — Alta Exchange" }],
  }),
  component: ExchangeApply,
});

function ExchangeApply() {
  return (
    <PageShell
      eyebrow="Alta Exchange · Listing Application"
      title="List on Alta Exchange"
      description="Submit your company for review by Alta Exchange. Approved companies may become eligible for IPO preparation, public listing, and market access."
    >
      <ExchangeSubNav />
      <ListingApplicationForm />
    </PageShell>
  );
}
