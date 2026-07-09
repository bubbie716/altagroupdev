import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveLegacyMarketsPath } from "@/lib/site/site-shortcut-routes";

export const Route = createFileRoute("/markets")({
  beforeLoad: ({ context }) => {
    throw redirect({ to: resolveLegacyMarketsPath(context.site.key), replace: true });
  },
});
