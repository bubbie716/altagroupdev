import type { AltaUser } from "@/lib/auth/types";
import type { ProductConsentActionKey } from "@/lib/legal/product-consent-requirements";
import {
  ConsentRequiredError,
  isConsentRequiredError,
} from "@/lib/legal/consent-required-error";
import { requireProductConsentForAction } from "@/server/product-consent.service";

export { ConsentRequiredError, isConsentRequiredError };

export async function assertProductConsentForAction(
  user: AltaUser,
  action: ProductConsentActionKey,
  options?: { companyId?: string | null },
): Promise<void> {
  await requireProductConsentForAction(user, action, options);
}

export function consentRequiredPayload(error: ConsentRequiredError) {
  return {
    code: "CONSENT_REQUIRED" as const,
    missingScopes: error.missingScopes,
    companyId: error.companyId,
  };
}
