import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalDashboard } from "@/lib/ncc/ncc-portal.functions";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalStatusBadge } from "@/components/ncc/portal/portal-status-badge";
import { PortalDashboardSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/settings")({
  loader: () => fetchPortalDashboard(),
  pendingComponent: PortalDashboardSkeleton,
  head: () => ({
    meta: [{ title: "Institution Settings — NCC Institution Portal" }],
  }),
  component: PortalSettingsRoute,
});

function PortalSettingsRoute() {
  const { metrics } = Route.useLoaderData();
  const institution = metrics.institution;

  return (
    <div>
      <PortalPageHeader
        eyebrow="Institution"
        title="Institution Settings"
        description="Read-only institution profile. Structural changes are managed by NCC operations."
      />

      <section className="rounded-sm border border-[#e5e7eb] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[16px] font-semibold text-[#111827]">{institution.displayName}</h2>
          <PortalStatusBadge status={institution.status} kind="institution" />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 text-[13px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Legal name
            </dt>
            <dd className="mt-1 text-[#111827]">{institution.legalName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Slug
            </dt>
            <dd className="mt-1 font-mono text-[12px] text-[#111827]">{institution.slug}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Institution type
            </dt>
            <dd className="mt-1 text-[#111827]">{institution.institutionType}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Primary routing
            </dt>
            <dd className="mt-1 font-mono text-[#111827]">
              {metrics.primaryRoutingNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              NCC participant
            </dt>
            <dd className="mt-1 text-[#111827]">{institution.isNCCParticipant ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Alta entity
            </dt>
            <dd className="mt-1 text-[#111827]">{institution.isAlta ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
