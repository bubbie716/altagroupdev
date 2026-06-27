import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { fetchAltaCardReviewDetail, fetchAltaCardReviewThread } from "@/lib/bank/alta-card-review.functions";
import {
  mapAltaCardReviewThreadContextToLoan,
  mapAltaCardReviewThreadMessagesToLoan,
} from "@/lib/bank/alta-card-review-thread-adapter";

export const Route = createFileRoute("/bank/alta-card/$cardId/review/$reviewId/thread")({
  loader: async ({ params }) => {
    try {
      const review = await fetchAltaCardReviewDetail({ data: params.reviewId });
      if (review.cardType === "business" && review.companyId) {
        throw redirect({
          to: "/bank/alta-card/business/$companyId/review/$reviewId/thread",
          params: { companyId: review.companyId, reviewId: params.reviewId },
        });
      }
      return await fetchAltaCardReviewThread({ data: params.reviewId });
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Card" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank" title="Review thread not found">
      <EmptyState
        tag="404"
        title="This secure review thread is not available"
        action={
          <Link to="/bank/alta-card" className="text-gold hover:underline">
            Back to Alta Card
          </Link>
        }
      />
    </PageShell>
  ),
  component: AltaCardReviewThreadPage,
});

function AltaCardReviewThreadPage() {
  const { context, messages } = Route.useLoaderData();
  const { cardId, reviewId } = Route.useParams();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={mapAltaCardReviewThreadContextToLoan(context)}
        messages={mapAltaCardReviewThreadMessagesToLoan(messages)}
        variant="user"
        product="alta-card-review"
        backTo="/bank/alta-card/$cardId/review/$reviewId"
        backParams={{ cardId, reviewId }}
        backLabel="← Account review"
      />
    </div>
  );
}
