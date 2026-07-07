/** Public Alta Discord invite URLs — see discord-urls.ts */
export { ALTA_DISCORD_INVITE_URL, getAltaDiscordUrl, ALTA_DISCORD_URLS } from "@/lib/site/discord-urls";

import type { SiteKey } from "@/config/sites";
import {
  ECOSYSTEM_ENTRIES,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";

export const LEGAL_CENTER_PATH = "/legal" as const;

/** Public system status page — external redirect. */
export const ALTA_SYSTEM_STATUS_URL = "https://status.altagroup.dev" as const;

/** Subtle purpose line shown under the wordmark in marketing footers. */
export const SITE_FOOTER_EMPHASIS: Record<SiteKey, string> = {
  corporate: "Corporate",
  bank: "Retail + Commercial Banking",
  exchange: "Capital Markets",
  terminal: "Brokerage",
  ncc: "Financial Infrastructure",
};

export type FooterEcosystemLink =
  | { label: string; to: string; current: boolean; external?: false }
  | { label: string; href: string; current: boolean; external: true };

/** Cross-entity navigation — current site is marked for emphasis. */
export function getFooterEcosystemLinks(currentSiteKey: SiteKey): FooterEcosystemLink[] {
  return getEcosystemSwitcherLinks(currentSiteKey).map((link) => {
    const homePath = ECOSYSTEM_ENTRIES.find((entry) => entry.key === link.key)?.homePath ?? "/";
    if (link.current) {
      return { label: link.name, to: homePath, current: true, external: false as const };
    }
    return { label: link.name, href: link.href, current: false, external: true as const };
  });
}

/** @deprecated Use getFooterEcosystemLinks */
export type FooterCompanyLink = FooterEcosystemLink;

/** @deprecated Use getFooterEcosystemLinks */
export function getFooterCompanyLinks(): FooterEcosystemLink[] {
  return getFooterEcosystemLinks("corporate");
}

export const FOOTER_CORPORATE_SECTION_LINKS = [
  { label: "Leadership", to: "/leadership" as const },
  { label: "About", to: "/home" as const },
  { label: "Companies", to: "/companies" as const },
  { label: "Governance", to: "/structure" as const },
] as const;

export function getFooterEntitySectionTitle(siteKey: SiteKey): string {
  const titles: Record<SiteKey, string> = {
    corporate: "Alta Group",
    bank: "Alta Bank",
    exchange: "Alta Exchange",
    terminal: "Alta Terminal",
    ncc: "Newport Clearing Corporation",
  };
  return titles[siteKey];
}

function footerDiscordRoute(siteKey: SiteKey): "/discord" | "/discord/bank" | "/discord/markets" | "/discord/ncc" {
  if (siteKey === "bank") return "/discord/bank";
  if (siteKey === "exchange" || siteKey === "terminal") return "/discord/markets";
  if (siteKey === "ncc") return "/discord/ncc";
  return "/discord";
}

export type FooterSupportLink =
  | { label: string; to: string; external?: false }
  | { label: string; href: string; external: true };

export function getFooterSupportLinks(siteKey: SiteKey): FooterSupportLink[] {
  return [
    { label: "Support Center", to: "/support" },
    { label: "Documentation", to: "/docs" },
    { label: "System Status", href: ALTA_SYSTEM_STATUS_URL, external: true },
    { label: "Discord", to: footerDiscordRoute(siteKey) },
    { label: "Contact", to: "/contact" },
  ];
}

/** @deprecated Use getFooterSupportLinks */
export const FOOTER_SUPPORT_LINKS = [{ label: "Support Center", to: "/support" as const }] as const;
