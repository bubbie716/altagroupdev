import type { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";

type ConsentActionApi = NonNullable<ReturnType<typeof useOptionalProductConsentAction>>;

/**
 * Run a protected mutation through the progressive consent controller when available.
 * Falls back to a direct execute when outside ProductConsentActionProvider.
 */
export async function executeWithProductConsentResume<T>(
  execute: () => Promise<T>,
  consent: Pick<ConsentActionApi, "runWithConsent"> | null | undefined,
): Promise<T> {
  if (!consent) return execute();
  return consent.runWithConsent(execute);
}
