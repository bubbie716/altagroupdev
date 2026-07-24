import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";
import type { SiteKey } from "@/config/sites";

export const LEGAL_DOC_ROUTE = "/legal/$docId" as const;

export type LegalEntity = "group" | "bank" | "terminal";

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
  /** Archived docs remain resolvable by ID but are excluded from active footers/selection. */
  archived?: boolean;
};

export const LEGAL_DOCUMENTS: LegalDocumentDefinition[] = [
  {
    id: "AG-LEGAL-001",
    title: "Alta Group Terms of Service",
    label: "Terms",
    slug: "terms",
    entity: "group",
    version: "1.1",
    lastUpdated: "July 2026",
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
    version: "1.1",
    lastUpdated: "July 2026",
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
    version: "1.1",
    lastUpdated: "July 2026",
    footerOrder: 3,
    showInGlobalFooter: true,
    showInEntityFooter: false,
  },
  {
    id: "AG-LEGAL-004",
    title: "Alta Acceptable Use Policy",
    label: "Acceptable Use",
    slug: "acceptable-use",
    entity: "group",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 4,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AG-LEGAL-005",
    title: "Electronic Communications and Consent",
    label: "Electronic Consent",
    slug: "electronic-communications",
    entity: "group",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 5,
    showInGlobalFooter: true,
    showInEntityFooter: true,
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
    version: "1.1",
    lastUpdated: "July 2026",
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
    version: "1.1",
    lastUpdated: "July 2026",
    footerOrder: 6,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-007",
    title: "Alta Bank Loan Agreement (Template)",
    label: "Lending Agreement",
    slug: "bank/lending-agreement",
    entity: "bank",
    version: "1.2",
    lastUpdated: "July 2026",
    footerOrder: 7,
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
    footerOrder: 3,
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
    footerOrder: 4,
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
    footerOrder: 9,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-008",
    title: "Alta Bank Transfers and Error Resolution Terms",
    label: "Transfer Terms",
    slug: "bank/transfers-error-resolution",
    entity: "bank",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 5,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AB-LEGAL-009",
    title: "Alta Private Terms",
    label: "Alta Private Terms",
    slug: "bank/alta-private-terms",
    entity: "bank",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 8,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AT-LEGAL-001",
    title: "Alta Terminal Customer Agreement",
    label: "Customer Agreement",
    slug: "terminal/customer-agreement",
    entity: "terminal",
    version: "1.1",
    lastUpdated: "July 2026",
    footerOrder: 1,
    showInGlobalFooter: true,
    showInEntityFooter: true,
  },
  {
    id: "AT-LEGAL-002",
    title: "Alta Terminal Trading and Order Handling Terms",
    label: "Order Handling Terms",
    slug: "terminal/order-handling",
    entity: "terminal",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 2,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AT-LEGAL-003",
    title: "Alta Terminal Risk Disclosure",
    label: "Risk Disclosure",
    slug: "terminal/risk-disclosure",
    entity: "terminal",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 3,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AT-LEGAL-004",
    title: "Alta Terminal Market Data and Third-Party Services Terms",
    label: "Market Data Terms",
    slug: "terminal/market-data-third-party-services",
    entity: "terminal",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 4,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
  {
    id: "AT-LEGAL-005",
    title: "Alta Terminal Fee Schedule",
    label: "Fee Schedule",
    slug: "terminal/fee-schedule",
    entity: "terminal",
    version: "1.0",
    lastUpdated: "July 2026",
    footerOrder: 5,
    showInGlobalFooter: false,
    showInEntityFooter: true,
  },
];

const slugToDocId = new Map(LEGAL_DOCUMENTS.map((doc) => [doc.slug, doc.id]));
/** Legacy Terminal agreement IDs/slugs resolve to AT-LEGAL-001. */
slugToDocId.set("markets/customer-agreement", "AT-LEGAL-001");

/** Legacy ID aliases kept for deep links only — not listed in public catalogs. */
const LEGAL_DOC_ID_ALIASES: Record<string, string> = {
  "AE-LEGAL-001": "AT-LEGAL-001",
};

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

/** Resolves by ID including legacy aliases for deep links. */
export function getLegalDocument(id: string): LegalDocumentDefinition | undefined {
  const resolvedId = LEGAL_DOC_ID_ALIASES[id] ?? id;
  return LEGAL_DOCUMENTS.find((doc) => doc.id === resolvedId);
}

/** @deprecated No public archived catalog — legacy Exchange docs are unpublished. */
export function archivedLegalDocuments(): LegalDocumentDefinition[] {
  return LEGAL_DOCUMENTS.filter((doc) => doc.archived === true);
}

function isActiveLegalDocument(doc: LegalDocumentDefinition): boolean {
  return doc.archived !== true;
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
    if (!isActiveLegalDocument(doc)) return false;
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
    LEGAL_DOCUMENTS.filter(
      (doc) => isActiveLegalDocument(doc) && ["AG-LEGAL-001", "AG-LEGAL-002"].includes(doc.id),
    ),
  );
}

