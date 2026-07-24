import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveLegacyDashboardPath } from "@/lib/site/site-shortcut-routes";
import { siteFromRouteContext } from "@/lib/site/site-context";

/** Legacy /dashboard shortcut → each site's primary authenticated destination. */
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: (opts) => {
    const siteKey = siteFromRouteContext(opts.context).key;
    throw redirect({ to: resolveLegacyDashboardPath(siteKey), replace: true });
  },
  component: () => null,
});
