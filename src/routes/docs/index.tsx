import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentation — Alta Group" },
      { name: "description", content: "Platform documentation and user guides for Alta Group." },
    ],
  }),
  component: DocumentationPage,
});

function DocumentationPage() {
  return (
    <ComingSoonPage
      eyebrow="Alta Platform"
      title="Documentation"
      description="Platform guides and product documentation will be available here."
    />
  );
}
