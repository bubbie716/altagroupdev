import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalAudit } from "@/lib/ncc/ncc-portal.functions";
import { PortalAuditView } from "@/components/ncc/portal/portal-audit-view";
import { PortalTableSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => fetchPortalAudit({ data: { q: deps.q, limit: 100 } }),
  pendingComponent: PortalTableSkeleton,
  head: () => ({
    meta: [{ title: "Audit Log — NCC Institution Portal" }],
  }),
  component: PortalAuditRoute,
});

function PortalAuditRoute() {
  const rows = Route.useLoaderData();
  return <PortalAuditView rows={rows} />;
}
