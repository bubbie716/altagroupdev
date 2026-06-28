import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardBusinessPanel } from "@/components/bank/alta-card/alta-card-business-panel";
import { AltaCardBackToAllBusinessesButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";
import { fetchCompanyBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { fetchAltaCardReviewEligibility } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const companyCards = await fetchCompanyAltaCards({ data: params.companyId });
      const billingSummary = await fetchCompanyBillingSummaryRecord({ data: params.companyId }).catch(
        () => null,
      );
      const autopayContext = companyCards.businessCard
        ? await fetchAltaCardAutopayContext({ data: companyCards.businessCard.id }).catch(() => null)
        : null;
      const reviewEligibility = companyCards.businessCard
        ? await fetchAltaCardReviewEligibility({ data: companyCards.businessCard.id }).catch(() => null)
        : null;
      return { ...companyCards, billingSummary, autopayContext, reviewEligibility };
    } catch {
      throw redirect({ to: "/bank/alta-card/business" });
    }
  },
  head: () => ({
    meta: [{ title: "Business Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardBusinessDetail,
});

function BankAltaCardBusinessDetail() {
  const { companyId } = Route.useParams();
  const { businessCard, employeeCards, companyTransactions, pendingApplication, billingSummary, autopayContext, reviewEligibility, employeeMemberOptions, canManageTreasury, hasMultipleBusinessCards } =
    Route.useLoaderData();
  const router = useRouter();
  const companyName =
    businessCard?.companyName ?? pendingApplication?.companyName ?? "Company";

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title={companyName}
     />
<AltaCardPageNav>
        <AltaCardBackToAllBusinessesButton />
      </AltaCardPageNav>
      <AltaCardBusinessPanel
        companyId={companyId}
        companyName={companyName}
        businessCard={businessCard}
        pendingApplication={pendingApplication}
        billingSummary={billingSummary}
        autopayContext={autopayContext}
        reviewEligibility={reviewEligibility}
        employeeMemberOptions={employeeMemberOptions}
        employeeCards={employeeCards}
        companyTransactions={companyTransactions}
        canManageTreasury={canManageTreasury}
        hasMultipleBusinessCards={hasMultipleBusinessCards}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
    </>
  );
}
