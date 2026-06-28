import { createFileRoute } from "@tanstack/react-router";
import { AltaCardApplicationsQueueView } from "@/components/internal/queues";
import { fetchInternalAltaCardApplicationsFiltered } from "@/lib/bank/alta-card-application.functions";
import { fetchApplicationRelationshipSummaries } from "@/lib/internal/relationship-intelligence.functions";

export const Route = createFileRoute("/internal/queues/alta-card-applications")({
  loader: async () => {
    const applications = await fetchInternalAltaCardApplicationsFiltered({ data: {} });
    const summaries = await fetchApplicationRelationshipSummaries({
      data: applications.map((a) => ({
        companyId: a.companyId,
        applicantUserId: a.applicantUserId,
      })),
    });
    return { applications, summaries };
  },
  head: () => ({ meta: [{ title: "Alta Card Applications Queue — Alta Internal" }] }),
  component: AltaCardApplicationsQueuePage,
});

function AltaCardApplicationsQueuePage() {
  const { applications, summaries } = Route.useLoaderData();
  return <AltaCardApplicationsQueueView applications={applications} summaries={summaries} />;
}
