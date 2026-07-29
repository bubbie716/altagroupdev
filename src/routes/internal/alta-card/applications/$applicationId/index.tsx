import { createFileRoute, notFound } from "@tanstack/react-router";
import { AltaCardApplicationWorkspaceView } from "@/components/internal/workspace";
import { fetchInternalAltaCardApplicationDetail } from "@/lib/bank/alta-card-application.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { parseCardApplicationSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/alta-card/applications/$applicationId/")({
  validateSearch: (search: Record<string, unknown>) => parseCardApplicationSearch(search),
  loader: async ({ params }) => {
    try {
      const review = await fetchInternalAltaCardApplicationDetail({ data: params.applicationId });
      const [integration, auditLogs, notes] = await Promise.all([
        fetchResolvedRelationshipIntegrationBestEffort({
          userId: review.application.applicantUserId,
          companyId: review.application.companyId,
          context: "ALTA_CARD",
        }),
        fetchAuditLogsForEntity({
          data: { entityType: "ALTA_CARD", entityId: params.applicationId },
        }).catch(() => []),
        fetchInternalNotes({
          data: { targetType: "USER", targetId: review.application.applicantUserId },
        }).catch(() => []),
      ]);
      return { review, integration, auditLogs, notes };
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Card Application", (match.search as { site?: string }).site) }] }),
  component: AltaCardApplicationWorkspaceRoute,
});

function AltaCardApplicationWorkspaceRoute() {
  const { review, integration, auditLogs, notes } = Route.useLoaderData();
  const { applicationId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <AltaCardApplicationWorkspaceView
      review={review}
      integration={integration}
      auditLogs={auditLogs}
      notes={notes}
      applicationId={applicationId}
      search={search}
    />
  );
}
