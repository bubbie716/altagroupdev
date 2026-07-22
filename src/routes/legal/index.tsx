import { createFileRoute } from "@tanstack/react-router";
import { useSiteContext } from "@/hooks/use-site-context";
import { LegalDocCard } from "@/components/governance/legal-doc-card";
import { CorporatePageShell } from "@/components/site/corporate-page-shell";
import { NccLegalPage } from "@/components/ncc/ncc-legal-page";
import { Section } from "@/components/page-shell";
import { getLegalDocCategoriesForSite, getLegalDocsByCategoryForSite } from "@/lib/site/site-scoped-content";

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [{ title: "Legal — Alta Group" }],
  }),
  component: LegalIndexPage,
});

function LegalIndexPage() {
  const site = useSiteContext();

  if (site.key === "ncc") {
    return <NccLegalPage />;
  }

  const categories = getLegalDocCategoriesForSite(site.key);
  const docsByCategory = getLegalDocsByCategoryForSite(site.key);

  return (
    <CorporatePageShell>
      <div className="border-b border-border/60 pb-12">
        <div className="type-eyebrow">Legal</div>
        <h1 className="mt-5 text-[clamp(3.25rem,6vw,5rem)] font-semibold leading-[0.96] tracking-[-0.02em]">
          Legal Documents
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {site.key === "corporate"
            ? "Published corporate governance, platform policies, subsidiary agreements, fee schedules, and product terms across the Alta Group portfolio."
            : `Published corporate governance, platform policies, subsidiary agreements, fee schedules, and product terms for ${site.displayName} and Alta Group.`}
        </p>
      </div>

      <main className="py-12">
        {categories.map((category, index) => {
          const docs = docsByCategory[category] ?? [];
          if (docs.length === 0) return null;

          return (
            <Section key={category} title={category} className={index > 0 ? "mt-12" : undefined}>
              <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {docs.map((doc) => (
                  <LegalDocCard key={doc.id} doc={doc} />
                ))}
              </div>
            </Section>
          );
        })}
      </main>
    </CorporatePageShell>
  );
}
