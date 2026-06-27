import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { fetchInternalAltaCardReviewThread } from "@/lib/bank/alta-card-review.functions";
import {
  mapAltaCardReviewThreadContextToLoan,
  mapAltaCardReviewThreadMessagesToLoan,
} from "@/lib/bank/alta-card-review-thread-adapter";

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/thread")({
  loader: async ({ params }) => {
    try {
      return await fetchInternalAltaCardReviewThread({ data: params.reviewId });
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Internal" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Internal" title="Review thread not found">
      <EmptyState
        tag="404"
        title="This secure review thread is not available"
        action={
          <Link to="/internal/alta-card/reviews" className="text-gold hover:underline">
            Back to reviews
          </Link>
        }
      />
    </PageShell>
  ),
  component: InternalAltaCardReviewThreadPage,
});

function InternalAltaCardReviewThreadPage() {
  const { context, messages } = Route.useLoaderData();
  const { reviewId } = Route.useParams();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={mapAltaCardReviewThreadContextToLoan(context)}
        messages={mapAltaCardReviewThreadMessagesToLoan(messages)}
        variant="internal"
        product="alta-card-review"
        backTo="/internal/alta-card/reviews/$reviewId"
        backParams={{ reviewId }}
        backLabel="← Review detail"
      />
    </div>
  );
}
