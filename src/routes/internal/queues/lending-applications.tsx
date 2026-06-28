import { createFileRoute } from "@tanstack/react-router";
import { LendingApplicationsQueueView } from "@/components/internal/queues";
import { fetchInternalLendingOps } from "@/lib/bank/lending.functions";
import { fetchApplicationRelationshipSummaries } from "@/lib/internal/relationship-intelligence.functions";

export const Route = createFileRoute("/internal/queues/lending-applications")({
  loader: async () => {
    const ops = await fetchInternalLendingOps();
    const summaries = await fetchApplicationRelationshipSummaries({
      data: ops.applications.map((a) => ({
        companyId: a.companyId,
        applicantUserId: a.applicantUserId,
      })),
    });
    return { applications: ops.applications, summaries };
  },
  head: () => ({ meta: [{ title: "Lending Applications Queue — Alta Internal" }] }),
  component: LendingApplicationsQueuePage,
});

function LendingApplicationsQueuePage() {
  const { applications, summaries } = Route.useLoaderData();
  return <LendingApplicationsQueueView applications={applications} summaries={summaries} />;
}
