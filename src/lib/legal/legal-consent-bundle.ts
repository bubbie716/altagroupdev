/**
 * Server-authoritative consent bundle definitions.
 * Document versions and hashes are resolved at runtime from the legal registry + content —
 * never trusted from the browser.
 */
import {
  getLegalDocument,
  legalDocumentPath,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import type { LegalAcceptanceTypeId, LegalConsentScopeId } from "@/lib/legal/consent-scopes";

export type ConsentBundleDocumentRequirement = {
  documentId: string;
  acceptanceType: LegalAcceptanceTypeId;
};

export type ConsentBundleDefinition = {
  scope: LegalConsentScopeId;
  documents: readonly ConsentBundleDocumentRequirement[];
};

/** Phase 1 core onboarding legal bundle. */
export const CORE_CONSENT_BUNDLE: ConsentBundleDefinition = {
  scope: "CORE",
  documents: [
    { documentId: "AG-LEGAL-001", acceptanceType: "AGREED" },
    { documentId: "AG-LEGAL-004", acceptanceType: "AGREED" },
    { documentId: "AG-LEGAL-002", acceptanceType: "ACKNOWLEDGED" },
    { documentId: "AG-LEGAL-005", acceptanceType: "CONSENTED" },
  ],
};

/**
 * Progressive product consent bundles (Phase 3).
 * Template agreements use ACKNOWLEDGED — they are not finalized executable contracts.
 */
export const PRODUCT_CONSENT_BUNDLES: Record<
  Exclude<LegalConsentScopeId, "CORE">,
  ConsentBundleDefinition
> = {
  BANK: {
    scope: "BANK",
    documents: [
      { documentId: "AB-LEGAL-001", acceptanceType: "AGREED" },
      { documentId: "AB-LEGAL-005", acceptanceType: "ACKNOWLEDGED" },
      { documentId: "AB-LEGAL-008", acceptanceType: "ACKNOWLEDGED" },
    ],
  },
  TERMINAL: {
    scope: "TERMINAL",
    documents: [
      { documentId: "AT-LEGAL-001", acceptanceType: "AGREED" },
      { documentId: "AT-LEGAL-002", acceptanceType: "AGREED" },
      { documentId: "AT-LEGAL-003", acceptanceType: "ACKNOWLEDGED" },
      { documentId: "AT-LEGAL-004", acceptanceType: "ACKNOWLEDGED" },
      { documentId: "AT-LEGAL-005", acceptanceType: "ACKNOWLEDGED" },
    ],
  },
  CRYPTO: {
    scope: "CRYPTO",
    documents: [{ documentId: "AT-LEGAL-006", acceptanceType: "ACKNOWLEDGED" }],
  },
  ALTA_PAY: {
    scope: "ALTA_PAY",
    documents: [{ documentId: "AB-LEGAL-003", acceptanceType: "AGREED" }],
  },
  ALTA_CARD: {
    scope: "ALTA_CARD",
    // Generic template — not a finalized card-specific agreement.
    documents: [{ documentId: "AB-LEGAL-006", acceptanceType: "ACKNOWLEDGED" }],
  },
  LENDING: {
    scope: "LENDING",
    // Generic template — not a finalized loan offer/agreement.
    documents: [{ documentId: "AB-LEGAL-007", acceptanceType: "ACKNOWLEDGED" }],
  },
  COMMERCIAL: {
    scope: "COMMERCIAL",
    documents: [
      { documentId: "AB-LEGAL-002", acceptanceType: "AGREED" },
      { documentId: "AB-LEGAL-004", acceptanceType: "AGREED" },
      { documentId: "AB-LEGAL-005", acceptanceType: "ACKNOWLEDGED" },
    ],
  },
};

export function getConsentBundleDefinition(scope: LegalConsentScopeId): ConsentBundleDefinition {
  if (scope === "CORE") return CORE_CONSENT_BUNDLE;
  return PRODUCT_CONSENT_BUNDLES[scope];
}

/**
 * Scopes with active enforcement.
 * CORE: unified onboarding. Product scopes: progressive first-use gates (Phase 3).
 */
export const ENFORCED_CONSENT_SCOPES: readonly LegalConsentScopeId[] = [
  "CORE",
  "BANK",
  "TERMINAL",
  "CRYPTO",
  "ALTA_PAY",
  "ALTA_CARD",
  "LENDING",
  "COMMERCIAL",
] as const;

export function isConsentScopeEnforced(scope: LegalConsentScopeId): boolean {
  return ENFORCED_CONSENT_SCOPES.includes(scope);
}

export type ResolvedConsentDocument = {
  documentId: string;
  title: string;
  label: string;
  version: string;
  slug: string;
  publicPath: string;
  acceptanceType: LegalAcceptanceTypeId;
  lastUpdated?: string;
};

export function resolveConsentDocumentRequirement(
  requirement: ConsentBundleDocumentRequirement,
): ResolvedConsentDocument {
  const doc = getLegalDocument(requirement.documentId);
  if (!doc) {
    throw new Error(`LEGAL_REGISTRY_MISSING:${requirement.documentId}`);
  }
  return toResolvedConsentDocument(doc, requirement.acceptanceType);
}

export function resolveConsentBundleDocuments(
  bundle: ConsentBundleDefinition,
): ResolvedConsentDocument[] {
  return bundle.documents.map(resolveConsentDocumentRequirement);
}

function toResolvedConsentDocument(
  doc: LegalDocumentDefinition,
  acceptanceType: LegalAcceptanceTypeId,
): ResolvedConsentDocument {
  return {
    documentId: doc.id,
    title: doc.title,
    label: doc.label,
    version: doc.version,
    slug: doc.slug,
    publicPath: legalDocumentPath(doc),
    acceptanceType,
    lastUpdated: doc.lastUpdated,
  };
}

/** Checkbox control groups for Minecraft-style product consent UI. */
export type ConsentControlGroup = {
  id: string;
  kind: "agree" | "acknowledge" | "authority";
  /** Document IDs covered by this control (empty for authority-only). */
  documentIds: string[];
  label: string;
};

export function getConsentControlGroups(scope: LegalConsentScopeId): ConsentControlGroup[] {
  switch (scope) {
    case "CORE":
      return [
        {
          id: "terms_aup",
          kind: "agree",
          documentIds: ["AG-LEGAL-001", "AG-LEGAL-004"],
          label:
            "I agree to the Alta Group Terms of Service and Acceptable Use Policy.",
        },
        {
          id: "privacy_electronic",
          kind: "acknowledge",
          documentIds: ["AG-LEGAL-002", "AG-LEGAL-005"],
          label:
            "I acknowledge the Privacy Policy and consent to electronic communications.",
        },
      ];
    case "BANK":
      return [
        {
          id: "deposit",
          kind: "agree",
          documentIds: ["AB-LEGAL-001"],
          label: "I agree to the Alta Bank Deposit Account Agreement.",
        },
        {
          id: "fees_transfers",
          kind: "acknowledge",
          documentIds: ["AB-LEGAL-005", "AB-LEGAL-008"],
          label:
            "I acknowledge the Fee Schedule and Transfers and Error Resolution Terms.",
        },
      ];
    case "TERMINAL":
      return [
        {
          id: "customer_trading",
          kind: "agree",
          documentIds: ["AT-LEGAL-001", "AT-LEGAL-002"],
          label:
            "I agree to the Alta Terminal Customer Agreement and Trading and Order Handling Terms.",
        },
        {
          id: "risk_data_fees",
          kind: "acknowledge",
          documentIds: ["AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"],
          label:
            "I acknowledge the Risk Disclosure, Market Data and Third-Party Services Terms, and Fee Schedule.",
        },
      ];
    case "CRYPTO":
      return [
        {
          id: "crypto_disclosure",
          kind: "acknowledge",
          documentIds: ["AT-LEGAL-006"],
          label:
            "I acknowledge the Alta Terminal Crypto Trading and Custody Disclosure.",
        },
      ];
    case "ALTA_PAY":
      return [
        {
          id: "alta_pay",
          kind: "agree",
          documentIds: ["AB-LEGAL-003"],
          label: "I agree to the Alta Pay Terms.",
        },
      ];
    case "ALTA_CARD":
      return [
        {
          id: "card_template",
          kind: "acknowledge",
          documentIds: ["AB-LEGAL-006"],
          label:
            "I acknowledge the general Alta Card terms template. An approved card may require acceptance of finalized card-specific terms before activation.",
        },
      ];
    case "LENDING":
      return [
        {
          id: "lending_template",
          kind: "acknowledge",
          documentIds: ["AB-LEGAL-007"],
          label:
            "I acknowledge the general lending agreement template. No loan exists until an offer or final agreement is presented and accepted.",
        },
      ];
    case "COMMERCIAL":
      return [
        {
          id: "business_merchant",
          kind: "agree",
          documentIds: ["AB-LEGAL-002", "AB-LEGAL-004"],
          label:
            "I agree to the Alta Bank Business Banking Agreement and Merchant Services Agreement.",
        },
        {
          id: "fee_schedule",
          kind: "acknowledge",
          documentIds: ["AB-LEGAL-005"],
          label: "I acknowledge the Fee Schedule.",
        },
        {
          id: "authority",
          kind: "authority",
          documentIds: [],
          label: "I confirm that I am authorized to accept these terms on behalf of this company.",
        },
      ];
  }
}
