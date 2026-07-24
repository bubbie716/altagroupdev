import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { resolveLegacyDashboardPath } from "@/lib/site/site-shortcut-routes";
import { siteFromRouteContext } from "@/lib/site/site-context";

/** Legacy NCC /dashboard shortcut → institution portal. */
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: (opts) => {
    const siteKey = siteFromRouteContext(opts.context).key;
    if (siteKey !== "ncc") {
      throw redirect({ to: resolveLegacyDashboardPath(siteKey), replace: true });
    }
    authBeforeLoad(opts);
    throw redirect({ to: "/portal", replace: true });
  },
  component: () => null,
});
