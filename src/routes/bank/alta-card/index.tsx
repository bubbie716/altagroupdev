"use client";

import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardApplyWorkflow } from "@/components/bank/alta-card/alta-card-apply-workflow";
import { AltaCardPersonalPanel } from "@/components/bank/alta-card/alta-card-personal-panel";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  AltaCardLandingHero,
  AltaCardPendingApplicationBanner,
  AltaCardPersonalVsBusiness,
  AltaGoldCardHighlight,
} from "@/components/bank/alta-card/alta-card-landing-hero";
import { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import {
  fetchUserAltaCard,
  fetchAltaCardDetail,
  fetchAltaCardApplyContext,
} from "@/lib/bank/alta-card.functions";
import { fetchCardBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchUserPendingAltaCardApplication } from "@/lib/bank/alta-card-application.functions";
import { fetchAltaCardReviewEligibility } from "@/lib/bank/alta-card-review.functions";
import { fetchAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { formatAltaUserHandle } from "@/lib/auth/user-display";

type AltaCardIndexSearch = {
  apply?: "1";
};

export const Route = createFileRoute("/bank/alta-card/")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
  },
  validateSearch: (search: Record<string, unknown>): AltaCardIndexSearch => {
    const next: AltaCardIndexSearch = {};
    if (search.apply === "1" || search.apply === 1) next.apply = "1";
    return next;
  },
  loader: async () => {
    const [card, pendingApplication] = await Promise.all([
      fetchUserAltaCard(),
      fetchUserPendingAltaCardApplication(),
    ]);
    const [cardDetail, billingSummary, reviewEligibility, autopayContext] = await Promise.all([
      card ? fetchAltaCardDetail({ data: card.id }).catch(() => null) : null,
      card ? fetchCardBillingSummaryRecord({ data: card.id }) : null,
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
  const router = useRouter();
  const { apply } = Route.useSearch();
  const { card, cardDetail, billingSummary, pendingApplication, reviewEligibility, autopayContext } =
    Route.useLoaderData();
  const creditDeskNav = useCreditDeskCustomerNav();
  const showApply = creditDeskNav.showApplyEntryPoints;
  const showApplyWorkflow = showApply && apply === "1" && Boolean(user);
  const fetchApplyContext = useServerFn(fetchAltaCardApplyContext);
  const [applyContext, setApplyContext] = useState<Awaited<
    ReturnType<typeof fetchAltaCardApplyContext>
  > | null>(null);

  useEffect(() => {
    if (!showApplyWorkflow) {
      setApplyContext(null);
      return;
    }
    let cancelled = false;
    void fetchApplyContext()
      .then((context) => {
        if (!cancelled) setApplyContext(context);
      })
      .catch(() => {
        if (!cancelled) setApplyContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showApplyWorkflow, fetchApplyContext]);

  function closeApplyWorkflow() {
    void router.navigate({
      to: "/bank/alta-card",
      search: (prev) => {
        const { apply: _apply, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
  }

  const cardholderName =
    (user ? formatAltaUserHandle(user) : null) ||
    cardDetail?.ownerUsername ||
    card?.ownerUsername ||
    "Cardholder";

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Alta Card"
        title={card ? ALTA_CARD_TIER_LABELS[card.tier] : "Alta Card"}
        description={
          card
            ? undefined
            : "Revolving credit for your Alta relationship — personal lines, business credit, and authorized employee cards."
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
                Four tiers from entry revolving credit to Alta Gold. Limits and rates reflect your
                relationship with Alta Bank.
              </p>
              <AltaCardTierComparison />
            </div>
            <AltaGoldCardHighlight />
            <div>
              <h3 className="mb-4 font-serif text-[20px]">Personal & business</h3>
              <AltaCardPersonalVsBusiness />
            </div>
          </div>
        ) : null
      ) : null}

      {showApplyWorkflow && applyContext ? (
        <AltaCardApplyWorkflow
          open
          context={applyContext}
          kind="personal"
          onOpenChange={(open) => {
            if (!open) closeApplyWorkflow();
          }}
          onDone={closeApplyWorkflow}
        />
      ) : null}
    </>
  );
}
