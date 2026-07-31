/**
 * Pure portfolio-history merge for Alta Terminal fictional crypto.
 *
 * Valuation rules (honest / fail-closed):
 * - Quantities come only from executed wallet/order fills (BUY adds, SELL subtracts).
 * - Prices come from persisted candle closes, last known executed price, or NPFC ƒ1 peg.
 * - Crypto contributes nothing before the portfolio’s first applicable fill.
 * - Between traded candle periods, the last known real close is carried flat — never random.
 * - Never invents pre-launch holdings or fabricated volatility.
 * - Preserves the base stock/cash series; crypto marked value is added once per point.
 *
 * Presentation-only (JS number PricePoints). Not authoritative ledger math.
 */

import type { PricePoint } from "@/lib/terminal/types";

export type CryptoHistoryFill = {
  symbol: string;
  side: "BUY" | "SELL";
  /** Absolute coin quantity executed (always positive). */
  quantity: number;
  executedAtMs: number;
  /** Average execution price in florins — fallback when candles are missing. */
  executionPrice: number;
};

export type CryptoCandleClose = {
  /** Candle interval start (ms). */
  t: number;
  close: number;
};

export type CryptoAssetPricePolicy = {
  symbol: string;
  /** When set (NPFC), always value at this peg — ignore candles for price. */
  pegPrice?: number;
  candles: CryptoCandleClose[];
};

export type MergeCryptoPortfolioHistoryInput = {
  /** Existing stock/cash history. May be empty. */
  baseSeries: PricePoint[];
  fills: CryptoHistoryFill[];
  assets: CryptoAssetPricePolicy[];
  /**
   * Authoritative current crypto marked total (from live wallet summary).
   * Applied once to the final point so headline totalValue and chart end agree
   * without double-counting candle-derived marks.
   */
  currentCryptoMarkedValue?: number;
  /** Inclusive upper bound for generated points (default: max of inputs / now). */
  nowMs?: number;
  /**
   * When baseSeries is empty, seed a flat cash baseline so crypto is not shown
   * as the sole portfolio value. Omit or 0 for crypto-only contribution series.
   */
  cashBaseline?: number;
};

export type MergeCryptoPortfolioHistoryResult = {
  series: PricePoint[];
  cryptoContributed: boolean;
  firstCryptoFillAtMs: number | null;
  /** Non-null when the series is intentionally narrower than full market valuation. */
  scopeNote: string | null;
};

type QtyEvent = {
  atMs: number;
  symbol: string;
  delta: number;
  executionPrice: number;
};

function finiteNonNeg(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function sortPoints(points: PricePoint[]): PricePoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t)
    .filter((p, i, rows) => i === rows.length - 1 || p.t !== rows[i + 1]?.t);
}

/**
 * Resolve unit price for a symbol at time T from peg, candles (carry-forward), or last fill.
 */
export function resolveCryptoUnitPriceAt(input: {
  symbol: string;
  atMs: number;
  assets: CryptoAssetPricePolicy[];
  fills: CryptoHistoryFill[];
}): number | null {
  const symbol = normalizeSymbol(input.symbol);
  const asset = input.assets.find((a) => normalizeSymbol(a.symbol) === symbol);
  if (asset?.pegPrice != null && finiteNonNeg(asset.pegPrice)) {
    return asset.pegPrice;
  }

  const candles = [...(asset?.candles ?? [])]
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.close) && c.close >= 0)
    .sort((a, b) => a.t - b.t);

  let lastClose: number | null = null;
  for (const c of candles) {
    if (c.t > input.atMs) break;
    lastClose = c.close;
  }
  if (lastClose != null) return lastClose;

  // No candle at or before T — fall back to last known executed price at or before T.
  let lastExec: number | null = null;
  for (const fill of input.fills) {
    if (normalizeSymbol(fill.symbol) !== symbol) continue;
    if (fill.executedAtMs > input.atMs) continue;
    if (!finiteNonNeg(fill.executionPrice) || fill.executionPrice <= 0) continue;
    lastExec = fill.executionPrice;
  }
  return lastExec;
}

/**
 * Running quantity per symbol immediately after all fills with executedAtMs <= atMs.
 */
