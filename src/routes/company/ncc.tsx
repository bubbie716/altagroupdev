import { createFileRoute, redirect } from "@tanstack/react-router";
import { siteFromRouteContext } from "@/lib/site/site-context";

export const Route = createFileRoute("/company/ncc")({
  beforeLoad: ({ context }) => {
    if (siteFromRouteContext(context).key === "ncc") {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  head: () => ({
    meta: [{ title: "NCC — Newport Clearing Corporation" }],
  }),
  component: LegacyNccRedirectPage,
});

function LegacyNccRedirectPage() {
  return null;
}
