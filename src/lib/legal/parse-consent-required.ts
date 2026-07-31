/**
 * Parse structured CONSENT_REQUIRED errors across the server→client wire.
 * TanStack server fns typically preserve Error.message only.
 */
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import { isLegalConsentScope } from "@/lib/legal/consent-scopes";

export type ConsentRequiredPayload = {
  code: "CONSENT_REQUIRED";
  missingScopes: LegalConsentScopeId[];
  companyId: string | null;
};

const PREFIX = "CONSENT_REQUIRED";

export function encodeConsentRequiredMessage(
  missingScopes: LegalConsentScopeId[],
  companyId?: string | null,
): string {
  return `${PREFIX}:${JSON.stringify({
    code: PREFIX,
    missingScopes,
    companyId: companyId ?? null,
  } satisfies ConsentRequiredPayload)}`;
}

export function parseConsentRequiredFromError(error: unknown): ConsentRequiredPayload | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "CONSENT_REQUIRED" &&
    "missingScopes" in error &&
    Array.isArray((error as { missingScopes?: unknown }).missingScopes)
  ) {
    const scopes = ((error as { missingScopes: unknown[] }).missingScopes).filter(
      (s): s is LegalConsentScopeId => typeof s === "string" && isLegalConsentScope(s),
    );
    if (scopes.length === 0) return null;
    return {
      code: "CONSENT_REQUIRED",
      missingScopes: scopes,
      companyId:
        typeof (error as { companyId?: unknown }).companyId === "string"
          ? (error as { companyId: string }).companyId
          : null,
    };
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = raw.replace(/^BAD_REQUEST:/, "").trim();
  if (!message.startsWith(PREFIX)) return null;

  if (message === PREFIX) {
    return { code: "CONSENT_REQUIRED", missingScopes: [], companyId: null };
  }

  const jsonPart = message.slice(PREFIX.length).replace(/^:/, "").trim();
  if (!jsonPart) {
    return { code: "CONSENT_REQUIRED", missingScopes: [], companyId: null };
  }

  try {
    const parsed = JSON.parse(jsonPart) as {
      missingScopes?: unknown;
      companyId?: unknown;
    };
    const scopes = Array.isArray(parsed.missingScopes)
      ? parsed.missingScopes.filter(
          (s): s is LegalConsentScopeId => typeof s === "string" && isLegalConsentScope(s),
        )
      : [];
    return {
      code: "CONSENT_REQUIRED",
      missingScopes: scopes,
      companyId: typeof parsed.companyId === "string" ? parsed.companyId : null,
    };
  } catch {
    return { code: "CONSENT_REQUIRED", missingScopes: [], companyId: null };
  }
}

export function isConsentRequiredWireError(error: unknown): boolean {
  return parseConsentRequiredFromError(error) !== null;
}
