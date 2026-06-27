import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { fetchAltaCardReviewThread } from "@/lib/bank/alta-card-review.functions";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";
import {
  mapAltaCardReviewThreadContextToLoan,
  mapAltaCardReviewThreadMessagesToLoan,
} from "@/lib/bank/alta-card-review-thread-adapter";

export const Route = createFileRoute(
  "/bank/alta-card/business/$companyId/review/$reviewId/thread",
)({
  loader: async ({ params }) => {
    try {
      const [{ context, messages }, companyCards] = await Promise.all([
        fetchAltaCardReviewThread({ data: params.reviewId }),
        fetchCompanyAltaCards({ data: params.companyId }),
      ]);
      const card = companyCards.businessCard;
      if (!card) {
        throw redirect({ to: "/bank/alta-card/business/$companyId", params: { companyId: params.companyId } });
      }
      return { context, messages };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Business Alta Card" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank" title="Review thread not found">
      <EmptyState
        tag="404"
        title="This secure review thread is not available"
        action={
          <Link to="/bank/alta-card/business" className="text-gold hover:underline">
            Back to business cards
          </Link>
        }
      />
    </PageShell>
  ),
  component: BusinessAltaCardReviewThreadPage,
});

function BusinessAltaCardReviewThreadPage() {
  const { context, messages } = Route.useLoaderData();
  const { companyId, reviewId } = Route.useParams();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={mapAltaCardReviewThreadContextToLoan(context)}
        messages={mapAltaCardReviewThreadMessagesToLoan(messages)}
        variant="user"
        product="alta-card-review"
        backTo="/bank/alta-card/business/$companyId/review/$reviewId"
        backParams={{ companyId, reviewId }}
        backLabel="← Account review"
      />
    </div>
  );
}
