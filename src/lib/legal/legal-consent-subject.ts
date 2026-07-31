/**
 * Stable legal-consent subject identity helpers.
 * USER subjects bind a person; COMPANY subjects bind a company (actor recorded separately).
 */
import type { LegalConsentSubjectTypeId } from "@/lib/legal/consent-scopes";

export type LegalConsentSubject =
  | { type: "USER"; userId: string }
  | { type: "COMPANY"; companyId: string };

export function userConsentSubjectKey(userId: string): string {
  return `user:${userId}`;
}

export function companyConsentSubjectKey(companyId: string): string {
  return `company:${companyId}`;
}

export function consentSubjectKey(subject: LegalConsentSubject): string {
  return subject.type === "USER"
    ? userConsentSubjectKey(subject.userId)
    : companyConsentSubjectKey(subject.companyId);
}

export function parseConsentSubjectKey(
  subjectKey: string,
): LegalConsentSubject | null {
  if (subjectKey.startsWith("user:")) {
    const userId = subjectKey.slice("user:".length);
    return userId ? { type: "USER", userId } : null;
  }
  if (subjectKey.startsWith("company:")) {
    const companyId = subjectKey.slice("company:".length);
    return companyId ? { type: "COMPANY", companyId } : null;
  }
  return null;
}

export function subjectTypeFromKey(subjectKey: string): LegalConsentSubjectTypeId | null {
  return parseConsentSubjectKey(subjectKey)?.type ?? null;
}

export function isCompanyScopedConsent(scope: string): boolean {
  return scope === "COMMERCIAL";
}
