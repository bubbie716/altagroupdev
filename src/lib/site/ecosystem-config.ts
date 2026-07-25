import type { SiteKey } from "@/config/sites";
import { resolveCorporateSiteUrl, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

export type EcosystemEntry = {
  key: SiteKey;
  name: string;
  /** Compact label for header triggers. */
  shortName: string;
  description: string;
  homePath: string;
};

/** Canonical Alta ecosystem destinations — single source for header switcher and footer links. */
export const ECOSYSTEM_ENTRIES: EcosystemEntry[] = [
  {
    key: "corporate",
    name: "Alta Group",
    shortName: "Alta Group",
    description: "Corporate info",
    homePath: "/home",
  },
  {
    key: "bank",
    name: "Alta Bank",
    shortName: "Alta Bank",
    description: "Banking and payments",
    homePath: "/",
  },
  {
    key: "terminal",
    name: "Alta Terminal",
    shortName: "Alta Terminal",
    description: "Brokerage and trading",
    homePath: "/terminal",
  },
];

export type EcosystemSwitcherLink = {
  key: SiteKey;
  name: string;
  shortName: string;
  description: string;
  href: string;
  current: boolean;
};

function resolveEcosystemHref(entry: EcosystemEntry, requestHost?: string): string {
  if (entry.key === "corporate") {
    return resolveCorporateSiteUrl(entry.homePath, requestHost);
  }
  return resolveEntitySiteUrl(entry.key, entry.homePath, requestHost);
}

export function getEcosystemSwitcherLinks(
  currentSiteKey: SiteKey,
  requestHost?: string,
): EcosystemSwitcherLink[] {
  return ECOSYSTEM_ENTRIES.map((entry) => ({
    key: entry.key,
    name: entry.name,
    shortName: entry.shortName,
    description: entry.description,
    href: resolveEcosystemHref(entry, requestHost),
    current: entry.key === currentSiteKey,
  }));
}

export function getCurrentEcosystemEntry(currentSiteKey: SiteKey): EcosystemEntry {
  return ECOSYSTEM_ENTRIES.find((entry) => entry.key === currentSiteKey) ?? ECOSYSTEM_ENTRIES[0];
}