function activeDocumentsById(ids: string[]): LegalDocumentDefinition[] {
  return ids
    .map((id) => getLegalDocument(id))
    .filter((doc): doc is LegalDocumentDefinition => doc !== undefined && isActiveLegalDocument(doc));
}

const SITE_ENTITY_SECTION_DOC_IDS: Record<SiteKey, string[]> = {
  corporate: [],
  bank: [
    "AB-LEGAL-001",
    "AB-LEGAL-002",
    "AB-LEGAL-003",
    "AB-LEGAL-004",
    "AB-LEGAL-008",
    "AB-LEGAL-006",
    "AB-LEGAL-007",
    "AB-LEGAL-009",
    "AB-LEGAL-005",
  ],
  /** Legacy host — same Terminal agreement as terminal site. */
  exchange: [],
  terminal: ["AT-LEGAL-001", "AT-LEGAL-002", "AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"],
};

/** Entity-specific footer section documents for the current site (excludes archived). */
export function siteEntitySectionDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  return sortFooterDocs(
    SITE_ENTITY_SECTION_DOC_IDS[siteKey]
      .map((id) => getLegalDocument(id))
      .filter((doc): doc is LegalDocumentDefinition => doc !== undefined && isActiveLegalDocument(doc)),
  );
}

export function entityFooterDocuments(entity: LegalEntity): LegalDocumentDefinition[] {
  return footerDocuments({ entity, entityOnly: true, globalOnly: true });
}

/** Minimal auth / payment footers — group terms only. */
export function essentialGroupDocuments(): LegalDocumentDefinition[] {
  return sortFooterDocs(
    LEGAL_DOCUMENTS.filter(
      (doc) => isActiveLegalDocument(doc) && ["AG-LEGAL-001", "AG-LEGAL-002"].includes(doc.id),
    ),
  );
}

/** Compact dashboard/auth footers — Terms, Privacy, and key entity docs. */
export function siteCompactFooterDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  const entityPrimary: Partial<Record<SiteKey, string>> = {
    bank: "AB-LEGAL-001",
    exchange: "AT-LEGAL-001",
    terminal: "AT-LEGAL-001",
  };
  const ids = ["AG-LEGAL-001", "AG-LEGAL-002", "AG-LEGAL-005"];
  const primaryId = entityPrimary[siteKey];
  if (primaryId) ids.push(primaryId);
  return activeDocumentsById(ids);
}

/** @deprecated Use siteEntitySectionDocuments */
export function siteMarketingPrimaryDocuments(siteKey: SiteKey): LegalDocumentDefinition[] {
  if (siteKey === "corporate") return groupEssentialLegalDocuments();
  return siteEntitySectionDocuments(siteKey);
}

/** Merchant-facing checkout footers. */
export function paymentFooterDocuments(): LegalDocumentDefinition[] {
  return activeDocumentsById([
    "AG-LEGAL-001",
    "AG-LEGAL-002",
    "AG-LEGAL-005",
    "AB-LEGAL-003",
    "AB-LEGAL-004",
    "AB-LEGAL-008",
  ]);
}

export const FOOTER_DISCLAIMERS = {
  global:
    "Alta services are designed for Minecraft, Discord, roleplay, and virtual economy environments unless expressly stated otherwise.",
  bank: "Alta Bank is not a real-world bank and does not hold real-world deposits unless expressly stated otherwise.",
  markets:
    "Alta Terminal is a roleplay/virtual economy brokerage service and does not provide real-world investment advice. Alta Terminal does not operate a securities exchange.",
} as const;

export { LEGAL_CENTER_PATH };
