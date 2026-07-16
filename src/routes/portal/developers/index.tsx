import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";

export const Route = createFileRoute("/portal/developers/")({
  head: () => ({
    meta: [{ title: "Developers — NCC Institution Portal" }],
  }),
  component: DevelopersOverviewRoute,
});

function DevelopersOverviewRoute() {
  const links = [
    {
      to: "/portal/developers/api-credentials" as const,
      title: "API Credentials",
      body: "Create, rotate, and revoke machine credentials for the NCC Institution API.",
    },
    {
      to: "/portal/developers/webhooks" as const,
      title: "Webhooks",
      body: "Manage signed webhook endpoints, delivery history, and test events.",
    },
    {
      to: "/portal/developers/api-logs" as const,
      title: "API Logs",
      body: "Inspect sanitized request logs for your institution.",
    },
    {
      to: "/portal/developers/documentation" as const,
      title: "Documentation",
      body: "Authentication, settlement submission, signatures, and error codes.",
    },
  ];

  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="Institution API"
        description="Secure machine access to real-time NCC settlement. Credentials never leave this portal after creation."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm hover:border-[#0c4d32]/40"
          >
            <div className="text-[14px] font-semibold text-[#111827]">{link.title}</div>
            <p className="mt-1 text-[12px] text-[#6b7280]">{link.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
