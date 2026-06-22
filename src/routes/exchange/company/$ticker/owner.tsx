import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell, Card } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { IssuerAccessGate, IssuerPortalPanel } from "@/components/exchange/issuer-portal";
import { getCompany } from "@/lib/exchange/api";
import {
  clearIssuerSession,
  readIssuerSession,
  type IssuerSession,
} from "@/lib/exchange/issuer-access";

export const Route = createFileRoute("/exchange/company/$ticker/owner")({
  head: ({ params }) => ({
    meta: [{ title: `Issuer Portal · ${params.ticker.toUpperCase()} — Alta Exchange` }],
  }),
  component: CompanyOwnerPage,
});

function CompanyOwnerPage() {
  const { ticker } = Route.useParams();
  const company = getCompany(ticker);
  const [session, setSession] = useState<IssuerSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readIssuerSession(ticker));
    setReady(true);
  }, [ticker]);

  function handleSignOut() {
    clearIssuerSession();
    setSession(null);
  }

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

  if (!ready) return null;

  return (
    <PageShell
      eyebrow={`Alta Exchange · Issuer Portal · ${company.symbol}`}
      title={`${company.name} — Owner Portal`}
      description={
        session
          ? "Publish corporate announcements and monthly financial updates to your Alta Exchange ticker page."
          : "Verified listing owners only. Sign in to manage investor communications."
      }
    >
      <ExchangeSubNav />

      {session ? (
        <div className="flex justify-center">
          <IssuerPortalPanel company={company} session={session} onSignOut={handleSignOut} />
        </div>
      ) : (
        <div className="flex justify-center">
          <IssuerAccessGate company={company} onAuthenticated={setSession} />
        </div>
      )}
    </PageShell>
  );
}
