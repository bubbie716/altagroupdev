/**
 * Load real crypto fills + candles and merge into Terminal portfolio chart history.
 * Never fabricates prices or pre-launch holdings.
 */
import type { PortfolioSnapshot, PricePoint, TerminalChartRange } from "@/lib/terminal/types";
import { prisma } from "@/server/db";
import { CRYPTO_ASSET_CONFIGS, type CryptoAssetSymbol } from "./crypto-constants";
import { parseCryptoMarkedValue } from "./crypto-instrument";
import {
  mergeCryptoIntoPortfolioHistory,
  portfolioHistoryRangeSinceMs,
  slicePortfolioHistoryForRange,
  type CryptoAssetPricePolicy,
  type CryptoHistoryFill,
} from "./crypto-portfolio-history";
import { getPortfolioCryptoSummary } from "./crypto-market-read.service";

const RANGES: TerminalChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

function emptySeries(): Record<TerminalChartRange, PricePoint[]> {
  return {
    "1D": [],
    "1W": [],
    "1M": [],
    "3M": [],
    "1Y": [],
    ALL: [],
  };
}

function isLaunchSymbol(symbol: string): symbol is CryptoAssetSymbol {
  return Object.prototype.hasOwnProperty.call(CRYPTO_ASSET_CONFIGS, symbol);
}

/**
 * Reconstruct stock/cash baseline from the immutable cash ledger (balance after each post).
 * Does not invent equity marks for TSE positions.
 */
export async function loadCashLedgerHistorySeries(portfolioId: string): Promise<PricePoint[]> {
  const rows = await prisma.terminalCashLedgerEntry.findMany({
    where: { portfolioId, status: "POSTED" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, availableCashAfter: true },
  });
  const points: PricePoint[] = [];
  for (const row of rows) {
    const v = Number.parseFloat(row.availableCashAfter.toString());
    if (!Number.isFinite(v)) continue;
    points.push({ t: row.createdAt.getTime(), v });
  }
  return points;
}

/**
 * Load portfolio crypto fills from TerminalOrder + TerminalCryptoOrderSettlement.
 */
export async function loadPortfolioCryptoHistoryFills(
  portfolioId: string,
): Promise<CryptoHistoryFill[]> {
  const orders = await prisma.terminalOrder.findMany({
    where: {
      portfolioId,
      instrumentKind: "CRYPTO",
      executionVenue: "ALTA_CRYPTO",
      status: "FILLED",
      cryptoSettlement: { isNot: null },
    },
    include: {
      cryptoSettlement: true,
    },
    orderBy: { completedAt: "asc" },
  });

  const fills: CryptoHistoryFill[] = [];
  for (const order of orders) {
    const settlement = order.cryptoSettlement;
    if (!settlement) continue;
    const qty = Number.parseFloat(settlement.executedQuantity.toString());
    const price = Number.parseFloat(settlement.averageExecutionPrice.toString());
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    const executedAt = settlement.executedAt ?? order.completedAt ?? order.submittedAt;
    fills.push({
      symbol: order.symbol,
      side: order.side,
      quantity: qty,
      executedAtMs: executedAt.getTime(),
      executionPrice: price,
    });
  }
  return fills;
}

async function loadAssetPricePolicies(
  symbols: string[],
): Promise<CryptoAssetPricePolicy[]> {
  if (symbols.length === 0) return [];

  const assets = await prisma.terminalCryptoAsset.findMany({
    where: { symbol: { in: symbols } },
    select: {
      id: true,
      symbol: true,
      kind: true,
      pegOrStartingPrice: true,
      priceCandles: {
        where: { interval: { in: ["M1", "D1"] } },
        orderBy: { intervalStart: "asc" },
        select: {
          intervalStart: true,
          close: true,
          tradeCount: true,
        },
      },
    },
  });

  return assets.map((asset) => {
    const symbol = asset.symbol.toUpperCase();
    const peg =
      asset.kind === "STABLE" || (isLaunchSymbol(symbol) && CRYPTO_ASSET_CONFIGS[symbol].kind === "STABLE")
        ? Number.parseFloat(asset.pegOrStartingPrice.toString()) || 1
        : undefined;

    // Prefer D1 closes for long-range carry; include M1 closes for intraday density.
    // Only use candles that recorded real trades — empty carry rows without trades are skipped
    // so we do not treat fabricated flat candles as new information (last close still carries in merge).
    const candles = asset.priceCandles
      .filter((c) => c.tradeCount > 0)
      .map((c) => ({
        t: c.intervalStart.getTime(),
        close: Number.parseFloat(c.close.toString()),
      }))
      .filter((c) => Number.isFinite(c.close) && c.close >= 0);

    return {
      symbol,
      pegPrice: peg != null && Number.isFinite(peg) ? peg : undefined,
      candles,
    };
  });
}

export type PortfolioHistoryMergeMeta = {
  cryptoContributed: boolean;
  firstCryptoFillAtMs: number | null;
  scopeNote: string | null;
};

/**
 * Build per-range portfolio chart series: cash ledger (stock/cash baseline) + honest crypto merge.
 */
