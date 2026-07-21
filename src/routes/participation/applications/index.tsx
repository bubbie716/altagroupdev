import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccPageContainer } from "@/components/ncc/ncc-ui";
import { listMyParticipantApplications } from "@/lib/ncc/ncc-participant-application.functions";

export const Route = createFileRoute("/participation/applications/")({
  beforeLoad: async () => {
    const { fetchCurrentUser } = await import("@/lib/auth/auth.functions");
    const user = await fetchCurrentUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: "/participation/applications" },
      });
    }
  },
  loader: () => listMyParticipantApplications(),
  head: () => ({
    meta: [{ title: "My Applications — Newport Clearing Corporation" }],
  }),
  component: MyApplicationsRoute,
});

function MyApplicationsRoute() {
  const rows = Route.useLoaderData();
  return (
    <NccLayout>
      <NccPageContainer>
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-[#e5e7eb] pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#111827]">My applications</h1>
            <p className="mt-1 text-[14px] text-[#6b7280]">Track status and respond to reviewer requests.</p>
          </div>
          <Link
            to="/participation/apply"
            className="rounded-sm bg-[#0c4d32] px-3 py-2 text-[13px] font-medium text-white"
          >
            New application
          </Link>
        </div>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[#6b7280]">No applications yet.</p>
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to="/participation/applications/$id"
                params={{ id: row.id }}
                className="block rounded-sm border border-[#e5e7eb] bg-white p-4 hover:border-[#0c4d32]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold text-[#111827]">{row.displayName}</div>
                    <div className="font-mono text-[11px] text-[#9ca3af]">{row.publicReference}</div>
                  </div>
                  <div className="text-[12px] font-medium text-[#0c4d32]">
                    {row.status.replace(/_/g, " ")}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </NccPageContainer>
    </NccLayout>
  );
}
