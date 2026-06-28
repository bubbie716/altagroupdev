import { createFileRoute } from "@tanstack/react-router";
import { LoanWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchInternalLoanDetailOps, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { fetchLoanBorrowerRelationshipSummary, fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";

const TABS = ["overview", "payments", "schedule", "deal-room", "relationship", "activity", "notes"];

export const Route = createFileRoute("/internal/lending/loans/$loanId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
  loader: async ({ params }) => {
    const [loan, notes, timeline, relationship] = await Promise.all([
      fetchInternalLoanDetailOps({ data: params.loanId }),
      fetchInternalNotes({ data: { targetType: "LOAN", targetId: params.loanId } }),
      fetchActivityTimeline({ data: { entityType: "LOAN", entityId: params.loanId } }),
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
  head: ({ loaderData }) => ({
    meta: [{ title: `Loan · ${loaderData?.loan.borrowerLabel ?? "Servicing"} — Alta Internal` }],
  }),
  component: LoanWorkspaceRoute,
});

function LoanWorkspaceRoute() {
  const { loan, notes, timeline, relationship, integration } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  return (
    <LoanWorkspaceView
      loan={loan}
      notes={notes}
      timeline={timeline}
      relationship={relationship}
      integration={integration}
      activeTab={tab}
    />
  );
}
