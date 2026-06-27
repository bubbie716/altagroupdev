import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardReviewForm } from "@/components/bank/alta-card/alta-card-review-form";
import { AltaCardBackToCardButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";
import { fetchAltaCardReviewFormContext } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/review/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const companyCards = await fetchCompanyAltaCards({ data: params.companyId });
      const card = companyCards.businessCard;
      if (!card) {
        throw redirect({
          to: "/bank/alta-card/business/$companyId",
          params: { companyId: params.companyId },
        });
      }
      const context = await fetchAltaCardReviewFormContext({ data: card.id });
      return {
        context,
        cardId: card.id,
        companyId: params.companyId,
        companyName: card.companyName ?? "Company",
      };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/bank/alta-card/business" });
    }
  },
  head: () => ({ meta: [{ title: "Request Account Review — Business Alta Card" }] }),
  component: BusinessAltaCardReviewPage,
});

function BusinessAltaCardReviewPage() {
  const { context, cardId, companyId } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Account review"
      description="View past reviews or request improved credit limit, interest rate, or card tier."
    >
      <BankSubNav />
      <AltaCardPageNav>
        <AltaCardBackToCardButton card={{ cardType: "business", companyId }} />
      </AltaCardPageNav>
      <AltaCardReviewForm context={context} cardId={cardId} />
    </PageShell>
  );
}
