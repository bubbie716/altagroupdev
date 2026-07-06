import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export const Route = createFileRoute("/company/ncc")({
  head: () => ({
    meta: [
      { title: "NCC — Newport Clearing Corporation" },
      {
        name: "description",
        content:
          "Newport Clearing Corporation — roleplay and virtual economy clearing and settlement infrastructure.",
      },
    ],
  }),
  component: NccCompanyPage,
});

function NccCompanyPage() {
  return (
    <ComingSoonPage
      eyebrow="Newport Clearing Corporation"
      title="NCC"
      description="Clearing and settlement infrastructure for approved Alta institutions. Institution dashboards and connectivity tools are rolling out to participants."
    />
  );
}
