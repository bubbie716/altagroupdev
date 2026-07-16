import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { resolveLegacyDashboardPath } from "@/lib/site/site-shortcut-routes";

/** Legacy NCC /dashboard shortcut → institution portal. */
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: (opts) => {
    if (opts.context.site.key !== "ncc") {
      throw redirect({ to: resolveLegacyDashboardPath(opts.context.site.key), replace: true });
    }
    authBeforeLoad(opts);
    throw redirect({ to: "/portal", replace: true });
  },
  component: () => null,
});
