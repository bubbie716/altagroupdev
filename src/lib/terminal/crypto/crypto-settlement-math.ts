/**
 * Pure helpers for average cost, realized gain/loss, price-impact gates, and candle bucket math.
 */

import { d, type CryptoDecimal, type CryptoDecimalInput } from "./crypto-decimal";
import {
  CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT,
  CRYPTO_PRICE_IMPACT_WARN_PERCENT,
  type CryptoOrderWarningCode,
} from "./crypto-order-types";

export function computeWeightedAverageCost(input: {
  previousQuantity: CryptoDecimalInput;
  previousAverageCost: CryptoDecimalInput;
  purchasedQuantity: CryptoDecimalInput;
  /** Total customer florin cost including fees. */
  totalCustomerCost: CryptoDecimalInput;
}): CryptoDecimal {
  const prevQty = d(input.previousQuantity);
  const buyQty = d(input.purchasedQuantity);
  const newQty = prevQty.plus(buyQty);
  if (!newQty.greaterThan(0)) return d("0");
  const prevCost = prevQty.mul(d(input.previousAverageCost));
  return prevCost.plus(d(input.totalCustomerCost)).div(newQty);
}

export function computeRealizedGainLoss(input: {
  soldQuantity: CryptoDecimalInput;
  averageCost: CryptoDecimalInput;
  netProceedsAfterFees: CryptoDecimalInput;
}): CryptoDecimal {
  const costBasis = d(input.soldQuantity).mul(d(input.averageCost));
  return d(input.netProceedsAfterFees).minus(costBasis);
}

export function absolutePriceImpactPercent(priceImpactPercent: CryptoDecimalInput): CryptoDecimal {
  return d(priceImpactPercent).abs();
}

export function buildPriceImpactWarnings(priceImpactPercent: CryptoDecimalInput): {
  warnings: Array<{ code: CryptoOrderWarningCode; message: string }>;
  requiresHighImpactConfirmation: boolean;
} {
  const abs = absolutePriceImpactPercent(priceImpactPercent);
  const warnings: Array<{ code: CryptoOrderWarningCode; message: string }> = [];
  const requiresHighImpactConfirmation = abs.greaterThanOrEqualTo(
    d(CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT),
  );
  if (abs.greaterThanOrEqualTo(d(CRYPTO_PRICE_IMPACT_WARN_PERCENT))) {
    warnings.push({
      code: "HIGH_PRICE_IMPACT",
      message: `Estimated price impact is ${abs.toFixed(2)}%.`,
    });
  }
  return { warnings, requiresHighImpactConfirmation };
}

/** Floor UTC timestamp to the start of its UTC minute for M1 candles. */
export function m1CandleIntervalStart(at: Date): Date {
  return new Date(
    Date.UTC(
      at.getUTCFullYear(),
      at.getUTCMonth(),
      at.getUTCDate(),
      at.getUTCHours(),
      at.getUTCMinutes(),
      0,
      0,
    ),
  );
}