export async function buildPortfolioHistorySeriesByRange(
  portfolioId: string,
  opts?: {
    /** When provided, used as flat cash baseline if ledger history is empty. */
    cashBalance?: number;
    nowMs?: number;
  },
): Promise<{
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
  meta: PortfolioHistoryMergeMeta;
}> {
  const nowMs = opts?.nowMs ?? Date.now();
  const [baseSeries, fills, cryptoSummary] = await Promise.all([
    loadCashLedgerHistorySeries(portfolioId),
    loadPortfolioCryptoHistoryFills(portfolioId),
    getPortfolioCryptoSummary(portfolioId),
  ]);

  const symbols = [...new Set(fills.map((f) => f.symbol.toUpperCase()))];
  const assets = await loadAssetPricePolicies(symbols);
  const currentCryptoMarkedValue = parseCryptoMarkedValue(cryptoSummary.totalMarkedValue);
  const cashBaseline =
    opts?.cashBalance != null && Number.isFinite(opts.cashBalance)
      ? opts.cashBalance
      : baseSeries.length > 0
        ? baseSeries[baseSeries.length - 1]!.v
        : 0;

  // Ensure a terminal cash point so current cash + live crypto mark can align.
  let baseWithNow = baseSeries;
  if (baseSeries.length === 0 && cashBaseline > 0) {
    baseWithNow = [{ t: nowMs, v: cashBaseline }];
  } else if (baseSeries.length > 0) {
    const last = baseSeries[baseSeries.length - 1]!;
    if (last.t < nowMs || last.v !== cashBaseline) {
      baseWithNow = [...baseSeries, { t: nowMs, v: cashBaseline }];
    }
  }

  const merged = mergeCryptoIntoPortfolioHistory({
    baseSeries: baseWithNow,
    fills,
    assets,
    currentCryptoMarkedValue:
      currentCryptoMarkedValue > 0 ? currentCryptoMarkedValue : undefined,
    nowMs,
    cashBaseline,
  });

  const seriesByRange = emptySeries();
  for (const range of RANGES) {
    seriesByRange[range] = slicePortfolioHistoryForRange(
      merged.series,
      portfolioHistoryRangeSinceMs(range, nowMs),
      nowMs,
    );
  }

  return {
    seriesByRange,
    meta: {
      cryptoContributed: merged.cryptoContributed,
      firstCryptoFillAtMs: merged.firstCryptoFillAtMs,
      scopeNote: merged.scopeNote,
    },
  };
}

/**
 * Attach merged cash+crypto history onto a local portfolio snapshot.
 * Preserves existing series when already populated (e.g. future TSE equity history);
 * otherwise builds from cash ledger + crypto fills.
 */
export async function enrichPortfolioSnapshotWithCryptoHistory(
  snapshot: PortfolioSnapshot,
): Promise<PortfolioSnapshot> {
  try {
    const hasExistingSeries = RANGES.some((r) => (snapshot.seriesByRange[r] ?? []).length > 0);

    if (hasExistingSeries) {
      // Merge crypto into each existing range series independently (preserve stock marks).
      const fills = await loadPortfolioCryptoHistoryFills(snapshot.portfolioId);
      if (fills.length === 0) return snapshot;

      const symbols = [...new Set(fills.map((f) => f.symbol.toUpperCase()))];
      const assets = await loadAssetPricePolicies(symbols);
      const cryptoSummary = await getPortfolioCryptoSummary(snapshot.portfolioId);
      const currentCryptoMarkedValue = parseCryptoMarkedValue(cryptoSummary.totalMarkedValue);
      const nowMs = Date.now();

      const seriesByRange = emptySeries();
      for (const range of RANGES) {
        const base = snapshot.seriesByRange[range] ?? [];
        const merged = mergeCryptoIntoPortfolioHistory({
          baseSeries: base,
          fills,
          assets,
          currentCryptoMarkedValue:
            currentCryptoMarkedValue > 0 ? currentCryptoMarkedValue : undefined,
          nowMs,
          cashBaseline: snapshot.cashBalance,
        });
        seriesByRange[range] = slicePortfolioHistoryForRange(
          merged.series,
          portfolioHistoryRangeSinceMs(range, nowMs),
          nowMs,
        );
      }
      return { ...snapshot, seriesByRange };
    }

    const { seriesByRange } = await buildPortfolioHistorySeriesByRange(snapshot.portfolioId, {
      cashBalance: snapshot.cashBalance,
    });
    const hasPoints = RANGES.some((r) => seriesByRange[r].length > 0);
    if (!hasPoints) return snapshot;

    // Day change from 1D series when we have real reconstructed history.
    const day = seriesByRange["1D"];
    let dayChange: number | null = snapshot.dayChange;
    let dayChangePercent: number | null = snapshot.dayChangePercent;
    if (day.length >= 2) {
      const start = day[0]!.v;
      const end = day[day.length - 1]!.v;
      dayChange = end - start;
      dayChangePercent = start !== 0 ? ((end - start) / Math.abs(start)) * 100 : null;
    }

    return {
      ...snapshot,
      seriesByRange,
      dayChange,
      dayChangePercent,
    };
  } catch {
    // Fail closed: leave snapshot unchanged rather than inventing history.
    return snapshot;
  }
}
