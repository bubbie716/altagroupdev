/**
 * High-impact acknowledgement UI state for crypto order tickets.
 * Server thresholds remain authoritative in crypto-settlement-math.
 *
 * Browser-safe: no Prisma / crypto-decimal imports.
 */

import {
  CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT,
  CRYPTO_PRICE_IMPACT_WARN_PERCENT,
} from "@/lib/terminal/crypto/crypto-order-types";

export const CRYPTO_IMPACT_WARN_THRESHOLD = Number(CRYPTO_PRICE_IMPACT_WARN_PERCENT);
export const CRYPTO_IMPACT_CONFIRM_THRESHOLD = Number(CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT);

export type CryptoImpactAckInput = {
  priceImpactPercent: string | number | null | undefined;
  requiresHighImpactConfirmation?: boolean;
  accepted: boolean;
};

export type CryptoImpactAckState = {
  absImpactPercent: number;
  showWarning: boolean;
  requiresAcknowledgement: boolean;
  submitEnabled: boolean;
  acknowledgementHintId: string;
};

export function absoluteImpactPercent(
  priceImpactPercent: string | number | null | undefined,
): number {
  if (priceImpactPercent == null || priceImpactPercent === "") return 0;
  const n =
    typeof priceImpactPercent === "number"
      ? priceImpactPercent
      : Number(String(priceImpactPercent).trim());
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/**
 * UI gate for Submit order. Does not replace server-side confirmation checks.
 */
export function resolveCryptoImpactAckState(
  input: CryptoImpactAckInput,
  hintId = "crypto-high-impact-ack",
): CryptoImpactAckState {
  const abs = absoluteImpactPercent(input.priceImpactPercent);
  const requiresAcknowledgement =
    input.requiresHighImpactConfirmation === true ||
    abs >= CRYPTO_IMPACT_CONFIRM_THRESHOLD;
  const showWarning = abs >= CRYPTO_IMPACT_WARN_THRESHOLD || requiresAcknowledgement;
  return {
    absImpactPercent: abs,
    showWarning,
    requiresAcknowledgement,
    submitEnabled: !requiresAcknowledgement || input.accepted,
    acknowledgementHintId: hintId,
  };
}

/** True when a requote's impact materially differs enough to reset acknowledgement. */
export function shouldResetHighImpactAcknowledgement(input: {
  previousImpactPercent: string | number | null | undefined;
  nextImpactPercent: string | number | null | undefined;
  previousRequired: boolean;
  nextRequired: boolean;
}): boolean {
  if (input.previousRequired !== input.nextRequired) return true;
  const prev = absoluteImpactPercent(input.previousImpactPercent);
  const next = absoluteImpactPercent(input.nextImpactPercent);
  return Math.abs(prev - next) >= 0.01;
}
