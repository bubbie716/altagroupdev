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
  exchange: "Brokerage",
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
    exchange: "Alta Terminal",
    terminal: "Alta Terminal",
    ncc: "Newport Clearing Corporation",
  };
  return titles[siteKey];
}

export type FooterSupportLink =
  | { label: string; to: string; external?: false }
  | { label: string; href: string; external: true };

export function getFooterSupportLinks(_siteKey: SiteKey): FooterSupportLink[] {
  return [
    { label: "Support Center", to: "/support" },
    { label: "System Status", href: ALTA_SYSTEM_STATUS_URL, external: true },
  ];
}

/** @deprecated Use getFooterSupportLinks */
export const FOOTER_SUPPORT_LINKS = [{ label: "Support Center", to: "/support" as const }] as const;

export type FooterCopyrightEntity = {
  /** Legal name in the copyright line (e.g. Alta Bank N.V.). */
  legalName: string;
  /** Short name used in the disclaimer paragraph. */
  shortName: string;
};

export const FOOTER_COPYRIGHT_ENTITY: Record<SiteKey, FooterCopyrightEntity> = {
  corporate: { legalName: "Alta Group N.V.", shortName: "Alta Group" },
  bank: { legalName: "Alta Bank N.V.", shortName: "Alta Bank" },
  exchange: { legalName: "Alta Terminal", shortName: "Alta Terminal" },
  terminal: { legalName: "Alta Terminal LLC", shortName: "Alta Terminal" },
  ncc: { legalName: "Newport Clearing Corporation", shortName: "Newport Clearing Corporation" },
};

export function getFooterCopyrightLines(siteKey: SiteKey): { copyright: string; disclaimer: string } {
  const { legalName, shortName } = FOOTER_COPYRIGHT_ENTITY[siteKey];
  return {
    copyright: `© 2026 ${legalName} All rights reserved.`,
    disclaimer: `${shortName} services are designed for Minecraft, Discord, roleplay, and virtual economy environments unless expressly stated otherwise. ${shortName} is not officially affiliated with or endorsed by District Roleplay, Minecraft, Mojang AB, or Microsoft Corporation in any way.`,
  };
}
