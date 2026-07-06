import { EntityFeatureGrid, EntityMarketingShell } from "@/components/site/entity-marketing-shell";
import { resolveCorporateSiteUrl, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { useSiteContext } from "@/hooks/use-site-context";

export function ExchangeHomepage() {
  const site = useSiteContext();

  return (
    <EntityMarketingShell
      eyebrow={site.entityName}
      title="Listings, IPOs, and market infrastructure for Newport."
      description="Alta Exchange operates Newport's primary market for listings, price discovery, corporate actions, issuer services, and market data."
    >
      <EntityFeatureGrid
        items={[
          {
            title: "Listings",
            description: "Browse listed companies, filings, and market statistics.",
            to: "/exchange/listings",
          },
          {
            title: "IPO Center",
            description: "Follow new issues, allocations, and offering calendars.",
            to: "/exchange/ipo",
          },
          {
            title: "Companies",
            description: "Issuer profiles, ownership, and corporate actions.",
            to: "/exchange/listings",
          },
          {
            title: "Trading Rules",
            description: "Exchange trading rules and market conduct standards.",
            href: resolveCorporateSiteUrl("/legal/AE-LEGAL-003"),
            external: true,
          },
          {
            title: "Market Data & API",
            description: "Market data products and developer API access.",
            to: "/exchange/api",
          },
          {
            title: "Alta Terminal",
            description: "Trade, monitor portfolios, and access markets.",
            href: resolveEntitySiteUrl("terminal"),
            external: true,
          },
        ]}
      />
    </EntityMarketingShell>
  );
}
