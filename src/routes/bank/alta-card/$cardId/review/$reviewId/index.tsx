import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardReviewDetailView } from "@/components/bank/alta-card/alta-card-review-form";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAltaCardReviewDetail } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/bank/alta-card/$cardId/review/$reviewId/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const review = await fetchAltaCardReviewDetail({ data: params.reviewId });
      if (review.cardType === "business" && review.companyId) {
        throw redirect({
          to: "/bank/alta-card/business/$companyId/review/$reviewId",
          params: { companyId: review.companyId, reviewId: params.reviewId },
        });
      }
      return { review, cardId: params.cardId };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Account Review — Alta Card" }] }),
  component: AltaCardReviewDetailPage,
});

function AltaCardReviewDetailPage() {
  const { review, cardId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title="Account review"
      description="Track your review request, decision, and secure review thread."
     />
      <AltaCardReviewDetailView review={review} cardId={cardId} />
    </>
  );
}
