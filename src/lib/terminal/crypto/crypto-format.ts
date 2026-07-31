/**
 * Customer/internal presentation formatters for Alta Terminal crypto.
 * Authoritative Decimal math stays in crypto-decimal / pricing — this module
 * formats only at the UI boundary and must never feed back into calculations.
 */

import { Prisma } from "@prisma/client";
import {
  CRYPTO_ASSET_CONFIGS,
  type CryptoAssetSymbol,
} from "@/lib/terminal/crypto/crypto-constants";
import { asCryptoAssetSymbol } from "@/lib/terminal/crypto/crypto-instrument";

export type CryptoFormatSymbol = CryptoAssetSymbol | string | null | undefined;

const Decimal = Prisma.Decimal;

/** Collapse IEEE/-0 and values that round to zero at the chosen precision. */
export function normalizeDisplaySignedZero(
  value: number,
  fractionDigits: number,
): number {
  if (!Number.isFinite(value)) return 0;
  if (Object.is(value, -0) || value === 0) return 0;
  const factor = 10 ** Math.max(0, fractionDigits);
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  if (rounded === 0) return 0;
  return value;
}

function toDecimal(value: number | string): Prisma.Decimal | null {
  try {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return new Decimal(value);
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    return new Decimal(trimmed);
  } catch {
    return null;
  }
}

/**
 * Asset-aware price fraction digits for customer display.
 * NPFC: 2. NVA: 2–4. VLT: ≥4, expand only when needed to show a nonzero change.
 */
export function cryptoPriceFractionDigits(
  symbol: CryptoFormatSymbol,
  value: number | string,
  opts?: { forChange?: boolean },
): number {
  const asset = asCryptoAssetSymbol(symbol ?? "");
  const dec = toDecimal(value);
  const abs = dec ? dec.abs() : new Decimal(0);
  const absNum = abs.toNumber();

  if (asset === "NPFC") return 2;

  if (asset === "NVA") {
    if (opts?.forChange) {
      if (abs.isZero()) return 2;
      if (abs.greaterThanOrEqualTo("0.01")) return 2;
      if (abs.greaterThanOrEqualTo("0.0001")) return 4;
      return 6;
    }
    // Prefer 2 dp when clean; use 4 when sub-cent precision is meaningful.
    const at2 = abs.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (abs.equals(at2) && abs.greaterThanOrEqualTo(1)) return 2;
    return 4;
  }

  if (asset === "VLT") {
    if (opts?.forChange) {
      if (abs.isZero()) return 4;
      for (let digits = 4; digits <= 8; digits += 1) {
        if (!abs.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).isZero()) return digits;
      }
      return 8;
    }
    if (absNum >= 1) return 4;
    if (absNum >= 0.0001) return 4;
    return 6;
  }

  if (absNum >= 100) return 2;
  if (absNum >= 1) return 2;
  return 4;
}

function formatAbsFlorin(abs: Prisma.Decimal, fractionDigits: number): string {
  const rounded = abs.toDecimalPlaces(fractionDigits, Decimal.ROUND_HALF_UP);
  const asNumber = rounded.toNumber();
  return (
    "ƒ" +
    asNumber.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

/** Stabilize floating-point noise before display rounding. */
function stabilizePrice(dec: Prisma.Decimal): Prisma.Decimal {
  // Round through 8 dp first so values like 5.006249999997 become 5.00625,
  // then customer digits can HALF_UP to 5.0063.
  return dec.toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
}

/**
 * Format a crypto mark/execution price for customer UI.
 * Never emits negative-zero strings.
 */
export function formatCryptoPrice(
  value: number | string,
  symbol?: CryptoFormatSymbol,
  opts?: { signed?: boolean; forChange?: boolean; fine?: boolean },
): string {
  const dec = toDecimal(value);
  if (!dec) return "—";
  const stable = stabilizePrice(dec);
  let digits = cryptoPriceFractionDigits(symbol, stable.toFixed(), {
    forChange: opts?.forChange,
  });
  if (opts?.fine) {
    const asset = asCryptoAssetSymbol(symbol ?? "");
    if (asset === "NVA") digits = Math.max(digits, 4);
    if (asset === "VLT") digits = Math.max(digits, 4);
  }
  const rounded = stable.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) {
    return formatAbsFlorin(new Decimal(0), digits);
  }
  const body = formatAbsFlorin(rounded.abs(), digits);
  const negative = rounded.isNeg();
  if (!opts?.signed) return negative ? `-${body}` : body;
  if (!negative) return `+${body}`;
  return `-${body}`;
}

/**
 * Florin totals (cash, fees, portfolio value, marked holdings) — always 2 dp.
 * Never emits negative-zero strings.
 */
export function formatCryptoMoney(
  value: number | string,
  opts?: { signed?: boolean },
): string {
  const dec = toDecimal(value);
  if (!dec) return "—";
  const rounded = dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) {
    return formatAbsFlorin(new Decimal(0), 2);
  }
  const body = formatAbsFlorin(rounded.abs(), 2);
  if (!opts?.signed) return rounded.isNeg() ? `-${body}` : body;
  if (rounded.greaterThan(0)) return `+${body}`;
  if (rounded.isNeg()) return `-${body}`;
  return body;
}

