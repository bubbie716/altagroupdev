/**
 * Stable hashing and quote fingerprints for crypto order preview/submit.
 * Never uses insertion-order-dependent JSON.stringify on plain objects.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CRYPTO_QUOTE_TTL_MS } from "./crypto-order-types";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function stableSha256(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export type QuoteFingerprintPayload = {
  portfolioId: string;
  symbol: string;
  side: "BUY" | "SELL";
  grossFlorins: string | null;
  quantity: string | null;
  marketStateVersion: number;
  quoteExpiresAt: string;
};

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/**
 * Dedicated HMAC secret for crypto quote fingerprints.
 * Production requires TERMINAL_CRYPTO_QUOTE_SECRET (min 32 chars) — fail closed.
 * Explicit test/dev contexts may fall back to SESSION_SECRET or a fixed local secret.
 * Never log this value.
 */
export function resolveCryptoQuoteSecret(): string {
  const dedicated = process.env.TERMINAL_CRYPTO_QUOTE_SECRET?.trim();
  if (dedicated && dedicated.length >= 32) {
    return dedicated;
  }

  if (isProductionRuntime()) {
    throw new Error(
      "TERMINAL_CRYPTO_QUOTE_SECRET is required in production (min 32 characters). Crypto quotes are unavailable until configured.",
    );
  }

  const session = process.env.SESSION_SECRET?.trim();
  if (session && session.length >= 16) {
    return session;
  }

  return "alta-terminal-crypto-quote-dev-secret";
}

/** True when production crypto quoting can operate (dedicated secret present). */
export function isCryptoQuoteSecretConfigured(): boolean {
  try {
    if (isProductionRuntime()) {
      const dedicated = process.env.TERMINAL_CRYPTO_QUOTE_SECRET?.trim();
      return Boolean(dedicated && dedicated.length >= 32);
    }
    resolveCryptoQuoteSecret();
    return true;
  } catch {
    return false;
  }
}

function quoteSecret(): string {
  return resolveCryptoQuoteSecret();
}

export function createQuoteFingerprint(payload: QuoteFingerprintPayload): string {
  return createHmac("sha256", quoteSecret()).update(stableStringify(payload)).digest("hex");
}

export function verifyQuoteFingerprint(
  payload: QuoteFingerprintPayload,
  fingerprint: string,
): boolean {
  const expected = createQuoteFingerprint(payload);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(fingerprint, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildQuoteExpiry(now = new Date(), ttlMs = CRYPTO_QUOTE_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}

export function isQuoteExpired(expiresAt: string | Date, now = new Date()): boolean {
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() <= now.getTime();
}
