/**
 * Structured product-consent errors (safe for client + server).
 */
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";

export class ConsentRequiredError extends Error {
  readonly code = "CONSENT_REQUIRED" as const;
  readonly missingScopes: LegalConsentScopeId[];
  readonly companyId: string | null;

  constructor(missingScopes: LegalConsentScopeId[], companyId?: string | null) {
    super("CONSENT_REQUIRED");
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
  return (
    error instanceof ConsentRequiredError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "CONSENT_REQUIRED")
  );
}