/**
 * Absolute day/session change amount for a crypto asset (asset-aware precision).
 */
export function formatCryptoChangeAmount(
  value: number | string,
  symbol?: CryptoFormatSymbol,
  opts?: { signed?: boolean },
): string {
  return formatCryptoPrice(value, symbol, {
    signed: opts?.signed ?? true,
    forChange: true,
  });
}

/**
 * Percent display; collapses signed zero after 2-dp rounding.
 */
export function formatCryptoPercent(
  value: number | string,
  opts?: { signed?: boolean },
): string {
  const dec = toDecimal(value);
  if (!dec) return "—";
  const rounded = dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) return "0.00%";
  const body = `${rounded.abs().toFixed(2)}%`;
  const signed = opts?.signed !== false;
  if (!signed) return rounded.isNeg() ? `-${body}` : body;
  if (rounded.greaterThan(0)) return `+${body}`;
  if (rounded.isNeg()) return `-${body}`;
  return body;
}

/**
 * Round a high-precision quote/price string for customer display without
 * mutating the original string used for signing / version checks.
 */
export function formatCryptoDisplayPriceFromRaw(
  raw: string,
  symbol?: CryptoFormatSymbol,
): string {
  return formatCryptoPrice(raw, symbol, { fine: true });
}

export function formatCryptoPriceTransition(
  beforeRaw: string,
  afterRaw: string,
  symbol?: CryptoFormatSymbol,
): string {
  return `${formatCryptoDisplayPriceFromRaw(beforeRaw, symbol)} → ${formatCryptoDisplayPriceFromRaw(afterRaw, symbol)}`;
}

export function formatCryptoQuantityDisplay(
  quantity: number | string,
  symbol?: CryptoFormatSymbol,
): string {
  const dec = toDecimal(quantity);
  if (!dec) return String(quantity);
  const asset = asCryptoAssetSymbol(symbol ?? "");
  const digits = asset
    ? Math.min(8, CRYPTO_ASSET_CONFIGS[asset].quantityPrecision)
    : 8;
  const fixed = dec.toFixed(digits);
  const trimmed = fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return symbol ? `${trimmed} ${String(symbol).toUpperCase()}` : trimmed;
}

export function cryptoMarketStatusLabel(operational = true): string {
  return operational ? "Crypto · 24/7" : "Crypto · unavailable";
}

/**
 * Sign/tone helper after display normalization — avoids painting "down" for -0.
 */
export function cryptoChangeTone(
  amount: number | null | undefined,
  percent: number | null | undefined,
  symbol?: CryptoFormatSymbol,
): "up" | "down" | "flat" {
  if (amount == null && percent == null) return "flat";
  const amountDigits =
    amount == null
      ? 2
      : cryptoPriceFractionDigits(symbol, amount, { forChange: true });
  const normAmount =
    amount == null ? 0 : normalizeDisplaySignedZero(amount, amountDigits);
  const normPercent =
    percent == null ? 0 : normalizeDisplaySignedZero(percent, 2);
  if (normAmount > 0 || (normAmount === 0 && normPercent > 0)) return "up";
  if (normAmount < 0 || normPercent < 0) return "down";
  return "flat";
}

/** Guard: no negative-zero florin substring in a rendered string. */
export function containsNegativeZeroFlorin(text: string): boolean {
  // Match -ƒ0 / -ƒ0.00 / -ƒ0.0000 but not -ƒ0.0020 or -ƒ0.10
  return /-[ƒf]0(?:\.0+)?(?![\d.])/.test(text);
}

export function assertNoNegativeZeroFlorin(text: string): void {
  if (containsNegativeZeroFlorin(text)) {
    throw new Error(`Negative-zero florin display: ${text}`);
  }
}
