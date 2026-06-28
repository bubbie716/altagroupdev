import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardReviewForm } from "@/components/bank/alta-card/alta-card-review-form";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import { fetchAltaCardDetail } from "@/lib/bank/alta-card.functions";
import { fetchAltaCardReviewFormContext } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/bank/alta-card/$cardId/review/")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
  },
  loader: async ({ params }) => {
    try {
      const card = await fetchAltaCardDetail({ data: params.cardId });
      if (card.cardType === "business" && card.companyId) {
        throw redirect({
          to: "/bank/alta-card/business/$companyId/review",
          params: { companyId: card.companyId },
        });
      }
      const context = await fetchAltaCardReviewFormContext({ data: params.cardId });
      return { context, cardId: params.cardId };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/bank/alta-card" });
    }
  },
  head: () => ({ meta: [{ title: "Request Account Review — Alta Card" }] }),
  component: AltaCardReviewPage,
});

function AltaCardReviewPage() {
  const { context, cardId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title="Account review"
      description="View past reviews or request improved credit limit, interest rate, or card tier."
     />
<AltaCardReviewForm context={context} cardId={cardId} />
    </>
  );
}
