import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";
import type { SiteKey } from "@/config/sites";

export const LEGAL_DOC_ROUTE = "/legal/$docId" as const;

export type LegalEntity = "group" | "bank" | "markets" | "ncc";

export type LegalDocumentDefinition = {
  id: string;
  title: string;
  /** Short label for footer links. */
  label: string;
  /** Pretty URL path segment under /legal/ (e.g. terms, bank/deposit-account-agreement). */
  slug: string;
  entity: LegalEntity;
  version: string;
  /** Human-readable last updated label for legal document footers. */
  lastUpdated?: string;
  footerOrder: number;
  showInGlobalFooter: boolean;
  showInEntityFooter: boolean;
};

export const LEGAL_DOCUMENTS: LegalDocumentDefinition[] = [
  {
    id: "AG-LEGAL-001",
    title: "Alta Group Terms of Service",
    label: "Terms",
    slug: "terms",
    entity: "group",
    version: "1.0",
    lastUpdated: "March 2026",
    footerOrder: 1,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AG-LEGAL-002",
    title: "Alta Group Privacy Policy",
    label: "Privacy",
    slug: "privacy",
    entity: "group",
    version: "1.0",
    footerOrder: 2,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AG-LEGAL-003",
    title: "Alta Group Intellectual Property Policy",
    label: "IP Policy",
    slug: "intellectual-property",
    entity: "group",
    version: "1.0",
    footerOrder: 3,
    showInGlobalFooter: true,
    showInEntityFooter: false,
  },
  {
    id: "AB-LEGAL-001",
    title: "Alta Bank Deposit Account Agreement",
    label: "Deposit Agreement",
    slug: "bank/deposit-account-agreement",
    entity: "bank",
    version: "1.0",
    lastUpdated: "March 2026",
    footerOrder: 1,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-002",
    title: "Alta Bank Business Banking Agreement",
    label: "Business Banking Agreement",
    slug: "bank/business-banking-agreement",
    entity: "bank",
    version: "1.0",
    footerOrder: 2,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-006",
    title: "Alta Card Agreement Template",
    label: "Alta Card Agreement",
    slug: "bank/alta-card-agreement",
    entity: "bank",
    version: "1.0",
    footerOrder: 3,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-007",
    title: "Alta Bank Loan Agreement (Template)",
    label: "Lending Agreement",
    slug: "bank/lending-agreement",
    entity: "bank",
    version: "1.1",
    footerOrder: 4,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-003",
    title: "Alta Pay Terms",
    label: "Alta Pay Terms",
    slug: "bank/alta-pay-terms",
    entity: "bank",
    version: "1.0",
    footerOrder: 5,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-004",
    title: "Alta Bank Merchant Services Agreement",
    label: "Merchant Agreement",
    slug: "bank/merchant-services-agreement",
    entity: "bank",
    version: "1.0",
    footerOrder: 5,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-005",
    title: "Alta Bank Fee Schedule",
    label: "Fee Schedule",
    slug: "bank/fee-schedule",
    entity: "bank",
    version: "1.0",
    footerOrder: 6,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AE-LEGAL-001",
    title: "Alta Terminal Customer Agreement",
    label: "Customer Agreement",
    slug: "markets/customer-agreement",
    entity: "markets",
    version: "1.0",
    lastUpdated: "March 2026",
    footerOrder: 1,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AE-LEGAL-002",
    title: "Alta Exchange Listing Agreement",
    label: "Listing Agreement",
    slug: "markets/listing-agreement",
    entity: "markets",
    version: "1.0",
    footerOrder: 2,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AE-LEGAL-003",
    title: "Alta Exchange Trading Rules",
    label: "Trading Rules",
    slug: "markets/trading-rules",
    entity: "markets",
    version: "1.0",
    footerOrder: 3,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AE-LEGAL-004",
    title: "Alta Markets Market Data & API Terms",
    label: "Market Data & API Terms",
    slug: "markets/market-data-api-terms",
    entity: "markets",
    version: "1.0",
    footerOrder: 4,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AE-LEGAL-005",
    title: "Alta Exchange Fee Schedule",
    label: "Fee Schedule",
    slug: "markets/fee-schedule",
    entity: "markets",
    version: "1.0",
    footerOrder: 5,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "NCC-LEGAL-001",
    title: "NCC Participation Agreement",
    label: "Participation Agreement",
    slug: "ncc/participation-agreement",
    entity: "ncc",
    version: "1.0",
    lastUpdated: "March 2026",
    footerOrder: 1,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "NCC-LEGAL-002",
    title: "NCC Operating Rules",
    label: "Operating Rules",
    slug: "ncc/operating-rules",
    entity: "ncc",
    version: "1.0",
    footerOrder: 2,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "NCC-LEGAL-003",
    title: "NCC Fee Schedule",
    label: "Fee Schedule",
    slug: "ncc/fee-schedule",
    entity: "ncc",
    version: "1.0",
    footerOrder: 3,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
];

const slugToDocId = new Map(LEGAL_DOCUMENTS.map((doc) => [doc.slug, doc.id]));

export function legalDocumentPath(doc: LegalDocumentDefinition | string): string {
  const definition = typeof doc === "string" ? getLegalDocument(doc) : doc;
  if (!definition) return LEGAL_CENTER_PATH;
  return `/legal/${definition.slug}`;
}

export function resolveLegalDocIdFromSlug(slug: string): string | undefined {
  return slugToDocId.get(slug.replace(/^\/+|\/+$/g, ""));
}

export function legalDocLinkParams(id: string) {
  const doc = getLegalDocument(id);
  return {
    to: LEGAL_DOC_ROUTE,
    params: { docId: doc?.id ?? id },
  } as const;
}

export function getLegalDocument(id: string): LegalDocumentDefinition | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.id === id);
}

