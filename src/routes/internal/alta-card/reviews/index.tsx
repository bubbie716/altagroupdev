import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { fetchInternalAltaCardReviewQueue } from "@/lib/bank/alta-card-review.functions";
import { reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";

export const Route = createFileRoute("/internal/alta-card/reviews/")({
  loader: async () => {
    const reviews = await fetchInternalAltaCardReviewQueue();
    return { reviews };
  },
  head: () => ({ meta: [{ title: "Alta Card Reviews — Alta Internal" }] }),
  component: InternalAltaCardReviewsQueue,
});

function InternalAltaCardReviewsQueue() {
  const { reviews } = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Account reviews"
      description="Relationship review queue for existing Alta Card holders."
    >
      <Link
        to="/internal/alta-card"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Alta Card ops
      </Link>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[800px] text-left text-[13px]">
          <thead className="border-b border-border bg-surface-2/50 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Current tier</th>
              <th className="px-4 py-3">Requested changes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No account reviews yet.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="border-b border-border/60 hover:bg-surface-2/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/internal/alta-card/reviews/$reviewId"
                      params={{ reviewId: review.id }}
                      className="font-medium hover:text-gold"
                    >
                      {review.applicantUsername}
                    </Link>
                    {review.companyName ? (
                      <p className="text-[12px] text-muted-foreground">{review.companyName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono">····{review.cardLastFour}</td>
                  <td className="px-4 py-3 capitalize">{review.currentTier}</td>
                  <td className="px-4 py-3 text-[12px]">{review.requestedChangesSummary}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={reviewDisplayStatusLabel(review, "internal")} />
                  </td>
                  <td className="px-4 py-3">{review.createdAtLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </InternalPageShell>
  );
}
