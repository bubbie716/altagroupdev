import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccDashboardPage } from "@/components/ncc/ncc-dashboard-page";
import { authBeforeLoad } from "@/lib/auth/guards";
import { resolveLegacyDashboardPath } from "@/lib/site/site-shortcut-routes";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: (opts) => {
    if (opts.context.site.key !== "ncc") {
      throw redirect({ to: resolveLegacyDashboardPath(opts.context.site.key), replace: true });
    }
    return authBeforeLoad(opts);
  },
  head: () => ({
    meta: [{ title: "Operations Console — Newport Clearing Corporation" }],
  }),
  component: NccDashboardPage,
});
