import { createFileRoute, notFound } from "@tanstack/react-router";
import { AltaCardReviewWorkspaceView } from "@/components/internal/workspace";
import {
  fetchInternalAltaCardReviewDetail,
  fetchInternalAltaCardReviewThread,
} from "@/lib/bank/alta-card-review.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { parseCardReviewSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/")({
  validateSearch: (search: Record<string, unknown>) => parseCardReviewSearch(search),
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
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Card Review", (match.search as { site?: string }).site) }] }),
  component: AltaCardReviewWorkspaceRoute,
});

function AltaCardReviewWorkspaceRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return <AltaCardReviewWorkspaceView {...data} search={search} />;
}
