import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/company/ncc")({
  beforeLoad: ({ context }) => {
    if (context.site.key === "ncc") {
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