export function quantityHeldAt(
  fills: CryptoHistoryFill[],
  symbol: string,
  atMs: number,
): number {
  const target = normalizeSymbol(symbol);
  let qty = 0;
  const ordered = [...fills].sort((a, b) => a.executedAtMs - b.executedAtMs);
  for (const fill of ordered) {
    if (normalizeSymbol(fill.symbol) !== target) continue;
    if (fill.executedAtMs > atMs) break;
    if (!finiteNonNeg(fill.quantity) || fill.quantity === 0) continue;
    const delta = fill.side === "BUY" ? fill.quantity : -fill.quantity;
    qty = Math.max(0, qty + delta);
  }
  return qty;
}

/**
 * Marked crypto florin value for a portfolio at time T from fills + price policy.
 * Returns 0 before the first fill and whenever no real price is known.
 */
export function cryptoMarkedValueAt(input: {
  atMs: number;
  fills: CryptoHistoryFill[];
  assets: CryptoAssetPricePolicy[];
  firstCryptoFillAtMs: number | null;
}): number {
  if (input.firstCryptoFillAtMs == null || input.atMs < input.firstCryptoFillAtMs) {
    return 0;
  }

  const symbols = new Set<string>();
  for (const fill of input.fills) {
    if (fill.executedAtMs <= input.atMs) symbols.add(normalizeSymbol(fill.symbol));
  }

  let total = 0;
  for (const symbol of symbols) {
    const qty = quantityHeldAt(input.fills, symbol, input.atMs);
    if (qty <= 0) continue;
    const price = resolveCryptoUnitPriceAt({
      symbol,
      atMs: input.atMs,
      assets: input.assets,
      fills: input.fills,
    });
    if (price == null || price < 0) continue;
    total += qty * price;
  }
  return total;
}

function collectTimelineMs(input: MergeCryptoPortfolioHistoryInput, firstFillAt: number | null): number[] {
  const times = new Set<number>();
  for (const p of input.baseSeries) {
    if (Number.isFinite(p.t)) times.add(p.t);
  }
  for (const fill of input.fills) {
    if (Number.isFinite(fill.executedAtMs)) times.add(fill.executedAtMs);
  }
  for (const asset of input.assets) {
    for (const c of asset.candles) {
      if (!Number.isFinite(c.t)) continue;
      if (firstFillAt != null && c.t < firstFillAt) continue;
      times.add(c.t);
    }
  }
  const nowMs = input.nowMs ?? Date.now();
  if (Number.isFinite(nowMs)) times.add(nowMs);
  return [...times].sort((a, b) => a - b);
}

function baseValueAt(baseSeries: PricePoint[], atMs: number, cashBaseline: number): number {
  const sorted = sortPoints(baseSeries);
  if (sorted.length === 0) return cashBaseline;
  let last = sorted[0]!.v;
  for (const p of sorted) {
    if (p.t > atMs) break;
    last = p.v;
  }
  // Before the first base point, use cash baseline (not the first point's future value).
  if (sorted[0]!.t > atMs) return cashBaseline;
  return last;
}

/**
 * Merge crypto marked value into a stock/cash portfolio history series.
 */
