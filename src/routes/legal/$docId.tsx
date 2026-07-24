import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { LegalDocMarkdown } from "@/components/governance/legal-doc-markdown";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";
import { resolveLegalDocIdFromSlug } from "@/lib/legal/legal-document-registry";
import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";
import { CorporatePageShell } from "@/components/site/corporate-page-shell";

export const Route = createFileRoute("/legal/$docId")({
  loader: async ({ params }) => {
    const direct = await getLegalDoc(params.docId);
    if (direct) return direct;

    const resolvedId = resolveLegalDocIdFromSlug(params.docId);
    if (resolvedId) {
      const resolved = await getLegalDoc(resolvedId);
      if (resolved) return resolved;
    }

    throw notFound();
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData.meta.title} — Alta Group Legal` },
      {
        name: "description",
        content: loaderData.meta.description,
      },
    ],
  }),
  component: LegalDocDetailPage,
});

function LegalDocDetailPage() {
  const { meta, body } = Route.useLoaderData();

  return (
    <CorporatePageShell>
      <FadeIn className="border-b border-border/60 pb-12">
        <Link
          to={LEGAL_CENTER_PATH}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Legal Center
        </Link>
        <div className="type-meta mt-8">{meta.id}</div>
        <h1 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
          {meta.title}
        </h1>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{meta.entity}</p>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {meta.description}
        </p>
      </FadeIn>

      <main className="py-12">
        <LegalDocMarkdown content={body} />
      </main>
    </CorporatePageShell>
  );
}
