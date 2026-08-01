/**
 * Customer/internal presentation formatters for Alta Terminal crypto.
 * Authoritative Decimal math stays in crypto-decimal / pricing — this module
 * formats only at the UI boundary and must never feed back into calculations.
 *
 * IMPORTANT: browser-safe. Do not import @prisma/client, crypto-decimal, or
 * crypto-constants (those pull server Decimal/Prisma into client chunks and
 * break production pages that only need display formatting).
 */

import {
  asCryptoAssetSymbol,
  CRYPTO_QUANTITY_DISPLAY_PRECISION,
  type CryptoAssetSymbol,
} from "@/lib/terminal/crypto/crypto-symbols";

export type CryptoFormatSymbol = CryptoAssetSymbol | string | null | undefined;

type DisplayDec = {
  /** Signed finite number used for comparisons / tone. */
  n: number;
  /** Absolute value as a finite number for digit selection. */
  abs: number;
  neg: boolean;
  zero: boolean;
};

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

function toDisplayDec(value: number | string): DisplayDec | null {
  try {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      const n = Object.is(value, -0) ? 0 : value;
      return { n, abs: Math.abs(n), neg: n < 0, zero: n === 0 };
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    const normalized = Object.is(n, -0) ? 0 : n;
    return {
      n: normalized,
      abs: Math.abs(normalized),
      neg: normalized < 0,
      zero: normalized === 0,
    };
  } catch {
    return null;
  }
}

/** HALF_UP round to `digits` fractional places using integer scaling. */
function roundHalfUpAbs(abs: number, digits: number): number {
  if (!Number.isFinite(abs)) return NaN;
  const factor = 10 ** digits;
  // Stabilize binary noise before scaling (mirrors prior 8dp stabilize for prices).
  return Math.round(abs * factor + Number.EPSILON) / factor;
}

function roundHalfUpSigned(n: number, digits: number): number {
  const abs = roundHalfUpAbs(Math.abs(n), digits);
  if (abs === 0) return 0;
  return n < 0 ? -abs : abs;
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
  const dec = toDisplayDec(value);
  const abs = dec?.abs ?? 0;

  if (asset === "NPFC") return 2;

  if (asset === "NVA") {
    if (opts?.forChange) {
      if (abs === 0) return 2;
      if (abs >= 0.01) return 2;
      if (abs >= 0.0001) return 4;
      return 6;
    }
    // Prefer 2 dp when clean; use 4 when sub-cent precision is meaningful.
    const at2 = roundHalfUpAbs(abs, 2);
    if (Math.abs(abs - at2) < 1e-12 && abs >= 1) return 2;
    return 4;
  }

  if (asset === "VLT") {
    if (opts?.forChange) {
      if (abs === 0) return 4;
      for (let digits = 4; digits <= 8; digits += 1) {
        if (roundHalfUpAbs(abs, digits) !== 0) return digits;
      }
      return 8;
    }
    if (abs >= 1) return 4;
    if (abs >= 0.0001) return 4;
    return 6;
  }

  if (abs >= 100) return 2;
  if (abs >= 1) return 2;
  return 4;
}

function formatAbsFlorin(abs: number, fractionDigits: number): string {
  const rounded = roundHalfUpAbs(abs, fractionDigits);
  return (
    "ƒ" +
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

/** Stabilize floating-point noise before display rounding (8 dp HALF_UP). */
function stabilizePrice(n: number): number {
  return roundHalfUpSigned(n, 8);
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
  const dec = toDisplayDec(value);
  if (!dec) return "—";
  const stable = stabilizePrice(dec.n);
  let digits = cryptoPriceFractionDigits(symbol, stable, {
    forChange: opts?.forChange,
  });
  if (opts?.fine) {
    const asset = asCryptoAssetSymbol(symbol ?? "");
    if (asset === "NVA") digits = Math.max(digits, 4);
    if (asset === "VLT") digits = Math.max(digits, 4);
  }
  const rounded = roundHalfUpSigned(stable, digits);
  if (rounded === 0) {
    return formatAbsFlorin(0, digits);
  }
  const body = formatAbsFlorin(Math.abs(rounded), digits);
  const negative = rounded < 0;
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
  const dec = toDisplayDec(value);
  if (!dec) return "—";
  const rounded = roundHalfUpSigned(dec.n, 2);
  if (rounded === 0) {
    return formatAbsFlorin(0, 2);
  }
  const body = formatAbsFlorin(Math.abs(rounded), 2);
  if (!opts?.signed) return rounded < 0 ? `-${body}` : body;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
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
  const dec = toDisplayDec(value);
  if (!dec) return "—";
  const rounded = roundHalfUpSigned(dec.n, 2);
  if (rounded === 0) return "0.00%";
  const body = `${Math.abs(rounded).toFixed(2)}%`;
  const signed = opts?.signed !== false;
  if (!signed) return rounded < 0 ? `-${body}` : body;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
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

/**
 * Format a coin quantity for customer UI.
 * Uses string/decimal digit math (not binary float) so large fills never show noise.
 * Applies asset display precision, trims trailing zeros, adds thousands separators.
 */
export function formatCryptoQuantityDisplay(
  quantity: number | string,
  symbol?: CryptoFormatSymbol,
): string {
  const asset = asCryptoAssetSymbol(symbol ?? "");
  const digits = asset ? Math.min(8, CRYPTO_QUANTITY_DISPLAY_PRECISION[asset]) : 8;
  const formatted = formatQuantityDigits(quantity, digits);
  if (!formatted) return String(quantity);
  return symbol ? `${formatted} ${String(symbol).toUpperCase()}` : formatted;
}

/** Format quantity digits with thousands separators; null when unparseable. */
export function formatQuantityDigits(
  quantity: number | string,
  fractionDigits: number,
): string | null {
  const raw =
    typeof quantity === "number"
      ? Object.is(quantity, -0) || quantity === 0
        ? "0"
        : Number.isFinite(quantity)
          ? String(quantity)
          : null
      : String(quantity ?? "").trim();
  if (raw == null || raw === "") return null;

  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  if (!/^(?:\d+)(?:\.\d+)?$/.test(body)) {
    const dec = toDisplayDec(quantity);
    if (!dec) return null;
    const fixed = dec.abs.toFixed(fractionDigits);
    const trimmed = trimTrailingZeros(fixed);
    return dec.neg && trimmed !== "0" ? `-${trimmed}` : trimmed;
  }

  const [wholeRaw, fracRaw = ""] = body.split(".");
  const digits = Math.max(0, Math.min(18, fractionDigits));
  const fracPadded = (fracRaw + "0".repeat(digits)).slice(0, digits);
  const extra = fracRaw.slice(digits);
  let fracInt = BigInt(fracPadded || "0");
  let wholeInt = BigInt(wholeRaw || "0");
  // HALF_UP from the next digit when truncating.
  if (extra.length > 0 && extra[0]! >= "5") {
    fracInt += 1n;
    const scale = 10n ** BigInt(digits);
    if (digits > 0 && fracInt >= scale) {
      fracInt -= scale;
      wholeInt += 1n;
    } else if (digits === 0) {
      wholeInt += 1n;
      fracInt = 0n;
    }
  }

  const wholeGrouped = wholeInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracStr = digits > 0 ? fracInt.toString().padStart(digits, "0") : "";
  const combined = digits > 0 ? `${wholeGrouped}.${fracStr}` : wholeGrouped;
  const trimmed = trimTrailingZeros(combined);
  // Never display negative zero.
  if (trimmed === "0") return "0";
  return neg ? `-${trimmed}` : trimmed;
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
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
