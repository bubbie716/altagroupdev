import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalMembers } from "@/lib/ncc/ncc-portal.functions";
import { PortalMembersView } from "@/components/ncc/portal/portal-members-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/members")({
  loader: () => fetchPortalMembers(),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Institution Members — NCC Institution Portal" }],
  }),
  component: PortalMembersRoute,
});

function PortalMembersRoute() {
  const rows = Route.useLoaderData();
  return <PortalMembersView rows={rows} />;
}
