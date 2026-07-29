import { createFileRoute } from "@tanstack/react-router";
import { LoanWorkspaceView } from "@/components/internal/workspace";
import { fetchInternalLoanDetailOps, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import {
  fetchLoanBorrowerRelationshipSummary,
  fetchResolvedRelationshipIntegrationBestEffort,
} from "@/lib/internal/relationship-intelligence.functions";
import { parseLoanWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/lending/loans/$loanId")({
  validateSearch: (search: Record<string, unknown>) => parseLoanWorkspaceSearch(search),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    section: search.section,
    filter: search.filter,
  }),
  loader: async ({ params, deps }) => {
    const includeNotes = deps.tab === "more" || deps.section === "notes";
    const includeTimeline = deps.tab === "overview" || deps.tab === "activity";
    const [loan, notes, timeline, relationship] = await Promise.all([
      fetchInternalLoanDetailOps({ data: params.loanId }),
      includeNotes
        ? fetchInternalNotes({ data: { targetType: "LOAN", targetId: params.loanId } })
        : Promise.resolve([]),
      includeTimeline
        ? fetchActivityTimeline({ data: { entityType: "LOAN", entityId: params.loanId } })
        : Promise.resolve([]),
      fetchLoanBorrowerRelationshipSummary({ data: params.loanId }),
    ]);
    const integration = relationship.userId
      ? await fetchResolvedRelationshipIntegrationBestEffort({
          userId: relationship.userId,
          companyId: relationship.companyId,
          context: "LENDING",
        })
      : null;
    return { loan, notes, timeline, relationship, integration };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`Loan · ${loaderData?.loan.borrowerLabel ?? "Servicing"}`, (match.search as { site?: string }).site) }],
  }),
  component: LoanWorkspaceRoute,
});

function LoanWorkspaceRoute() {
  const { loan, notes, timeline, relationship, integration } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <LoanWorkspaceView
      loan={loan}
      notes={notes}
      timeline={timeline}
      relationship={relationship}
      integration={integration}
      search={search}
    />
  );
}
