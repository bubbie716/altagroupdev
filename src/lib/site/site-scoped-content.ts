import type { SiteKey } from "@/config/sites";
import type { LegalEntity } from "@/lib/legal/legal-document-registry";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
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

const ALL_LEGAL_DOC_PREFIXES = ["AG-", "AB-", "AT-", "NCC-"] as const;
const ALL_DISCORD_ENTITIES: AltaDiscordEntity[] = ["group", "bank", "markets", "ncc"];

/** Sub-entity legal scope for a site (null = Alta Group hub — shows all entities). */
export function siteLegalEntity(siteKey: SiteKey): LegalEntity | null {
  if (siteKey === "bank") return "bank";
  if (siteKey === "exchange" || siteKey === "terminal") return "terminal";
  if (siteKey === "ncc") return "ncc";
  return null;
}

function docPrefixForEntity(entity: LegalEntity): string {
  if (entity === "bank") return "AB-";
  if (entity === "terminal") return "AT-";
  return "NCC-";
}

function categoryPrefixesForSite(siteKey: SiteKey): string[] {
  if (siteKey === "corporate") return [...ALL_LEGAL_DOC_PREFIXES];
  const prefixes = ["AG-"];
  const entity = siteLegalEntity(siteKey);
  if (entity) prefixes.push(docPrefixForEntity(entity));
  return prefixes;
}

function categoryMatchesSite(category: LegalDocCategory, siteKey: SiteKey): boolean {
  if (siteKey === "corporate") return true;
  const prefixes = categoryPrefixesForSite(siteKey);
  return prefixes.some((prefix) => {
    if (prefix === "AG-") return category.startsWith("Alta Group");
    if (prefix === "AB-") return category.startsWith("Alta Bank");
    if (prefix === "AT-") return category.startsWith("Alta Terminal");
    return category.startsWith("NCC");
  });
}

function isArchivedRegistryDoc(docId: string): boolean {
  return getLegalDocument(docId)?.archived === true;
}

export function legalDocMatchesSite(doc: LegalDocMeta, siteKey: SiteKey): boolean {
  if (isArchivedRegistryDoc(doc.id)) return false;
  if (siteKey === "corporate") return true;
  // Legacy host — Group docs only in legal browser (product pages redirect to Terminal).
  if (siteKey === "exchange") {
    return categoryPrefixesForSite(siteKey).some(
      (prefix) => prefix === "AG-" && doc.id.startsWith(prefix),
    );
  }
  return categoryPrefixesForSite(siteKey).some((prefix) => doc.id.startsWith(prefix));
}

export function getLegalDocCategoriesForSite(siteKey: SiteKey): LegalDocCategory[] {
  if (siteKey === "corporate") return [...legalDocCategoryOrder];
  if (siteKey === "exchange") {
    return legalDocCategoryOrder.filter((category) => category.startsWith("Alta Group"));
  }
  return legalDocCategoryOrder.filter((category) => categoryMatchesSite(category, siteKey));
}

export function getLegalDocsByCategoryForSite(
  siteKey: SiteKey,
): Partial<Record<LegalDocCategory, LegalDocMeta[]>> {
  const categories = getLegalDocCategoriesForSite(siteKey);
  return Object.fromEntries(
    categories
      .map((category) => {
        const docs = (legalDocsByCategory[category] ?? []).filter(
          (doc) => !isArchivedRegistryDoc(doc.id),
        );
        return [category, docs] as const;
      })
      .filter(([, docs]) => docs.length > 0),
  );
}

export function getLegalDocsForSite(siteKey: SiteKey): LegalDocMeta[] {
  return getLegalDocCategoriesForSite(siteKey).flatMap((category) => {
    const docs = getLegalDocsByCategoryForSite(siteKey)[category] ?? [];
    return docs;
  });
}

/** Discord communities visible on a site's support page (Alta Group hub shows all). */
export function siteDiscordEntities(siteKey: SiteKey): AltaDiscordEntity[] {
  if (siteKey === "corporate") return [...ALL_DISCORD_ENTITIES];
  const entities: AltaDiscordEntity[] = ["group"];
  const entity = siteLegalEntity(siteKey);
  if (entity === "bank") entities.push("bank");
  if (entity === "terminal") entities.push("markets");
  if (entity === "ncc") entities.push("ncc");
  return entities;
}

export function getDiscordCommunitiesForSite(siteKey: SiteKey) {
  const allowed = new Set(siteDiscordEntities(siteKey));
  return ALTA_DISCORD_COMMUNITIES.filter((community) => allowed.has(community.entity));
}
