/**
 * Server functions for Alta Terminal fictional crypto preview + submit.
 * Production assets remain DRAFT — submit/preview reject them until later activation.
 * UI Lab uses demonstration fixtures only and never mutates production crypto tables.
 */
import { createServerFn } from "@tanstack/react-start";
import type { CryptoOrderPreviewInput, CryptoOrderSubmitInput } from "./crypto-order-types";
import {
  CRYPTO_ORDER_RATE_LIMIT_PER_MIN,
  CryptoOrderError,
  customerMessageForCode,
} from "./crypto-order-types";

async function requireActor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

function toClientError(error: unknown): {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, string>;
  preview?: unknown;
} {
  if (error instanceof CryptoOrderError) {
    return {
      ok: false,
      code: error.code,
      message: error.customerMessage,
      details: error.details,
      preview: error.preview,
    };
  }
  if (error instanceof Error) {
    if (error.message === "RATE_LIMITED") {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: customerMessageForCode("RATE_LIMITED"),
      };
    }
    if (error.message.startsWith("CONSENT_REQUIRED") || error.name === "ConsentRequiredError") {
      return {
        ok: false,
        code: "CONSENT_REQUIRED",
        message: customerMessageForCode("CONSENT_REQUIRED"),
      };
    }
  }
  return {
    ok: false,
    code: "INTERNAL_FAILURE",
    message: customerMessageForCode("INTERNAL_FAILURE"),
  };
}

/**
 * Preview is allowed without CRYPTO consent so customers can review estimates.
 * Submit requires `terminal.crypto_trade` (TERMINAL + CRYPTO).
 */
export const previewTerminalCryptoOrderFn = createServerFn({ method: "POST" })
  .inputValidator((input: CryptoOrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { previewUiLabCryptoOrder } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      return previewUiLabCryptoOrder(data);
    }

    const user = await requireActor();
    try {
      const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
      // Route already gates TERMINAL; keep explicit for consistency. CRYPTO not required for preview.
      await assertProductConsentForAction(user, "terminal.place_order");

      const { previewTerminalCryptoOrder } = await import(
        "@/lib/terminal/crypto/terminal-crypto-preview.service"
      );
      const preview = await previewTerminalCryptoOrder(user, data);
      return { ok: true as const, preview };
    } catch (error) {
      return toClientError(error);
    }
  });

export const submitTerminalCryptoOrderFn = createServerFn({ method: "POST" })
  .inputValidator((input: CryptoOrderSubmitInput) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { assertUiLabProductConsentForAction } = await import(
        "@/lib/legal/ui-lab-action-consent"
      );
      assertUiLabProductConsentForAction("terminal.crypto_trade");
      const { submitUiLabCryptoOrder } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      return submitUiLabCryptoOrder(data);
    }

    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto order");

    const user = await requireActor();
    try {
      const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
      await assertProductConsentForAction(user, "terminal.crypto_trade");

      const { assertUserRateLimit } = await import("@/server/rate-limit.service");
      assertUserRateLimit(user.id, "terminal-crypto-order", CRYPTO_ORDER_RATE_LIMIT_PER_MIN, 60_000);

      const { submitTerminalCryptoOrder } = await import(
        "@/lib/terminal/crypto/terminal-crypto-execution.service"
      );
      const result = await submitTerminalCryptoOrder(user, data);
      return result;
    } catch (error) {
      return toClientError(error);
    }
  });
