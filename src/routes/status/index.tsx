import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export const Route = createFileRoute("/status/")({
  head: () => ({
    meta: [
      { title: "System Status — Alta Group" },
      { name: "description", content: "Operational status for Alta Bank, Alta Exchange, and platform services." },
    ],
  }),
  component: SystemStatusPage,
});

function SystemStatusPage() {
  return (
    <ComingSoonPage
      eyebrow="Alta Operations"
      title="System Status"
      description="Real-time service health and incident updates for Alta platform divisions will be published here."
    />
  );
}
