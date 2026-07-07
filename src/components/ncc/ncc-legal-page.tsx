import { SiteInternalLink } from "@/components/site/site-internal-link";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccCard, NccPageContainer, NccSectionHeader } from "@/components/ncc/ncc-ui";
import {
  getLegalDocCategoriesForSite,
  getLegalDocsByCategoryForSite,
} from "@/lib/site/site-scoped-content";

export function NccLegalPage() {
  const categories = getLegalDocCategoriesForSite("ncc");
  const docsByCategory = getLegalDocsByCategoryForSite("ncc");

  return (
    <NccLayout>
      <NccPageContainer>
        <div className="border-b border-[#e5e7eb] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Legal</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Published participation agreements, operating rules, and platform policies for Newport
            Clearing Corporation and Alta Group.
          </p>
        </div>

        {categories.map((category) => {
          const docs = docsByCategory[category] ?? [];
          if (docs.length === 0) return null;

          return (
            <section key={category} className="mt-10">
              <NccSectionHeader title={category} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map((doc) => (
                  <SiteInternalLink key={doc.id} siteKey="ncc" to={`/legal/${doc.id}`}>
                    <NccCard className="h-full transition-colors hover:border-[#0c4d32]/30">
                      <h3 className="text-[15px] font-semibold text-[#111827]">{doc.title}</h3>
                      <p className="mt-2 font-mono text-[11px] text-[#9ca3af]">{doc.id}</p>
                      <p className="mt-4 text-[13px] text-[#0c4d32]">View document →</p>
                    </NccCard>
                  </SiteInternalLink>
                ))}
              </div>
            </section>
          );
        })}
      </NccPageContainer>
    </NccLayout>
  );
}
