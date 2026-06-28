import { createFileRoute, Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardPersonalPanel } from "@/components/bank/alta-card/alta-card-personal-panel";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  AltaCardLandingHero,
  AltaCardPendingApplicationBanner,
  AltaCardPersonalVsBusiness,
} from "@/components/bank/alta-card/alta-card-landing-hero";
import { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchUserAltaCard, fetchAltaCardDetail } from "@/lib/bank/alta-card.functions";
import { fetchCardBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchUserPendingAltaCardApplication } from "@/lib/bank/alta-card-application.functions";
import { fetchAltaCardReviewEligibility } from "@/lib/bank/alta-card-review.functions";
import { fetchAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

export const Route = createFileRoute("/bank/alta-card/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const card = await fetchUserAltaCard();
    const cardDetail = card ? await fetchAltaCardDetail({ data: card.id }).catch(() => null) : null;
    const [billingSummary, pendingApplication, reviewEligibility, autopayContext] = await Promise.all([
      card ? fetchCardBillingSummaryRecord({ data: card.id }) : null,
      fetchUserPendingAltaCardApplication(),
      card ? fetchAltaCardReviewEligibility({ data: card.id }).catch(() => null) : null,
      card ? fetchAltaCardAutopayContext({ data: card.id }).catch(() => null) : null,
    ]);
    return { card, cardDetail, billingSummary, pendingApplication, reviewEligibility, autopayContext };
  },
  head: () => ({
    meta: [{ title: "Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardIndex,
});

function BankAltaCardIndex() {
  const user = useCurrentUser();
  const { card, cardDetail, billingSummary, pendingApplication, reviewEligibility, autopayContext } =
    Route.useLoaderData();
  const creditDeskNav = useCreditDeskCustomerNav();

  const cardholderName =
    user?.discordUsername ?? cardDetail?.ownerUsername ?? card?.ownerUsername ?? "Cardholder";

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title={card ? cardholderName : "Alta Card"}
      description={
        card
          ? undefined
          : "Revolving credit for your Alta relationship — personal lines, business credit, and authorized employee cards."
      }
      action={
        !card && !pendingApplication && creditDeskNav.showApplyEntryPoints ? (
          <Link
            to="/bank/alta-card/apply"
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
          >
            Apply
          </Link>
        ) : null
      }
    />
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
        <AltaCardPersonalPanel
          card={cardDetail ?? card}
          cardholderName={cardholderName}
          billingSummary={billingSummary}
          reviewEligibility={reviewEligibility}
          autopayContext={autopayContext}
          transactions={cardDetail?.recentTransactions ?? []}
        />
      ) : !pendingApplication ? (
        creditDeskNav.showApplyEntryPoints ? (
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
        ) : null
      ) : null}
    </>
  );
}
