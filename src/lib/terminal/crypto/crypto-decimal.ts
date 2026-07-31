/**
 * Alta Terminal fictional-crypto decimal precision and rounding policy.
 *
 * Authoritative math uses Prisma.Decimal only — never JS number/Math/parseFloat.
 *
 * Storage:
 * - Coin quantities: Decimal(28,8)
 * - Curve prices, rates, reserves, intermediates: ≥12 decimal places (calc uses 18)
 * - Customer cash ledger: florin cents Decimal(18,2)
 *
 * Rounding:
 * - Purchased coin quantity: ROUND_DOWN to quantity precision
 * - Customer florin payouts: ROUND_DOWN to 2 dp (never exceed available redemption)
 * - Rounding dust remains protected in the reserve system
 */

import { Prisma } from "@prisma/client";

export const CRYPTO_QUANTITY_DP = 8;
export const CRYPTO_PRICE_DP = 12;
export const CRYPTO_CURVE_CALC_DP = 18;
export const CRYPTO_MONEY_DP = 2;
export const CRYPTO_MIN_ORDER_GROSS = "1.00";

const Decimal = Prisma.Decimal;

export type CryptoDecimal = Prisma.Decimal;
export type CryptoDecimalInput = Prisma.Decimal | string | number;

export function d(value: CryptoDecimalInput): CryptoDecimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") {
    throw new TypeError(
      "Authoritative crypto math rejects JavaScript number inputs; pass a Decimal or decimal string.",
    );
  }
  // Dual-package / Prisma Decimal copies may fail `instanceof` — coerce via string.
  if (typeof value === "object" && value !== null && typeof (value as { toFixed?: unknown }).toFixed === "function") {
    return new Decimal((value as { toString: () => string }).toString());
  }
  return new Decimal(value);
}

/**
 * Presentation serializers may receive accidental JS numbers (e.g. `?? 0`).
 * Coerce numbers to decimal strings so a display bug cannot 500 a page loader.
 * Authoritative calc paths must still use `d()` / Decimal / decimal strings.
 */
function forSerialize(value: CryptoDecimalInput): CryptoDecimal {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("serializeCrypto* rejects non-finite numbers");
    }
    return new Decimal(String(value));
  }
  return d(value);
}

export function roundDownQuantity(value: CryptoDecimalInput, precision = CRYPTO_QUANTITY_DP): CryptoDecimal {
  return d(value).toDecimalPlaces(precision, Decimal.ROUND_DOWN);
}

export function roundDownMoney(value: CryptoDecimalInput): CryptoDecimal {
  return d(value).toDecimalPlaces(CRYPTO_MONEY_DP, Decimal.ROUND_DOWN);
}

export function roundPrice(value: CryptoDecimalInput, precision = CRYPTO_PRICE_DP): CryptoDecimal {
  return d(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
}

export function isPositive(value: CryptoDecimalInput): boolean {
  return d(value).greaterThan(0);
}

export function isNonNegative(value: CryptoDecimalInput): boolean {
  return d(value).greaterThanOrEqualTo(0);
}

export function assertNonNegative(label: string, value: CryptoDecimalInput): void {
  if (!isNonNegative(value)) {
    throw new Error(`${label} must be non-negative (got ${d(value).toFixed()})`);
  }
}

export function serializeCryptoQuantity(value: CryptoDecimalInput): string {
  return forSerialize(value).toDecimalPlaces(CRYPTO_QUANTITY_DP, Decimal.ROUND_DOWN).toFixed(CRYPTO_QUANTITY_DP);
}

export function serializeCryptoPrice(value: CryptoDecimalInput): string {
  return forSerialize(value).toDecimalPlaces(CRYPTO_PRICE_DP, Decimal.ROUND_HALF_UP).toFixed(CRYPTO_PRICE_DP);
}

export function serializeCryptoMoney(value: CryptoDecimalInput): string {
  return forSerialize(value).toDecimalPlaces(CRYPTO_MONEY_DP, Decimal.ROUND_DOWN).toFixed(CRYPTO_MONEY_DP);
}
