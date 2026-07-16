import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalReports } from "@/lib/ncc/ncc-portal.functions";
import { PortalReportsView } from "@/components/ncc/portal/portal-reports-view";
import { PortalDashboardSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/reports")({
  loader: () => fetchPortalReports(),
  pendingComponent: PortalDashboardSkeleton,
  head: () => ({
    meta: [{ title: "Reports — NCC Institution Portal" }],
  }),
  component: PortalReportsRoute,
});

function PortalReportsRoute() {
  const metrics = Route.useLoaderData();
  return <PortalReportsView metrics={metrics} />;
}