function sortFooterDocs(docs: LegalDocumentDefinition[]): LegalDocumentDefinition[] {
  return [...docs].sort((a, b) => a.footerOrder - b.footerOrder);
}

export function footerDocuments(options?: {
  entity?: LegalEntity;
  globalOnly?: boolean;
  entityOnly?: boolean;
}): LegalDocumentDefinition[] {
  const filtered = LEGAL_DOCUMENTS.filter((doc) => {
    if (options?.entity && doc.entity !== options.entity) return false;
    if (options?.globalOnly && !doc.showInGlobalFooter) return false;
    if (options?.entityOnly && !doc.showInEntityFooter) return false;
    return true;
  });
  return sortFooterDocs(filtered);
}

export function groupFooterDocuments(): LegalDocumentDefinition[] {
  return footerDocuments({ entity: "group", globalOnly: true });
}

/** Global Legal column — Terms and Privacy only. */
export function groupEssentialLegalDocuments(): LegalDocumentDefinition[] {
  return sortFooterDocs(
    LEGAL_DOCUMENTS.filter((doc) => ["AG-LEGAL-001", "AG-LEGAL-002"].includes(doc.id)),
  );
}

const SITE_ENTITY_SECTION_DOC_IDS: Record<SiteKey, string[]> = {
  corporate: [],
  bank: ["AB-LEGAL-001", "AB-LEGAL-002", "AB-LEGAL-006", "AB-LEGAL-007", "AB-LEGAL-003", "AB-LEGAL-005"],
  exchange: ["AE-LEGAL-002", "AE-LEGAL-003", "AE-LEGAL-004", "AE-LEGAL-005"],
  terminal: ["AE-LEGAL-001", "AE-LEGAL-003", "AE-LEGAL-004", "AE-LEGAL-005"],
  ncc: ["NCC-LEGAL-001", "NCC-LEGAL-002", "NCC-LEGAL-003"],
};

/** Entity-specific footer section documents for the current site. */
export function siteEntitySectionDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  return sortFooterDocs(
    SITE_ENTITY_SECTION_DOC_IDS[siteKey]
      .map((id) => getLegalDocument(id))
      .filter((doc): doc is LegalDocumentDefinition => doc !== undefined),
  );
}

export function entityFooterDocuments(entity: LegalEntity): LegalDocumentDefinition[] {
  return footerDocuments({ entity, entityOnly: true, globalOnly: true });
}

/** Minimal auth / payment footers — group terms only. */
export function essentialGroupDocuments(): LegalDocumentDefinition[] {
  return sortFooterDocs(
    LEGAL_DOCUMENTS.filter((doc) => ["AG-LEGAL-001", "AG-LEGAL-002"].includes(doc.id)),
  );
}

/** Compact dashboard/auth footers — Terms, Privacy, and key entity docs. */
export function siteCompactFooterDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  const essentials = groupEssentialLegalDocuments();
  const entityDocs =
    siteKey === "corporate" ? [] : siteEntitySectionDocuments(siteKey).slice(0, 2);

  const merged = [...entityDocs];
  for (const doc of essentials) {
    if (!merged.some((existing) => existing.id === doc.id)) merged.push(doc);
  }
  return sortFooterDocs(merged);
}

/** @deprecated Use siteEntitySectionDocuments */
export function siteMarketingPrimaryDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  if (siteKey === "corporate") return groupEssentialLegalDocuments();
  return siteEntitySectionDocuments(siteKey);
}

/** Merchant-facing checkout footers. */
export function paymentFooterDocuments(): LegalDocumentDefinition[] {
  return sortFooterDocs(
    LEGAL_DOCUMENTS.filter((doc) =>
      ["AG-LEGAL-001", "AG-LEGAL-002", "AB-LEGAL-003", "AB-LEGAL-004"].includes(doc.id),
    ),
  );
}

export const FOOTER_DISCLAIMERS = {
  global:
    "Alta services are designed for Minecraft, Discord, roleplay, and virtual economy environments unless expressly stated otherwise.",
  bank: "Alta Bank is not a real-world bank and does not hold real-world deposits unless expressly stated otherwise.",
  markets:
    "Alta Exchange and Alta Terminal are roleplay/virtual economy market services and do not provide real-world investment advice.",
  ncc: "NCC provides roleplay/virtual economy clearing and settlement infrastructure for approved institutions.",
} as const;

export { LEGAL_CENTER_PATH };
