import { randomInt } from "node:crypto";
import { isValidAltaAccountNumber } from "@/lib/bank/account-number";

/**
 * NCC payment addresses are:
 *   routing number + opaque, institution-specific account identifier
 *
 * NCC does not standardize the internal structure of participant account
 * identifiers. Digits-only / fixed-length rules below are Alta Terminal
 * (or Alta Bank) policy — not network-wide requirements.
 *
 * Public API field names remain `sourceAccountNumber` / `destinationAccountNumber`
 * for v1 stability; values are opaque institution-specific strings (account identifiers).
 */

export const NCC_ACCOUNT_IDENTIFIER_MIN_LENGTH = 1;
export const NCC_ACCOUNT_IDENTIFIER_MAX_LENGTH = 64;

/** Alta Terminal / Exchange cash account identifiers are 12 digit characters (institution policy). */
export const TERMINAL_ACCOUNT_NUMBER_PATTERN = /^\d{12}$/;

export type NccAccountIdentifierEnvelopeResult =
  | { ok: true; value: string }
  | { ok: false; code: "INVALID_PAYMENT_ADDRESS" };

/**
 * Format-neutral NCC envelope validation. Does not change case, strip
 * punctuation, remove leading zeros, or apply any bank's account regex.
 * Preserves the submitted string exactly when valid.
 */
export function validateNccAccountIdentifierEnvelope(
  value: unknown,
): NccAccountIdentifierEnvelopeResult {
  if (typeof value !== "string") {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  // Reject empty and reject leading/trailing whitespace without mutating.
  if (value.length < NCC_ACCOUNT_IDENTIFIER_MIN_LENGTH) {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  if (value.length > NCC_ACCOUNT_IDENTIFIER_MAX_LENGTH) {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  if (value !== value.trim()) {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  // Control characters and null bytes.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  // Network edge: reject known internal DB id shapes as payment addresses.
  if (isLikelyInternalDatabaseId(value)) {
    return { ok: false, code: "INVALID_PAYMENT_ADDRESS" };
  }
  return { ok: true, value };
}

/**
 * Generate an Alta Terminal cash account identifier (digits-only, institution policy).
 * Returned as a string so leading zeros are preservable; never parse as Number/BigInt.
 */
export function generateTerminalAccountNumber(): string {
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += String(randomInt(0, 10));
  }
  return out;
}

export function isValidTerminalAccountNumber(accountNumber: string): boolean {
  // Terminal policy only — do not use for other institutions.
  return TERMINAL_ACCOUNT_NUMBER_PATTERN.test(accountNumber);
}

/**
 * Alta Bank institution-specific normalization (case-insensitive AB- prefix).
 * Not an NCC network rule.
 */
export function normalizeAltaBankAccountIdentifier(accountIdentifier: string): string {
  if (/^ab-/i.test(accountIdentifier)) return accountIdentifier.toUpperCase();
  return accountIdentifier;
}

/**
 * Format-neutral masking for logs/portal tables. Never mutates letter case of
 * the visible suffix; never parses as a number.
 */
export function maskAccountIdentifierForDisplay(accountIdentifier: string): string {
  const value = accountIdentifier;
  if (value.length <= 4) return "*".repeat(Math.max(value.length, 4));
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

/**
 * Optional prettier masks for known Alta display formats. Falls back to
 * format-neutral masking. Safe for any opaque identifier.
 */
export function maskPaymentAccountNumber(accountNumber: string): string {
  if (isValidAltaAccountNumber(accountNumber) || /^ab-\d{4}-\d{6}$/i.test(accountNumber)) {
    const upper = accountNumber.toUpperCase();
    const match = upper.match(/^AB-(\d{4})-(\d{6})$/);
    if (match) return `AB-${match[1]}-**${match[2].slice(-2)}`;
  }
  if (isValidTerminalAccountNumber(accountNumber)) {
    return `${"*".repeat(8)}${accountNumber.slice(-4)}`;
  }
  return maskAccountIdentifierForDisplay(accountNumber);
}

/**
 * @deprecated Do not use for NCC network validation. Institution adapters own
 * normalization. Kept as a no-op identity for any residual callers.
 */
export function normalizePaymentAccountNumber(accountNumber: string): string {
  return accountNumber;
}

export function isLikelyInternalDatabaseId(value: string): boolean {
  const v = value;
  // Prisma cuid() typically starts with 'c' and is 25 chars; reject cuid-like and uuid shapes.
  if (/^c[a-z0-9]{20,}$/i.test(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    return true;
  }
  return false;
}
