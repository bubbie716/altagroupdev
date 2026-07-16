import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalDashboard } from "@/lib/ncc/ncc-portal.functions";
import { PortalDashboardView } from "@/components/ncc/portal/portal-dashboard-view";
import { PortalDashboardSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/")({
  loader: () => fetchPortalDashboard(),
  pendingComponent: PortalDashboardSkeleton,
  head: () => ({
    meta: [{ title: "Dashboard — NCC Institution Portal" }],
  }),
  component: PortalDashboardRoute,
});

function PortalDashboardRoute() {
  const data = Route.useLoaderData();
  return (
    <PortalDashboardView
      metrics={data.metrics}
      alerts={data.alerts}
      recentSettlements={data.recentSettlements}
      recentAudit={data.recentAudit}
    />
  );
}
