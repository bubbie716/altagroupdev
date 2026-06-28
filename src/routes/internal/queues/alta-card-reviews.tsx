import { createFileRoute } from "@tanstack/react-router";
import { AltaCardReviewsQueueView } from "@/components/internal/queues";
import { fetchInternalAltaCardReviewQueue } from "@/lib/bank/alta-card-review.functions";
import { fetchApplicationRelationshipSummaries } from "@/lib/internal/relationship-intelligence.functions";

export const Route = createFileRoute("/internal/queues/alta-card-reviews")({
  loader: async () => {
    const reviews = await fetchInternalAltaCardReviewQueue();
    const summaries = await fetchApplicationRelationshipSummaries({
      data: reviews.map((r) => ({
        companyId: r.companyId,
        applicantUserId: r.applicantUserId,
      })),
    });
    return { reviews, summaries };
  },
  head: () => ({ meta: [{ title: "Alta Card Reviews Queue — Alta Internal" }] }),
  component: AltaCardReviewsQueuePage,
});

function AltaCardReviewsQueuePage() {
  const { reviews, summaries } = Route.useLoaderData();
  return <AltaCardReviewsQueueView reviews={reviews} summaries={summaries} />;
}
