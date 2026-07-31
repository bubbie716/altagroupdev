/**
 * Strict input validation for crypto preview/submit. Rejects JS number financial values.
 */

import { d } from "./crypto-decimal";
import { LAUNCH_ASSET_SYMBOLS, type CryptoAssetSymbol } from "./crypto-constants";
import {
  CryptoOrderError,
  type CryptoOrderPreviewInput,
  type CryptoOrderSide,
  type CryptoOrderSubmitInput,
} from "./crypto-order-types";

const DECIMAL_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

function requireDecimalString(label: string, value: unknown): string {
  if (typeof value === "number") {
    throw new CryptoOrderError(
      "VALIDATION_FAILED",
      "Order amounts must be provided as decimal strings.",
      { [label]: "number_rejected" },
    );
  }
  if (typeof value !== "string" || !value.trim() || !DECIMAL_STRING.test(value.trim())) {
    throw new CryptoOrderError(
      "VALIDATION_FAILED",
      `Enter a valid ${label} as a decimal string.`,
      { [label]: String(value ?? "") },
    );
  }
  const normalized = value.trim();
  try {
    const parsed = d(normalized);
    if (!parsed.isFinite() || parsed.lessThanOrEqualTo(0)) {
      throw new CryptoOrderError(
        "VALIDATION_FAILED",
        `${label} must be greater than zero.`,
      );
    }
  } catch (error) {
    if (error instanceof CryptoOrderError) throw error;
    throw new CryptoOrderError("VALIDATION_FAILED", `Enter a valid ${label}.`);
  }
  return normalized;
}

export function normalizeCryptoSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function parseCryptoOrderPreviewInput(input: CryptoOrderPreviewInput): {
  portfolioId: string;
  symbol: string;
  side: CryptoOrderSide;
  grossFlorins: string | null;
  quantity: string | null;
} {
  const portfolioId = typeof input.portfolioId === "string" ? input.portfolioId.trim() : "";
  if (!portfolioId) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Choose a Terminal portfolio.");
  }
  if (input.side !== "BUY" && input.side !== "SELL") {
    throw new CryptoOrderError("VALIDATION_FAILED", "Choose buy or sell.");
  }
  const symbol = normalizeCryptoSymbol(String(input.symbol ?? ""));
  if (!symbol) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Choose a crypto asset.");
  }

  const hasGross = input.grossFlorins != null && String(input.grossFlorins).trim() !== "";
  const hasQty = input.quantity != null && String(input.quantity).trim() !== "";
  if (hasGross && hasQty) {
    throw new CryptoOrderError(
      "VALIDATION_FAILED",
      "Provide either a florin amount (buy) or a coin quantity (sell), not both.",
    );
  }

  if (input.side === "BUY") {
    if (!hasGross) {
      throw new CryptoOrderError("VALIDATION_FAILED", "Enter a florin amount to buy.");
    }
    return {
      portfolioId,
      symbol,
      side: "BUY",
      grossFlorins: requireDecimalString("gross florin amount", input.grossFlorins),
      quantity: null,
    };
  }

  if (!hasQty) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Enter a coin quantity to sell.");
  }
  return {
    portfolioId,
    symbol,
    side: "SELL",
    grossFlorins: null,
    quantity: requireDecimalString("coin quantity", input.quantity),
  };
}

export function parseCryptoOrderSubmitInput(input: CryptoOrderSubmitInput) {
  const base = parseCryptoOrderPreviewInput(input);
  const clientKey = typeof input.clientKey === "string" ? input.clientKey.trim() : "";
  if (!clientKey || clientKey.length < 8 || clientKey.length > 128) {
    throw new CryptoOrderError("VALIDATION_FAILED", "A valid order client key is required.");
  }
  if (
    typeof input.expectedMarketStateVersion !== "number" ||
    !Number.isInteger(input.expectedMarketStateVersion) ||
    input.expectedMarketStateVersion < 0
  ) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Missing market state version from preview.");
  }
  const quoteExpiresAt =
    typeof input.quoteExpiresAt === "string" ? input.quoteExpiresAt.trim() : "";
  const quoteFingerprint =
    typeof input.quoteFingerprint === "string" ? input.quoteFingerprint.trim() : "";
  if (!quoteExpiresAt || !quoteFingerprint) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Preview quote details are required to submit.");
  }
  return {
    ...base,
    clientKey,
    expectedMarketStateVersion: input.expectedMarketStateVersion,
    quoteExpiresAt,
    quoteFingerprint,
    acceptHighPriceImpact: Boolean(input.acceptHighPriceImpact),
  };
}

export function isLaunchAssetSymbol(symbol: string): symbol is CryptoAssetSymbol {
  return (LAUNCH_ASSET_SYMBOLS as string[]).includes(symbol);
}
