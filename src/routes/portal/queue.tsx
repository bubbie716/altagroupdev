import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalSettlements } from "@/lib/ncc/ncc-portal.functions";
import { PortalSettlementsView } from "@/components/ncc/portal/portal-settlements-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/queue")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status, q: search.q }),
  loader: ({ deps }) =>
    fetchPortalSettlements({
      data: {
        queueOnly: !deps.status,
        status: deps.status,
        q: deps.q,
        limit: 100,
      },
    }),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Processing & Exceptions — NCC Institution Portal" }],
  }),
  component: PortalQueueRoute,
});

function PortalQueueRoute() {
  const rows = Route.useLoaderData();
  return (
    <PortalSettlementsView
      rows={rows}
      queueMode
      title="Processing & Exceptions"
      description="In-flight real-time settlements, retries, failures, and manual-review exceptions. Completed settlements appear in Settlement History."
    />
  );
}
