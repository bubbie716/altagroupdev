import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchPortalShell } from "@/lib/ncc/ncc-portal.functions";
import { PortalShell } from "@/components/ncc/portal/portal-shell";

export const Route = createFileRoute("/portal")({
  beforeLoad: (opts) => {
    if (opts.context.site.key !== "ncc") {
      throw redirect({ to: "/" });
    }
    return authBeforeLoad(opts);
  },
  loader: () => fetchPortalShell(),
  staleTime: 30_000,
  head: () => ({
    meta: [{ title: "Institution Portal — Newport Clearing Corporation" }],
  }),
  component: PortalLayoutRoute,
});

function PortalLayoutRoute() {
  const { institution, notifications, institutions } = Route.useLoaderData();
  return (
    <PortalShell institution={institution} notifications={notifications} institutions={institutions}>
      <Outlet />
    </PortalShell>
  );
}
