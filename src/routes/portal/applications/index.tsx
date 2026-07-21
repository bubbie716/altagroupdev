import { createFileRoute, Link } from "@tanstack/react-router";
import { listStaffParticipantApplications } from "@/lib/ncc/ncc-participant-application.functions";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";

export const Route = createFileRoute("/portal/applications/")({
  beforeLoad: async () => {
    const { requireNccStaffAccess } = await import(
      "@/lib/ncc/ncc-participant-application.functions"
    );
    await requireNccStaffAccess();
  },
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ deps }) =>
    listStaffParticipantApplications({
      data: deps.status ? { status: deps.status as never } : {},
    }),
  head: () => ({
    meta: [{ title: "Participant Applications — NCC Institution Portal" }],
  }),
  component: StaffApplicationsRoute,
});

function StaffApplicationsRoute() {
  const rows = Route.useLoaderData();
  return (
    <div>
      <PortalPageHeader
        eyebrow="Staff"
        title="Participant applications"
        description="Review onboarding applications and approve institutions for TEST access."
      />
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-[13px] text-[#6b7280]">No applications in queue.</p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              to="/portal/applications/$id"
              params={{ id: row.id }}
              className="block rounded-sm border border-[#e5e7eb] bg-white p-4 text-[13px] hover:border-[#0c4d32]/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#111827]">{row.displayName}</div>
                  <div className="font-mono text-[11px] text-[#9ca3af]">{row.publicReference}</div>
                </div>
                <div className="font-medium text-[#0c4d32]">{row.status.replace(/_/g, " ")}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
