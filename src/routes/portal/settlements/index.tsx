import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalSettlements } from "@/lib/ncc/ncc-portal.functions";
import { PortalSettlementsView } from "@/components/ncc/portal/portal-settlements-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/settlements/")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status, q: search.q }),
  loader: ({ deps }) =>
    fetchPortalSettlements({
      data: {
        status: deps.status,
        q: deps.q,
        limit: 100,
      },
    }),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Settlement History — NCC Institution Portal" }],
  }),
  component: PortalSettlementsRoute,
});

function PortalSettlementsRoute() {
  const rows = Route.useLoaderData();
  return (
    <PortalSettlementsView
      rows={rows}
      title="Settlement History"
      description="Completed and historical settlement instructions for this institution."
    />
  );
}
