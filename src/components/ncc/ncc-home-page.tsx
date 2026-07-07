import { SiteInternalLink } from "@/components/site/site-internal-link";
import { NccLayout } from "@/components/ncc/ncc-layout";
import {
  NccBadge,
  NccButton,
  NccCard,
  NccHero,
  NccPageContainer,
  NccSectionHeader,
  NccStatGrid,
} from "@/components/ncc/ncc-ui";
import {
  NCC_INSTITUTIONS,
  NCC_LEGAL_DOCS,
  NCC_NETWORK_STATS,
  NCC_SERVICES,
} from "@/lib/ncc/ncc-tokens";

export function NccHomePage() {
  return (
    <NccLayout>
      <NccHero
        title="Newport Clearing Corporation"
        subtitle="The financial infrastructure connecting Newport's institutions."
        tags={["Clearing", "Settlement", "Routing", "Infrastructure"]}
        primaryAction={
          <SiteInternalLink
            siteKey="ncc"
            to="/participation"
            className="inline-flex items-center justify-center rounded-sm bg-[#0c4d32] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#083d28]"
          >
            Apply for Participation
          </SiteInternalLink>
        }
        secondaryAction={
          <SiteInternalLink
            siteKey="ncc"
            to="/legal/NCC-LEGAL-002"
            className="inline-flex items-center justify-center rounded-sm border border-[#e5e7eb] bg-white px-4 py-2.5 text-[13px] font-medium text-[#111827] hover:bg-[#f9fafb]"
          >
            Operating Rules
          </SiteInternalLink>
        }
      />

      <NccPageContainer wide className="space-y-16">
        <section>
          <NccSectionHeader
            title="Network Statistics"
            description="Aggregate network activity across participating institutions."
          />
          <NccStatGrid stats={NCC_NETWORK_STATS} />
        </section>

        <section>
          <NccSectionHeader
            title="Core Services"
            description="Infrastructure services provided to approved network participants."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NCC_SERVICES.map((service) => (
              <NccCard key={service.title}>
                <h3 className="text-[15px] font-semibold text-[#111827]">{service.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">{service.description}</p>
              </NccCard>
            ))}
          </div>
        </section>

        <section>
          <NccSectionHeader
            title="Participating Institutions"
            description="Approved institutions connected to the NCC clearing network."
            action={
              <SiteInternalLink siteKey="ncc" to="/institutions">
                <NccButton variant="ghost">View all</NccButton>
              </SiteInternalLink>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {NCC_INSTITUTIONS.map((inst) => (
              <NccCard key={inst.name}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#111827]">{inst.name}</h3>
                    <p className="mt-1 text-[13px] text-[#6b7280]">{inst.type}</p>
                  </div>
                  <NccBadge status={inst.status} />
                </div>
                <p className="mt-4 font-mono text-[12px] text-[#6b7280]">
                  Routing: {inst.routing}
                </p>
              </NccCard>
            ))}
          </div>
        </section>

        <section>
          <NccSectionHeader title="Network Status" />
          <NccCard className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
                Current status
              </div>
              <div className="mt-2 flex items-center gap-3">
                <NccBadge status="operational" label="Operational" />
                <span className="text-[13px] text-[#6b7280]">All systems operating normally</span>
              </div>
            </div>
            <a
              href="https://status.altagroup.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-[#0c4d32] hover:underline"
            >
              View status page →
            </a>
          </NccCard>
        </section>

        <section>
          <NccSectionHeader title="Legal" description="Published participation and operating documents." />
          <div className="grid gap-4 sm:grid-cols-3">
            {NCC_LEGAL_DOCS.map((doc) => (
              <SiteInternalLink key={doc.id} siteKey="ncc" to={doc.path}>
                <NccCard className="transition-colors hover:border-[#0c4d32]/30">
                  <h3 className="text-[14px] font-semibold text-[#111827]">{doc.label}</h3>
                  <p className="mt-2 font-mono text-[11px] text-[#9ca3af]">{doc.id}</p>
                </NccCard>
              </SiteInternalLink>
            ))}
          </div>
        </section>
      </NccPageContainer>
    </NccLayout>
  );
}
