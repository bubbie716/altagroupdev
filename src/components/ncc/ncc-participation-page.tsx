import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccCard, NccPageContainer, NccSectionHeader } from "@/components/ncc/ncc-ui";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { NCC_LEGAL_DOCS } from "@/lib/ncc/ncc-tokens";

export function NccParticipationPage() {
  return (
    <NccLayout>
      <NccPageContainer>
        <div className="border-b border-[#e5e7eb] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Participation</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            NCC provides clearing and settlement infrastructure to regulated financial institutions,
            payment providers, and exchanges approved under the Participation Agreement.
          </p>
        </div>

        <section className="mt-10 space-y-6">
          <NccCard>
            <h2 className="text-lg font-semibold text-[#111827]">Eligibility</h2>
            <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[#4b5563]">
              <li>• Regulated financial institution or approved payment provider</li>
              <li>• Execution of the NCC Participation Agreement</li>
              <li>• Compliance with Operating Rules and technical standards</li>
              <li>• Designated operational and compliance contacts</li>
            </ul>
          </NccCard>

          <NccCard>
            <h2 className="text-lg font-semibold text-[#111827]">Application process</h2>
            <ol className="mt-4 space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
              <li>1. Submit institution profile and regulatory documentation</li>
              <li>2. Technical connectivity and security review</li>
              <li>3. Legal execution of Participation Agreement</li>
              <li>4. Production certification and routing number assignment</li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <SiteInternalLink
                siteKey="ncc"
                to="/participation/apply"
                className="inline-flex items-center justify-center rounded-sm bg-[#0c4d32] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#083d28]"
              >
                Apply for Participation
              </SiteInternalLink>
              <SiteInternalLink
                siteKey="ncc"
                to="/participation/applications"
                className="inline-flex items-center justify-center rounded-sm border border-[#d1d5db] bg-white px-4 py-2.5 text-[13px] font-medium text-[#111827]"
              >
                Track my application
              </SiteInternalLink>
            </div>
          </NccCard>
        </section>

        <section className="mt-10">
          <NccSectionHeader title="Related documents" />
          <div className="grid gap-4 sm:grid-cols-3">
            {NCC_LEGAL_DOCS.map((doc) => (
              <SiteInternalLink key={doc.id} siteKey="ncc" to={doc.path}>
                <NccCard className="hover:border-[#0c4d32]/30">
                  <h3 className="text-[14px] font-semibold">{doc.label}</h3>
                  <p className="mt-1 font-mono text-[11px] text-[#9ca3af]">{doc.id}</p>
                </NccCard>
              </SiteInternalLink>
            ))}
          </div>
        </section>
      </NccPageContainer>
    </NccLayout>
  );
}
