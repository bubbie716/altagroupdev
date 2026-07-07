import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { LegalDocMarkdown } from "@/components/governance/legal-doc-markdown";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";
import { resolveLegalDocIdFromSlug } from "@/lib/legal/legal-document-registry";
import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";
import { CorporatePageShell } from "@/components/site/corporate-page-shell";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccPageContainer } from "@/components/ncc/ncc-ui";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useSiteContext } from "@/hooks/use-site-context";

export const Route = createFileRoute("/legal/$docId")({
  loader: ({ params }) => {
    const direct = getLegalDoc(params.docId);
    if (direct) return direct;

    const resolvedId = resolveLegalDocIdFromSlug(params.docId);
    if (resolvedId) {
      const resolved = getLegalDoc(resolvedId);
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
  const site = useSiteContext();

  if (site.key === "ncc") {
    return (
      <NccLayout>
        <NccPageContainer>
          <SiteInternalLink
            siteKey="ncc"
            to="/legal"
            className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#111827]"
          >
            <ChevronLeft className="size-3.5" />
            Legal
          </SiteInternalLink>
          <div className="mt-8 border-b border-[#e5e7eb] pb-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#9ca3af]">
              {meta.id}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">{meta.title}</h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
              {meta.description}
            </p>
          </div>
          <main className="prose prose-sm max-w-none py-10 prose-headings:font-semibold prose-p:text-[#374151]">
            <LegalDocMarkdown content={body} />
          </main>
        </NccPageContainer>
      </NccLayout>
    );
  }

  return (
    <CorporatePageShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border/60 pb-12"
      >
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
      </motion.div>

      <main className="py-12">
        <LegalDocMarkdown content={body} />
      </main>
    </CorporatePageShell>
  );
}
