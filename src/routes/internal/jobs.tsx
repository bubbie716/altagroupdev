import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  InternalJobsPageIntro,
  InternalJobsPanel,
} from "@/components/internal/jobs/internal-jobs-table";
import { fetchOpsJobs } from "@/lib/internal/ops-jobs.functions";
import { useSiteContext } from "@/hooks/use-site-context";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/jobs")({
  loader: () => fetchOpsJobs(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Jobs", (match.search as { site?: string }).site) }] }),
  component: InternalJobsPage,
});

function InternalJobsPage() {
  const jobs = Route.useLoaderData();
  const site = useSiteContext();
  const settingsTo =
    site.key === "bank" ? ("/internal/bank/settings" as const) : ("/internal/settings" as const);

  return (
    <InternalPageShell
      title="Jobs"
      description="Problems first — open a job for run history, errors, and manual controls."
      breadcrumbs={buildBreadcrumbs([
        { label: "System", to: settingsTo, search: withInternalSiteSearch({}, site.key) },
        { label: "Jobs" },
      ])}
    >
      <InternalJobsPageIntro />
      <InternalJobsPanel jobs={jobs} />
    </InternalPageShell>
  );
}
