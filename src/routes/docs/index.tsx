import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentation — Alta Group" },
      { name: "description", content: "Developer documentation and user guides for the Alta platform." },
    ],
  }),
  component: DocumentationPage,
});

function DocumentationPage() {
  return (
    <ComingSoonPage
      eyebrow="Alta Platform"
      title="Documentation"
      description="Developer API references, integration guides, and user documentation will be available here."
    />
  );
}
