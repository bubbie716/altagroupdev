/**
 * Structured product-consent errors (safe for client + server).
 */
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import {
  encodeConsentRequiredMessage,
  parseConsentRequiredFromError,
} from "@/lib/legal/parse-consent-required";

export class ConsentRequiredError extends Error {
  readonly code = "CONSENT_REQUIRED" as const;
  readonly missingScopes: LegalConsentScopeId[];
  readonly companyId: string | null;

  constructor(missingScopes: LegalConsentScopeId[], companyId?: string | null) {
    super(encodeConsentRequiredMessage(missingScopes, companyId));
    this.name = "ConsentRequiredError";
    this.missingScopes = missingScopes;
    this.companyId = companyId ?? null;
  }

  toJSON() {
    return {
      code: this.code,
      missingScopes: this.missingScopes,
      companyId: this.companyId,
    };
  }
}

export function isConsentRequiredError(error: unknown): error is ConsentRequiredError {
  if (error instanceof ConsentRequiredError) return true;
  return parseConsentRequiredFromError(error) !== null;
}
