import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccAdminPage } from "@/components/ncc/ncc-admin-page";
import { authBeforeLoad } from "@/lib/auth/guards";
import {
  fetchNccControlPlaneAccess,
  fetchNccControlPlaneOverview,
} from "@/lib/ncc/ncc-control-plane.functions";
import { fetchNccMaintenanceModeSettings } from "@/lib/ncc/ncc-maintenance.functions";
import { siteFromRouteContext } from "@/lib/site/site-context";

export const Route = createFileRoute("/admin")({
  beforeLoad: (opts) => {
    if (siteFromRouteContext(opts.context).key !== "ncc") {
      throw redirect({ to: "/" });
    }
    return authBeforeLoad(opts);
  },
  loader: async () => {
    const access = await fetchNccControlPlaneAccess();
    if (!access.allowed) {
      return {
        accessDenied: true as const,
        maintenanceSettings: null,
        overview: null,
      };
    }

    const [maintenanceSettings, overview] = await Promise.all([
      fetchNccMaintenanceModeSettings(),
      fetchNccControlPlaneOverview(),
    ]);

    return {
      accessDenied: false as const,
      maintenanceSettings,
      overview,
    };
  },
  head: () => ({
    meta: [{ title: "Admin Panel — Newport Clearing Corporation" }],
  }),
  component: AdminRoutePage,
});

function AdminRoutePage() {
  const data = Route.useLoaderData();
  return (
    <NccAdminPage
      accessDenied={data.accessDenied}
      maintenanceSettings={data.maintenanceSettings}
      overview={data.overview}
    />
  );
}
