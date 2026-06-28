import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import {
  LendingApplicationWorkspaceView,
  parseWorkspaceTab,
} from "@/components/internal/workspace";
import { fetchInternalLoanApplicationDetail } from "@/lib/bank/lending.functions";
import { fetchInternalLoanApplicationThread } from "@/lib/bank/loan-application-thread.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";

const TABS = ["overview", "thread", "decision", "audit", "notes"];

export const Route = createFileRoute("/internal/lending/applications/$applicationId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
  loader: async ({ params }) => {
    try {
      const [application, threadData, auditLogs] = await Promise.all([
        fetchInternalLoanApplicationDetail({ data: params.applicationId }),
        fetchInternalLoanApplicationThread({ data: params.applicationId }),
        fetchAuditLogsForEntity({
          data: { entityType: "LOAN_APPLICATION", entityId: params.applicationId },
        }).catch(() => []),
      ]);
      const [integration, notes] = await Promise.all([
        fetchResolvedRelationshipIntegrationBestEffort({
          userId: application.applicantUserId,
          companyId: application.companyId,
          context: "LENDING",
        }),
        fetchInternalNotes({
          data: { targetType: "USER", targetId: application.applicantUserId },
        }).catch(() => []),
      ]);
      return {
        application,
        threadContext: threadData.context,
        threadMessages: threadData.messages,
        integration,
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
  head: () => ({ meta: [{ title: "Lending Application — Alta Internal" }] }),
  component: LendingApplicationWorkspaceRoute,
});

function LendingApplicationWorkspaceRoute() {
  const data = Route.useLoaderData();
  const { applicationId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <LendingApplicationWorkspaceView
      {...data}
      applicationId={applicationId}
      activeTab={search.tab}
    />
  );
}
