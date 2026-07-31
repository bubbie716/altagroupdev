import { createServerFn } from "@tanstack/react-start";
import type { SiteKey } from "@/config/sites";
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import { isLegalConsentScope } from "@/lib/legal/consent-scopes";

async function requireActor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchProductConsentStatus = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      scopes: LegalConsentScopeId[];
      companyId?: string | null;
      companyName?: string | null;
      uiLabScenario?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabProductConsentGateState } = await import(
        "@/lib/legal/ui-lab-product-consent"
      );
      return getUiLabProductConsentGateState(data);
    }

    const user = await requireActor();
    const scopes = data.scopes.filter(isLegalConsentScope);
    const { loadProductConsentGateState } = await import("@/server/product-consent.service");
    return loadProductConsentGateState({
      user,
      scopes,
      companyId: data.companyId,
      companyName: data.companyName,
    });
  });

export const fetchProductConsentPresentation = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      scope: LegalConsentScopeId;
      companyId?: string | null;
      companyName?: string | null;
      sequenceIndex?: number;
      sequenceTotal?: number;
      uiLabScenario?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabProductConsentPresentation } = await import(
        "@/lib/legal/ui-lab-product-consent"
      );
      return getUiLabProductConsentPresentation(data);
    }

    const user = await requireActor();
    if (!isLegalConsentScope(data.scope) || data.scope === "CORE") {
      throw new Error("INVALID_CONSENT_SCOPE");
    }
    const { buildProductConsentPresentation } = await import("@/server/product-consent.service");
    return buildProductConsentPresentation({
      userId: user.id,
      scope: data.scope,
      companyId: data.companyId,
      companyName: data.companyName,
      sequence:
        data.sequenceIndex && data.sequenceTotal
          ? { index: data.sequenceIndex, total: data.sequenceTotal }
          : null,
    });
  });

export const submitProductConsentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      scope: LegalConsentScopeId;
      sourceSite: SiteKey;
      companyId?: string | null;
      authorityConfirmed?: boolean;
      acceptedControlIds: string[];
      uiLabScenario?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabProductConsentSubmit } = await import(
        "@/lib/legal/ui-lab-product-consent"
      );
      const { uiLabScenario, ...payload } = data;
      return mockUiLabProductConsentSubmit(payload, uiLabScenario);
    }

    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Product consent acceptance");

    const user = await requireActor();
    const { submitProductConsent } = await import("@/server/product-consent.service");
    const { uiLabScenario: _ignored, ...payload } = data;
    void _ignored;
    return submitProductConsent(user, payload);
  });

export const fetchCustomerProductConsentSummary = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { canAccessBankInternal, isCorporateAdmin, canAccessTerminalInternal } = await import(
      "@/lib/auth/permissions"
    );
    const actor = await requireAuth();
    if (
      !canAccessBankInternal(actor) &&
      !isCorporateAdmin(actor) &&
      !canAccessTerminalInternal(actor)
    ) {
      throw new Error("FORBIDDEN");
    }

    const { getCustomerProductConsentSummary } = await import(
      "@/server/product-consent-summary.service"
    );
    return getCustomerProductConsentSummary(userId, actor);
  });

export const fetchCompanyCommercialConsentSummary = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { canAccessBankInternal, isCorporateAdmin } = await import("@/lib/auth/permissions");
    const actor = await requireAuth();
    if (!canAccessBankInternal(actor) && !isCorporateAdmin(actor)) {
      throw new Error("FORBIDDEN");
    }

    const { getCompanyCommercialConsentSummary } = await import(
      "@/server/product-consent-summary.service"
    );
    return getCompanyCommercialConsentSummary(companyId);
  });
