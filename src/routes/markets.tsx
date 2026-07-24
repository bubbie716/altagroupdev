import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveLegacyMarketsPath } from "@/lib/site/site-shortcut-routes";
import { siteFromRouteContext } from "@/lib/site/site-context";

export const Route = createFileRoute("/markets")({
  beforeLoad: ({ context }) => {
    throw redirect({ to: resolveLegacyMarketsPath(siteFromRouteContext(context).key), replace: true });
  },
});
