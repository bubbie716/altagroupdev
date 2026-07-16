import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalRouting } from "@/lib/ncc/ncc-portal.functions";
import { PortalRoutingView } from "@/components/ncc/portal/portal-routing-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/routing")({
  loader: () => fetchPortalRouting(),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Routing Numbers — NCC Institution Portal" }],
  }),
  component: PortalRoutingRoute,
});

function PortalRoutingRoute() {
  const rows = Route.useLoaderData();
  return <PortalRoutingView rows={rows} />;
}
