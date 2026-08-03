/**
 * Shared helpers for Terminal crypto instrument detection and valuation merge.
 */
import { d } from "@/lib/terminal/crypto/crypto-decimal";
import type { CryptoPortfolioSummary } from "@/lib/terminal/crypto/crypto-market-read.service";
import type { PortfolioSnapshot } from "@/lib/terminal/types";

export {
  asCryptoAssetSymbol,
  isTerminalCryptoSymbol,
  type CryptoAssetSymbol,
} from "@/lib/terminal/crypto/crypto-symbols";

/**
 * Parse marked crypto florin value for presentation merge into JS number portfolio totals.
 * Uses Decimal parsing — not authoritative wallet math.
 */
export function parseCryptoMarkedValue(totalMarkedValue: string | null | undefined): number {
  if (totalMarkedValue == null || totalMarkedValue === "") return 0;
  try {
    const value = d(totalMarkedValue);
    if (!value.isFinite()) return 0;
    return value.toNumber();
  } catch {
    return 0;
  }
}

/**
 * Merge live crypto marked value into a stock/cash portfolio snapshot.
 * Crypto quantities stay on wallet balances — never TerminalPosition.
 *
 * Historical chart series are enriched separately via
 * `enrichPortfolioSnapshotWithCryptoHistory` (fills + candles only — never invented).
 */
export function mergePortfolioSnapshotWithCrypto(
  snapshot: PortfolioSnapshot,
  crypto: CryptoPortfolioSummary | null | undefined,
): PortfolioSnapshot {
  const cryptoMarked = parseCryptoMarkedValue(crypto?.totalMarkedValue);
  const cryptoDayChange =
    crypto?.dayChange != null ? parseCryptoMarkedValue(crypto.dayChange) : null;
  if (cryptoMarked <= 0 && cryptoDayChange == null) return snapshot;

  const baseTotal = snapshot.totalValue ?? snapshot.cashBalance;
  const baseEquity = snapshot.equityValue;
  const totalValue = baseTotal + cryptoMarked;
  const dayChange =
    snapshot.dayChange != null || cryptoDayChange != null
      ? (snapshot.dayChange ?? 0) + (cryptoDayChange ?? 0)
      : null;
  const prior = dayChange != null ? totalValue - dayChange : null;
  const dayChangePercent =
    dayChange == null
      ? snapshot.dayChangePercent
      : prior != null && Math.abs(prior) > 0.005
        ? (dayChange / Math.abs(prior)) * 100
        : 0;

  return {
    ...snapshot,
    // Cash stays authoritative; equity adds crypto marked value when stock equity exists,
    // otherwise crypto alone is the non-cash component.
    equityValue:
      baseEquity != null
        ? baseEquity + cryptoMarked
        : cryptoMarked > 0
          ? cryptoMarked
          : null,
    totalValue,
    dayChange,
    dayChangePercent,
  };
}
