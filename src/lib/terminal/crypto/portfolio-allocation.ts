/**
 * Build portfolio allocation rows across stocks and crypto.
 * Weights use invested equity (stock market values + crypto marked values) as the
 * denominator — cash is excluded unless the product later defines total-value allocation.
 */

import type { CryptoPortfolioBalance } from "@/lib/terminal/crypto/crypto-market-read.service";
import type { Holding } from "@/lib/terminal/types";

export type PortfolioAllocationKind = "STOCK" | "CRYPTO";

export type PortfolioAllocationRow = {
  symbol: string;
  name: string;
  kind: PortfolioAllocationKind;
  marketValue: number;
  weightPercent: number;
};

export type PortfolioAllocationModel = {
  /** Explicit product definition shown near the Allocation heading. */
  basisLabel: "Invested holdings";
  basisDescription: string;
  rows: PortfolioAllocationRow[];
  investedEquity: number;
  /** Sum of displayed weights — may differ from 100 by normal 0.1% rounding. */
  weightSum: number;
};

function parseMarked(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildPortfolioAllocation(input: {
  holdings: Holding[];
  cryptoBalances?: CryptoPortfolioBalance[] | null;
}): PortfolioAllocationModel | null {
  const stockRows: PortfolioAllocationRow[] = [];
  for (const h of input.holdings) {
    if (h.marketValue == null || !Number.isFinite(h.marketValue) || h.marketValue <= 0) {
      continue;
    }
    stockRows.push({
      symbol: h.symbol,
      name: h.name,
      kind: "STOCK",
      marketValue: h.marketValue,
      weightPercent: 0,
    });
  }

  const cryptoRows: PortfolioAllocationRow[] = [];
  for (const b of input.cryptoBalances ?? []) {
    const marked = parseMarked(b.markedValue);
    if (marked == null) continue;
    cryptoRows.push({
      symbol: b.symbol,
      name: b.displayName,
      kind: "CRYPTO",
      marketValue: marked,
      weightPercent: 0,
    });
  }

  const rows = [...stockRows, ...cryptoRows];
  if (rows.length === 0) return null;

  const investedEquity = rows.reduce((sum, row) => sum + row.marketValue, 0);
  if (investedEquity <= 0) return null;

  for (const row of rows) {
    row.weightPercent = Number(((row.marketValue / investedEquity) * 100).toFixed(1));
  }

  // Absorb residual rounding into the largest weight so displayed sum ≈ 100.
  const weightSumRaw = rows.reduce((sum, row) => sum + row.weightPercent, 0);
  const residual = Number((100 - weightSumRaw).toFixed(1));
  if (residual !== 0 && rows.length > 0) {
    const largest = rows.reduce((best, row) =>
      row.marketValue > best.marketValue ? row : best,
    );
    largest.weightPercent = Number((largest.weightPercent + residual).toFixed(1));
  }

  const weightSum = rows.reduce((sum, row) => sum + row.weightPercent, 0);

  return {
    basisLabel: "Invested holdings",
    basisDescription:
      "Weights use stock and crypto marked values. Cash is not included in allocation.",
    rows,
    investedEquity,
    weightSum,
  };
}
