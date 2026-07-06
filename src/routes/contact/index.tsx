import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/site/coming-soon-page";

export const Route = createFileRoute("/contact/")({
  head: () => ({
    meta: [
      { title: "Contact — Alta Group" },
      { name: "description", content: "Contact Alta Group for support, partnerships, and institutional inquiries." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <ComingSoonPage
      eyebrow="Alta Group"
      title="Contact"
      description="Official contact channels for support, partnerships, and institutional inquiries will be listed here."
    />
  );
}
