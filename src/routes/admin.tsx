import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccAdminPage } from "@/components/ncc/ncc-admin-page";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchNccMaintenanceModeSettings } from "@/lib/ncc/ncc-maintenance.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: (opts) => {
    if (opts.context.site.key !== "ncc") {
      throw redirect({ to: "/" });
    }
    return authBeforeLoad(opts);
  },
  loader: () => fetchNccMaintenanceModeSettings(),
  head: () => ({
    meta: [{ title: "Admin Panel — Newport Clearing Corporation" }],
  }),
  component: AdminRoutePage,
});

function AdminRoutePage() {
  const maintenanceSettings = Route.useLoaderData();
  return <NccAdminPage maintenanceSettings={maintenanceSettings} />;
}
