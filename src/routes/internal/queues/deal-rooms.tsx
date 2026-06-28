import { createFileRoute } from "@tanstack/react-router";
import { DealRoomsInboxView, buildDealRoomInboxRows } from "@/components/internal/queues";
import { fetchInternalLendingOps } from "@/lib/bank/lending.functions";
import { fetchInternalAltaCardApplicationsFiltered } from "@/lib/bank/alta-card-application.functions";
import { fetchInternalAltaCardReviewQueue } from "@/lib/bank/alta-card-review.functions";

export const Route = createFileRoute("/internal/queues/deal-rooms")({
  loader: async () => {
    const [lendingOps, altaCardApplications, altaCardReviews] = await Promise.all([
      fetchInternalLendingOps(),
      fetchInternalAltaCardApplicationsFiltered({ data: {} }),
      fetchInternalAltaCardReviewQueue(),
    ]);
    return buildDealRoomInboxRows({
      lendingApplications: lendingOps.applications,
      altaCardApplications,
      altaCardReviews,
    });
  },
  head: () => ({ meta: [{ title: "Deal Room Inbox — Alta Internal" }] }),
  component: DealRoomsQueuePage,
});

function DealRoomsQueuePage() {
  const rows = Route.useLoaderData();
  return <DealRoomsInboxView rows={rows} />;
}
