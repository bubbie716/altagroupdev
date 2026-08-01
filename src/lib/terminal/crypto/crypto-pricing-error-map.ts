/**
 * Map pricing-engine errors into customer-facing CryptoOrderError codes.
 */
import { CryptoPricingError } from "./crypto-pricing-types";
import { CryptoOrderError, customerMessageForCode } from "./crypto-order-types";

/** Throws a CryptoOrderError for pricing failures; rethrows CryptoOrderError unchanged. */
export function mapCryptoPricingError(error: unknown): never {
  if (error instanceof CryptoOrderError) throw error;
  if (error instanceof CryptoPricingError) {
    switch (error.code) {
      case "INSUFFICIENT_TREASURY":
      case "EXCEEDS_MAX_SUPPLY":
        throw new CryptoOrderError("SUPPLY_EXHAUSTED", customerMessageForCode("SUPPLY_EXHAUSTED"));
      case "INSUFFICIENT_WALLET_HOLDINGS":
        throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
      case "INSUFFICIENT_PROTECTED_RESERVE":
        throw new CryptoOrderError("RESERVE_INSUFFICIENT", customerMessageForCode("RESERVE_INSUFFICIENT"));
      case "BELOW_MINIMUM_ORDER":
      case "INVALID_INPUT":
      case "ASSET_KIND_MISMATCH":
        throw new CryptoOrderError("VALIDATION_FAILED", error.message);
      case "INVARIANT_VIOLATION":
        throw new CryptoOrderError(
          "VALIDATION_FAILED",
          "This order cannot be completed against the current market state.",
        );
      default:
        logUnexpectedCryptoOrderFailure("mapCryptoPricingError", error);
        throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
    }
  }
  if (
    error instanceof Error &&
    error.message.includes("TERMINAL_CRYPTO_QUOTE_SECRET")
  ) {
    throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
  }
  logUnexpectedCryptoOrderFailure("mapCryptoPricingError", error);
  throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
}

export function logUnexpectedCryptoOrderFailure(scope: string, error: unknown): void {
  if (error instanceof CryptoOrderError && error.code !== "INTERNAL_FAILURE") return;
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 4) }
      : { value: String(error) };
  console.error(`[terminal-crypto] ${scope}`, detail);
}
