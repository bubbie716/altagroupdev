import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  AltaCardReviewWorkspaceView,
  parseWorkspaceTab,
} from "@/components/internal/workspace";
import {
  fetchInternalAltaCardReviewDetail,
  fetchInternalAltaCardReviewThread,
} from "@/lib/bank/alta-card-review.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";

const TABS = ["overview", "thread", "decision", "audit", "notes"];

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
  loader: async ({ params }) => {
    try {
      const detail = await fetchInternalAltaCardReviewDetail({ data: params.reviewId });
      const [threadData, integration, auditLogs, notes] = await Promise.all([
        fetchInternalAltaCardReviewThread({ data: params.reviewId }),
        fetchResolvedRelationshipIntegrationBestEffort({
          userId: detail.review.applicantUserId,
          companyId: detail.review.companyId,
          context: "ALTA_CARD",
        }),
        fetchAuditLogsForEntity({
          data: { entityType: "ALTA_CARD", entityId: detail.review.altaCardId },
        }).catch(() => []),
        fetchInternalNotes({
          data: { targetType: "USER", targetId: detail.review.applicantUserId },
        }).catch(() => []),
      ]);
      return {
        detail,
        reviewId: params.reviewId,
        integration,
        threadContext: threadData.context,
        threadMessages: threadData.messages,
        auditLogs,
        notes,
      };
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Alta Card Review — Alta Internal" }] }),
  component: AltaCardReviewWorkspaceRoute,
});

function AltaCardReviewWorkspaceRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return <AltaCardReviewWorkspaceView {...data} activeTab={search.tab} />;
}
