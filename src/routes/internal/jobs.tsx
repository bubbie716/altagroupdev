import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  InternalJobsPageIntro,
  InternalJobsTable,
} from "@/components/internal/jobs/internal-jobs-table";
import { fetchOpsJobs } from "@/lib/internal/ops-jobs.functions";

export const Route = createFileRoute("/internal/jobs")({
  loader: () => fetchOpsJobs(),
  head: () => ({ meta: [{ title: "System Jobs — Alta Internal" }] }),
  component: InternalJobsPage,
});

function InternalJobsPage() {
  const jobs = Route.useLoaderData();

  return (
    <InternalPageShell
      title="System Jobs"
      description="Scheduled jobs, cron runs, and admin manual batch actions."
      breadcrumbs={buildBreadcrumbs([
        { label: "System", to: "/internal/settings" },
        { label: "Jobs" },
      ])}
    >
      <InternalJobsPageIntro />
      <OpsSection title={`Jobs (${jobs.length})`}>
        <InternalJobsTable jobs={jobs} />
      </OpsSection>
    </InternalPageShell>
  );
}
