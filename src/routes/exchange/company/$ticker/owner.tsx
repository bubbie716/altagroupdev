import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { IssuerPortalPanel } from "@/components/exchange/issuer-portal";
import { getCompany } from "@/lib/exchange/api";
import { issuerPortalBeforeLoad } from "@/lib/auth/guards";
import { findCompanyMembership } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { IssuerSession } from "@/lib/exchange/issuer-access";

export const Route = createFileRoute("/exchange/company/$ticker/owner")({
  beforeLoad: issuerPortalBeforeLoad,
  head: ({ params }) => ({
    meta: [{ title: `Issuer Portal · ${params.ticker.toUpperCase()} — Alta Exchange` }],
  }),
  component: CompanyOwnerPage,
});

function CompanyOwnerPage() {
  const { ticker } = Route.useParams();
  const user = useCurrentUser();
  const company = getCompany(ticker);

  if (!company) {
    return (
      <PageShell eyebrow="Alta Exchange" title="Company Not Found" description="No listing found for this ticker.">
        <ExchangeSubNav />
        <Card>
          <p className="text-muted-foreground">Ticker not found in Alta Exchange listings.</p>
          <Link to="/exchange/listings" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            ← Back to listings
          </Link>
        </Card>
      </PageShell>
    );
  }

  if (!user) return null;

  const membership = findCompanyMembership(user, { ticker });
  const session: IssuerSession = {
    ticker: company.symbol,
    organization: membership?.companyName ?? company.name,
  };

  return (
    <PageShell
      eyebrow={`Alta Exchange · Issuer Portal · ${company.symbol}`}
      title={`${company.name} — Owner Portal`}
      description="Publish corporate announcements and monthly financial updates to your Alta Exchange ticker page."
    >
      <ExchangeSubNav />
      <div className="flex justify-center">
        <IssuerPortalPanel company={company} session={session} onSignOut={() => {}} />
      </div>
    </PageShell>
  );
}