export function mergeCryptoIntoPortfolioHistory(
  input: MergeCryptoPortfolioHistoryInput,
): MergeCryptoPortfolioHistoryResult {
  const fills = input.fills
    .filter(
      (f) =>
        Number.isFinite(f.executedAtMs) &&
        finiteNonNeg(f.quantity) &&
        finiteNonNeg(f.executionPrice) &&
        (f.side === "BUY" || f.side === "SELL"),
    )
    .map((f) => ({ ...f, symbol: normalizeSymbol(f.symbol) }))
    .sort((a, b) => a.executedAtMs - b.executedAtMs);

  const firstCryptoFillAtMs = fills.length > 0 ? fills[0]!.executedAtMs : null;
  const cashBaseline =
    input.cashBaseline != null && Number.isFinite(input.cashBaseline) ? input.cashBaseline : 0;
  const baseSorted = sortPoints(input.baseSeries);

  if (firstCryptoFillAtMs == null) {
    return {
      series: baseSorted,
      cryptoContributed: false,
      firstCryptoFillAtMs: null,
      scopeNote:
        baseSorted.length === 0
          ? "Portfolio history has no crypto fills; series remains stock/cash-only (or empty)."
          : null,
    };
  }

  const timeline = collectTimelineMs(input, firstCryptoFillAtMs);
  if (timeline.length === 0) {
    return {
      series: baseSorted,
      cryptoContributed: false,
      firstCryptoFillAtMs,
      scopeNote: "No timeline points available to merge crypto history.",
    };
  }

  const assets: CryptoAssetPricePolicy[] = input.assets.map((a) => ({
    ...a,
    symbol: normalizeSymbol(a.symbol),
    candles: [...a.candles].sort((x, y) => x.t - y.t),
  }));

  const series: PricePoint[] = [];
  for (const t of timeline) {
    const base = baseValueAt(baseSorted, t, cashBaseline);
    const crypto = cryptoMarkedValueAt({
      atMs: t,
      fills,
      assets,
      firstCryptoFillAtMs,
    });
    series.push({ t, v: base + crypto });
  }

  // Align the final point's crypto component with live marked value once (no double-count).
  if (
    input.currentCryptoMarkedValue != null &&
    Number.isFinite(input.currentCryptoMarkedValue) &&
    series.length > 0
  ) {
    const last = series[series.length - 1]!;
    const baseAtEnd = baseValueAt(baseSorted, last.t, cashBaseline);
    last.v = baseAtEnd + Math.max(0, input.currentCryptoMarkedValue);
  }

  const stockCashOnly = baseSorted.length > 0;
  const scopeNote =
    !stockCashOnly && cashBaseline === 0
      ? "Series reflects crypto fills and prices only; stock/cash history was empty."
      : null;

  return {
    series: sortPoints(series),
    cryptoContributed: true,
    firstCryptoFillAtMs,
    scopeNote,
  };
}

/**
 * Slice a merged series into a chart range window (inclusive of end).
 * Points before `sinceMs` are dropped; the last known value at sinceMs is carried in.
 */
export function slicePortfolioHistoryForRange(
  series: PricePoint[],
  sinceMs: number,
  nowMs: number = Date.now(),
): PricePoint[] {
  const sorted = sortPoints(series).filter((p) => p.t <= nowMs);
  if (sorted.length === 0) return [];

  const inWindow = sorted.filter((p) => p.t >= sinceMs);
  if (inWindow.length > 0) {
    // Carry last known value at the window start when the first in-window point is later.
    const prior = sorted.filter((p) => p.t < sinceMs);
    if (prior.length > 0 && inWindow[0]!.t > sinceMs) {
      return sortPoints([{ t: sinceMs, v: prior[prior.length - 1]!.v }, ...inWindow]);
    }
    return inWindow;
  }

  // No points in window — flat carry of last known value if any exists before since.
  const prior = sorted.filter((p) => p.t <= sinceMs);
  if (prior.length === 0) return [];
  const v = prior[prior.length - 1]!.v;
  return [
    { t: sinceMs, v },
    { t: nowMs, v },
  ];
}

/** Chart range windows aligned with crypto candle loaders. */
export function portfolioHistoryRangeSinceMs(
  range: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL",
  nowMs: number = Date.now(),
): number {
  const day = 86_400_000;
  switch (range) {
    case "1D":
      return nowMs - day;
    case "1W":
      return nowMs - 7 * day;
    case "1M":
      return nowMs - 30 * day;
    case "3M":
      return nowMs - 90 * day;
    case "1Y":
      return nowMs - 365 * day;
    case "ALL":
      return 0;
  }
}

/** @internal exported for tests — build qty events from fills. */
export function cryptoFillQuantityEvents(fills: CryptoHistoryFill[]): QtyEvent[] {
  return fills
    .filter((f) => finiteNonNeg(f.quantity) && f.quantity > 0)
    .map((f) => ({
      atMs: f.executedAtMs,
      symbol: normalizeSymbol(f.symbol),
      delta: f.side === "BUY" ? f.quantity : -f.quantity,
      executionPrice: f.executionPrice,
    }))
    .sort((a, b) => a.atMs - b.atMs);
}
