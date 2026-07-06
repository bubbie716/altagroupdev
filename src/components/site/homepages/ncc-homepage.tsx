import { EntityFeatureGrid, EntityMarketingShell } from "@/components/site/entity-marketing-shell";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { resolveCorporateSiteUrl } from "@/lib/site/entity-site-url";

export function NccHomepage() {
  return (
    <EntityMarketingShell
      eyebrow="Newport Clearing Corporation"
      title="Clearing, settlement, and routing for approved institutions."
      description="NCC provides institution connectivity, participation standards, and operating rules for clearing and settlement across the Alta ecosystem."
    >
      <EntityFeatureGrid
        items={[
          {
            title: "Network",
            description: "Institution connectivity and routing across Alta markets and banking.",
            to: "/company/ncc",
          },
          {
            title: "Participation",
            description: "Membership standards and participation agreement for approved institutions.",
            href: resolveCorporateSiteUrl("/legal/NCC-LEGAL-001"),
            external: true,
          },
          {
            title: "Operating Rules",
            description: "Clearing, settlement, and operational requirements.",
            href: resolveCorporateSiteUrl("/legal/NCC-LEGAL-002"),
            external: true,
          },
          {
            title: "Fee Schedule",
            description: "Published institution fees and billing standards.",
            href: resolveCorporateSiteUrl("/legal/NCC-LEGAL-003"),
            external: true,
          },
          {
            title: "Support",
            description: "Institution onboarding and operational support resources.",
            to: "/support",
          },
          {
            title: "Legal Center",
            description: "All Alta Group legal documents and entity agreements.",
            href: resolveCorporateSiteUrl("/legal"),
            external: true,
          },
        ]}
      />
      <div className="mt-10 rounded-lg border border-border/70 bg-surface-1/40 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Institution access
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Full institution dashboards and connectivity tools are rolling out to approved participants.
          Contact Alta support for participation inquiries.
        </p>
        <SiteInternalLink
          siteKey="ncc"
          to="/support"
          className="mt-4 inline-flex text-sm text-foreground transition-colors hover:text-gold"
        >
          Contact support →
        </SiteInternalLink>
      </div>
    </EntityMarketingShell>
  );
}
