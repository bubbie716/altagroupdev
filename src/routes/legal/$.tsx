import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { resolveLegalDocIdFromSlug } from "@/lib/legal/legal-document-registry";

export const Route = createFileRoute("/legal/$")({
  beforeLoad: ({ params }) => {
    const slug = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
    if (!slug) {
      throw redirect({ to: "/governance/legaldocs", replace: true });
    }
    const docId = resolveLegalDocIdFromSlug(slug);
    if (!docId) throw notFound();
    throw redirect({
      to: "/governance/legaldocs/$docId",
      params: { docId },
      replace: true,
    });
  },
});
