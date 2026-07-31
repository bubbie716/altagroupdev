/**
 * UI Lab + client helpers for action-level progressive consent enforcement.
 * Server production guards remain authoritative for live mutations.
 */
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import { ConsentRequiredError } from "@/lib/legal/consent-required-error";
import {
  getActionConsentRequirement,
  type ProductConsentActionKey,
} from "@/lib/legal/product-consent-requirements";
import {
  getUiLabProductConsentGateState,
  type UiLabAcceptedOverlay,
} from "@/lib/legal/ui-lab-product-consent";

/** Resume a protected action only when every required scope is current. */
export function canResumeProtectedAction(missingScopes: readonly LegalConsentScopeId[]): boolean {
  return missingScopes.length === 0;
}

/**
 * Progress label against the original missing set for this consent visit
 * (not the shrinking remaining list).
 */
export function actionConsentSequenceProgress(
  initialMissing: readonly LegalConsentScopeId[],
  currentScope: LegalConsentScopeId | null | undefined,
): { index: number; total: number } | null {
  if (!currentScope || initialMissing.length <= 1) return null;
  const progressIndex = initialMissing.indexOf(currentScope);
  if (progressIndex < 0) return null;
  return { index: progressIndex + 1, total: initialMissing.length };
}

export function assertUiLabProductConsentForAction(
  action: ProductConsentActionKey,
  options?: {
    uiLabScenario?: string;
    uiLabAcceptedOverlay?: UiLabAcceptedOverlay | null;
    companyId?: string | null;
  },
): void {
  const requirement = getActionConsentRequirement(action);
  const scopes = [...requirement.scopes] as LegalConsentScopeId[];
  const state = getUiLabProductConsentGateState({
    scopes,
    companyId: options?.companyId,
    uiLabScenario: options?.uiLabScenario,
    uiLabAcceptedOverlay:
      options && "uiLabAcceptedOverlay" in options
        ? options.uiLabAcceptedOverlay
        : undefined,
  });
  if (!canResumeProtectedAction(state.missingScopes)) {
    throw new ConsentRequiredError(state.missingScopes, options?.companyId ?? null);
  }
}

export function isConsentCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === "CONSENT_CANCELLED";
}
