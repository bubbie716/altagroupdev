/**
 * Legal consent scopes for Alta product bundles.
 * CORE is enforced during onboarding; product scopes are enforced progressively on first use.
 */
export const LEGAL_CONSENT_SCOPES = [
  "CORE",
  "BANK",
  "TERMINAL",
  "ALTA_PAY",
  "ALTA_CARD",
  "LENDING",
  "COMMERCIAL",
] as const;

export type LegalConsentScopeId = (typeof LEGAL_CONSENT_SCOPES)[number];

export const LEGAL_ACCEPTANCE_TYPES = ["AGREED", "ACKNOWLEDGED", "CONSENTED"] as const;

export type LegalAcceptanceTypeId = (typeof LEGAL_ACCEPTANCE_TYPES)[number];

export const LEGAL_CONSENT_SUBJECT_TYPES = ["USER", "COMPANY"] as const;

export type LegalConsentSubjectTypeId = (typeof LEGAL_CONSENT_SUBJECT_TYPES)[number];

export function isLegalConsentScope(value: string): value is LegalConsentScopeId {
  return (LEGAL_CONSENT_SCOPES as readonly string[]).includes(value);
}

export function isLegalAcceptanceType(value: string): value is LegalAcceptanceTypeId {
  return (LEGAL_ACCEPTANCE_TYPES as readonly string[]).includes(value);
}

export function isLegalConsentSubjectType(value: string): value is LegalConsentSubjectTypeId {
  return (LEGAL_CONSENT_SUBJECT_TYPES as readonly string[]).includes(value);
}

export function humanizeConsentScope(scope: LegalConsentScopeId): string {
  switch (scope) {
    case "CORE":
      return "Core platform";
    case "BANK":
      return "Alta Bank";
    case "TERMINAL":
      return "Alta Terminal";
    case "ALTA_PAY":
      return "Alta Pay";
    case "ALTA_CARD":
      return "Alta Card";
    case "LENDING":
      return "Lending";
    case "COMMERCIAL":
      return "Commercial banking";
  }
}

export function humanizeAcceptanceType(type: LegalAcceptanceTypeId): string {
  switch (type) {
    case "AGREED":
      return "Agreed";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "CONSENTED":
      return "Consented";
  }
}
