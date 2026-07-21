import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { IssuerPortalPanel } from "@/components/exchange/issuer-portal";
import { getCompany } from "@/lib/exchange/api";
import { issuerPortalBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/exchange/company/$ticker/owner")({
  beforeLoad: issuerPortalBeforeLoad,
  head: ({ params }) => ({
    meta: [{ title: `Issuer Portal · ${params.ticker.toUpperCase()} — Alta Exchange` }],
  }),
  component: CompanyOwnerPage,
});

function CompanyOwnerPage() {
  const { ticker } = Route.useParams();
  const company = getCompany(ticker);

  if (!company) {
    return (
      <>
        <ExchangePageMeta
          eyebrow="Alta Exchange"
          title="Company Not Found"
          description="No listing found for this ticker."
        />
        <Card>
          <p className="text-muted-foreground">Ticker not found in Alta Exchange listings.</p>
          <Link to="/exchange/listings" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            ← Back to listings
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <ExchangePageMeta
        eyebrow={`Alta Exchange · Issuer Portal · ${company.symbol}`}
        title={`${company.name} — Owner Portal`}
        description="Publish corporate announcements and monthly financial updates to your Alta Exchange ticker page."
      />
      <div className="flex justify-center">
        <IssuerPortalPanel />
      </div>
    </>
  );
}
