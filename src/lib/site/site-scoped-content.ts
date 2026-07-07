import type { SiteKey } from "@/config/sites";
import type { LegalEntity } from "@/lib/legal/legal-document-registry";
import {
  legalDocCategoryOrder,
  legalDocsByCategory,
  type LegalDocCategory,
  type LegalDocMeta,
} from "@/lib/governance/legal-docs-catalog";
import {
  ALTA_DISCORD_COMMUNITIES,
  type AltaDiscordEntity,
} from "@/lib/site/discord-urls";

/** Sub-entity legal scope for a site (null = Alta Group only). */
export function siteLegalEntity(siteKey: SiteKey): LegalEntity | null {
  if (siteKey === "bank") return "bank";
  if (siteKey === "exchange" || siteKey === "terminal") return "markets";
  if (siteKey === "ncc") return "ncc";
  return null;
}

function docPrefixForEntity(entity: LegalEntity): string {
  if (entity === "bank") return "AB-";
  if (entity === "markets") return "AE-";
  return "NCC-";
}

function categoryPrefixesForSite(siteKey: SiteKey): string[] {
  const prefixes = ["AG-"];
  const entity = siteLegalEntity(siteKey);
  if (entity) prefixes.push(docPrefixForEntity(entity));
  return prefixes;
}

function categoryMatchesSite(category: LegalDocCategory, siteKey: SiteKey): boolean {
  const prefixes = categoryPrefixesForSite(siteKey);
  return prefixes.some((prefix) => {
    if (prefix === "AG-") return category.startsWith("Alta Group");
    if (prefix === "AB-") return category.startsWith("Alta Bank");
    if (prefix === "AE-") return category.startsWith("Alta Exchange");
    return category.startsWith("NCC");
  });
}

export function legalDocMatchesSite(doc: LegalDocMeta, siteKey: SiteKey): boolean {
  return categoryPrefixesForSite(siteKey).some((prefix) => doc.id.startsWith(prefix));
}

export function getLegalDocCategoriesForSite(siteKey: SiteKey): LegalDocCategory[] {
  return legalDocCategoryOrder.filter((category) => categoryMatchesSite(category, siteKey));
}

export function getLegalDocsByCategoryForSite(
  siteKey: SiteKey,
): Partial<Record<LegalDocCategory, LegalDocMeta[]>> {
  const categories = getLegalDocCategoriesForSite(siteKey);
  return Object.fromEntries(
    categories
      .map((category) => [category, legalDocsByCategory[category]] as const)
      .filter(([, docs]) => docs.length > 0),
  );
}

export function getLegalDocsForSite(siteKey: SiteKey): LegalDocMeta[] {
  return getLegalDocCategoriesForSite(siteKey).flatMap((category) => legalDocsByCategory[category]);
}

/** Discord communities visible on a site's support page (Alta Group + that sub). */
export function siteDiscordEntities(siteKey: SiteKey): AltaDiscordEntity[] {
  const entities: AltaDiscordEntity[] = ["group"];
  const entity = siteLegalEntity(siteKey);
  if (entity === "bank") entities.push("bank");
  if (entity === "markets") entities.push("markets");
  if (entity === "ncc") entities.push("ncc");
  return entities;
}

export function getDiscordCommunitiesForSite(siteKey: SiteKey) {
  const allowed = new Set(siteDiscordEntities(siteKey));
  return ALTA_DISCORD_COMMUNITIES.filter((community) => allowed.has(community.entity));
}
