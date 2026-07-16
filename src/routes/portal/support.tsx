import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";

export const Route = createFileRoute("/portal/support")({
  head: () => ({
    meta: [{ title: "Support — NCC Institution Portal" }],
  }),
  component: PortalSupportRoute,
});

function PortalSupportRoute() {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Assistance"
        title="Support"
        description="Operational support channels for approved financial institutions."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-semibold text-[#111827]">Operations desk</h2>
          <p className="mt-2 text-[13px] text-[#6b7280]">
            For settlement failures, routing status, and institution restrictions, contact the NCC
            operations desk through your designated institutional channel.
          </p>
          <Link
            to="/support"
            className="mt-4 inline-flex rounded-sm border border-[#0c4d32] bg-[#0c4d32] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a3f29]"
          >
            Open support center
          </Link>
        </section>

        <section className="rounded-sm border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-semibold text-[#111827]">Documentation</h2>
          <p className="mt-2 text-[13px] text-[#6b7280]">
            Review participation standards, settlement lifecycle guidance, and network operating
            procedures before escalating operational issues.
          </p>
          <Link
            to="/participation"
            className="mt-4 inline-flex rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            Participation standards
          </Link>
        </section>
      </div>
    </div>
  );
}
