import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardReviewDetailView } from "@/components/bank/alta-card/alta-card-review-form";
import { AltaCardBackToCardButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAltaCardReviewDetail } from "@/lib/bank/alta-card-review.functions";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/review/$reviewId/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const [review, companyCards] = await Promise.all([
        fetchAltaCardReviewDetail({ data: params.reviewId }),
        fetchCompanyAltaCards({ data: params.companyId }),
      ]);
      const card = companyCards.businessCard;
      if (!card || review.altaCardId !== card.id) {
        throw redirect({ to: "/bank/alta-card/business/$companyId", params: { companyId: params.companyId } });
      }
      return {
        review,
        cardId: card.id,
        companyId: params.companyId,
        companyName: card.companyName ?? "Company",
      };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Account Review — Business Alta Card" }] }),
  component: BusinessAltaCardReviewDetailPage,
});

function BusinessAltaCardReviewDetailPage() {
  const { review, cardId, companyId } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Account review"
      description="Track your review request, decision, and secure review thread."
    >
      <BankSubNav />
      <AltaCardPageNav>
        <AltaCardBackToCardButton
          card={{ cardType: "business", companyId: review.companyId ?? companyId }}
        />
      </AltaCardPageNav>
      <AltaCardReviewDetailView review={review} cardId={cardId} />
    </PageShell>
  );
}
