import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalAccount } from "@/lib/ncc/ncc-portal.functions";
import { PortalAccountsView } from "@/components/ncc/portal/portal-accounts-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/accounts")({
  loader: () => fetchPortalAccount(),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Settlement Accounts — NCC Institution Portal" }],
  }),
  component: PortalAccountsRoute,
});

function PortalAccountsRoute() {
  const account = Route.useLoaderData();
  return <PortalAccountsView account={account} />;
}
