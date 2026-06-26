import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardLandingDashboard } from "@/components/bank/alta-card/alta-card-detail-view";
import {
  AltaCardLandingHero,
  AltaCardPendingApplicationBanner,
  AltaCardPersonalVsBusiness,
} from "@/components/bank/alta-card/alta-card-landing-hero";
import { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchUserAltaCard } from "@/lib/bank/alta-card.functions";
import { fetchCardBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchUserPendingAltaCardApplication } from "@/lib/bank/alta-card-application.functions";

export const Route = createFileRoute("/bank/alta-card/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const card = await fetchUserAltaCard();
    const [billingSummary, pendingApplication] = await Promise.all([
      card ? fetchCardBillingSummaryRecord({ data: card.id }) : null,
      fetchUserPendingAltaCardApplication(),
    ]);
    return { card, billingSummary, pendingApplication };
  },
  head: () => ({
    meta: [{ title: "Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardIndex,
});

function BankAltaCardIndex() {
  const { card, billingSummary, pendingApplication } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Alta Card"
      description="Revolving credit for your Alta relationship — personal lines, business credit, and authorized employee cards."
      action={
        <div className="flex flex-wrap gap-2">
          {!card && !pendingApplication ? (
            <Link
              to="/bank/alta-card/apply"
              className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
            >
              Apply
            </Link>
          ) : null}
          {card ? (
            <Link
              to="/bank/alta-card/$cardId"
              params={{ cardId: card.id }}
              className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
            >
              Card details
            </Link>
          ) : null}
        </div>
      }
    >
      <BankSubNav />

      {pendingApplication && !card ? (
        <div className="mb-8">
          <AltaCardPendingApplicationBanner
            statusLabel={ALTA_CARD_APPLICATION_STATUS_LABELS[pendingApplication.status]}
            applicationId={pendingApplication.id}
            cardType={pendingApplication.cardType}
            status={pendingApplication.status}
          />
        </div>
      ) : null}

      {card ? (
        <AltaCardLandingDashboard card={card} billingSummary={billingSummary} />
      ) : !pendingApplication ? (
        <div className="space-y-10">
          <AltaCardLandingHero />
          <div>
            <h3 className="mb-2 font-serif text-[22px]">Compare tiers</h3>
            <p className="mb-6 max-w-2xl text-[14px] text-muted-foreground">
              Four tiers from entry revolving credit to Alta Private. Limits and rates reflect your
              relationship with Alta Bank.
            </p>
            <AltaCardTierComparison />
          </div>
          <div>
            <h3 className="mb-4 font-serif text-[20px]">Personal & business</h3>
            <AltaCardPersonalVsBusiness />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
