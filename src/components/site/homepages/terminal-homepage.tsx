import { EntityFeatureGrid, EntityMarketingShell } from "@/components/site/entity-marketing-shell";

export function TerminalHomepage() {
  return (
    <EntityMarketingShell
      eyebrow="Alta Exchange · Terminal"
      title="Trading, portfolio, and market access for Newport investors."
      description="Alta Terminal brings together portfolio analytics, watchlists, order entry, IPO access, and market research in one investor workspace."
    >
      <EntityFeatureGrid
        items={[
          {
            title: "Dashboard",
            description: "Portfolio snapshot, performance, and allocation at a glance.",
            to: "/terminal",
          },
          {
            title: "Portfolio",
            description: "Holdings, cost basis, and performance history.",
            to: "/terminal/portfolio",
          },
          {
            title: "Markets",
            description: "Quotes, depth, and trade entry across listed securities.",
            to: "/terminal/trade",
          },
          {
            title: "Watchlists",
            description: "Track issuers, indices, and custom market screens.",
            to: "/terminal/watchlist",
          },
          {
            title: "IPO Access",
            description: "Participate in primary market offerings on Alta Exchange.",
            to: "/terminal/ipo",
          },
          {
            title: "Research",
            description: "Filings, news, and issuer research tools.",
            to: "/terminal/research",
          },
        ]}
      />
    </EntityMarketingShell>
  );
}
