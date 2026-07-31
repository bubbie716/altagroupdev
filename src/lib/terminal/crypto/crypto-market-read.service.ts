/**
 * Production PostgreSQL read service for Alta Terminal fictional crypto markets.
 * No UI Lab fallback — callers in server functions branch explicitly.
 */
import type { TerminalCryptoAssetStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { CRYPTO_ASSET_CONFIGS, type CryptoAssetSymbol } from "./crypto-constants";
import { d, roundDownMoney, serializeCryptoMoney, serializeCryptoPrice } from "./crypto-decimal";
import { marginalPrice } from "./crypto-curve-math";

export type CryptoChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type CryptoTradingCapabilities = {
  canBuy: boolean;
  canSell: boolean;
};

export type CryptoMarketAssetSummary = {
  symbol: string;
  displayName: string;
  kind: "STABLE" | "BONDING_CURVE";
  status: Exclude<TerminalCryptoAssetStatus, "DRAFT">;
  currentPrice: string;
  /** Null when insufficient 24h history — never fabricate zero change. */
  dayChange: string | null;
  dayChangePercent: string | null;
  noTradesYet: boolean;
  tradingCapabilities: CryptoTradingCapabilities;
  statusLabel: string;
  tradingContextLabel: string;
};

export type CryptoAssetDetail = CryptoMarketAssetSummary & {
  description: string;
  feeDisclosure: string;
  quantityPrecision: number;
  displayPrecision: number;
  marketStateVersion: number;
};

export type CryptoPriceHistoryPoint = {
  t: number;
  price: string;
};

export type CryptoPriceHistoryResult = {
  points: CryptoPriceHistoryPoint[];
  limitedHistory: boolean;
  noTradesYet: boolean;
};

export type CryptoPortfolioBalance = {
  symbol: string;
  displayName: string;
  quantity: string;
  averageCost: string;
  currentPrice: string;
  markedValue: string;
  totalReturn: string | null;
  totalReturnPercent: string | null;
};

export type CryptoPortfolioSummary = {
  portfolioId: string;
  walletPublicId: string | null;
  walletStatus: "ACTIVE" | "FROZEN" | "CLOSED" | null;
  balances: CryptoPortfolioBalance[];
  totalMarkedValue: string;
  hasWallet: boolean;
};

export type CryptoOrderSummary = {
  orderId: string;
  symbol: string;
  assetDisplayName: string;
  side: "BUY" | "SELL";
  status: "OPEN" | "FILLED" | "CANCELLED" | "REJECTED" | "PARTIAL";
  submittedAt: string;
  filledAt: string | null;
  executedQuantity: string | null;
  grossTradeValue: string | null;
  totalFee: string | null;
  averageExecutionPrice: string | null;
  priceBefore: string | null;
  priceAfter: string | null;
  priceImpactPercent: string | null;
  customerCashDelta: string | null;
  realizedGainLoss: string | null;
  walletPublicId: string | null;
};

const ASSET_DESCRIPTIONS: Record<CryptoAssetSymbol, string> = {
  NPFC:
    "Newport Florin Coin is a fictional stable coin pegged to ƒ1.00 in the Alta Terminal Minecraft economy.",
  NVA:
    "Nova Coin uses a reserve-backed bonding curve. Prices rise as more coins circulate and fall when coins are sold back.",
  VLT:
    "Volt Coin uses a reserve-backed bonding curve with a lower starting price. Large trades can move the price sharply.",
};

const FEE_DISCLOSURES: Record<CryptoAssetSymbol, string> = {
  NPFC: "0.10% conversion fee on purchases and redemptions.",
  NVA: "1.00% fee on trades (0.75% Alta Terminal revenue, 0.25% stabilization fund).",
  VLT: "1.00% fee on trades (0.75% Alta Terminal revenue, 0.25% stabilization fund).",
};

function customerStatusLabel(status: TerminalCryptoAssetStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "REDEMPTION_ONLY":
      return "Redemption only";
    case "HALTED":
      return "Trading halted";
    case "CLOSED":
      return "Closed";
    default:
      return "Unavailable";
  }
}

function tradingContextLabel(status: TerminalCryptoAssetStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Crypto · 24/7";
    case "REDEMPTION_ONLY":
      return "Purchases disabled — redemptions only";
    case "HALTED":
      return "Trading temporarily halted";
    case "CLOSED":
      return "Asset closed — no new trades";
    default:
      return "Crypto · unavailable";
  }
}

export function tradingCapabilitiesForStatus(
  status: TerminalCryptoAssetStatus,
): CryptoTradingCapabilities {
  switch (status) {
    case "ACTIVE":
      return { canBuy: true, canSell: true };
    case "REDEMPTION_ONLY":
      return { canBuy: false, canSell: true };
    default:
      return { canBuy: false, canSell: false };
  }
}

export function isCryptoSymbolVisible(
  status: TerminalCryptoAssetStatus,
  held: boolean,
  opts?: { includeHalted?: boolean },
): boolean {
  switch (status) {
    case "DRAFT":
      return false;
    case "ACTIVE":
    case "REDEMPTION_ONLY":
      return true;
    case "HALTED":
      return held || opts?.includeHalted === true;
    case "CLOSED":
      return held;
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return false;
    }
  }
}

function isLaunchSymbol(symbol: string): symbol is CryptoAssetSymbol {
  return symbol in CRYPTO_ASSET_CONFIGS;
}

function resolveDisplayName(symbol: string, dbName: string): string {
  if (isLaunchSymbol(symbol)) {
    return CRYPTO_ASSET_CONFIGS[symbol].displayName;
  }
  return dbName;
}

function markedUnitPrice(input: {
  symbol: string;
  kind: "STABLE" | "BONDING_CURVE";
  pegOrStartingPrice: string;
  curveRate: string | null;
  circulatingSupply: string;
  currentMarginalPrice: string;
}): string {
  if (input.kind === "STABLE" || input.symbol === "NPFC") {
    return serializeCryptoPrice(d("1"));
  }
  if (input.curveRate != null) {
    return serializeCryptoPrice(
      marginalPrice({
        startingPrice: input.pegOrStartingPrice,
        curveRate: input.curveRate,
        circulatingSupply: input.circulatingSupply,
      }),
    );
  }
  return serializeCryptoPrice(input.currentMarginalPrice);
}

function rangeWindow(range: CryptoChartRange): { interval: "M1" | "D1"; since: Date } {
  const now = Date.now();
  const day = 86_400_000;
  switch (range) {
    case "1D":
      return { interval: "M1", since: new Date(now - day) };
    case "1W":
      return { interval: "D1", since: new Date(now - 7 * day) };
    case "1M":
      return { interval: "D1", since: new Date(now - 30 * day) };
    case "3M":
      return { interval: "D1", since: new Date(now - 90 * day) };
    case "1Y":
      return { interval: "D1", since: new Date(now - 365 * day) };
    case "ALL":
      return { interval: "D1", since: new Date(0) };
  }
}

async function computeDayChange(input: {
  assetId: string;
  currentPrice: string;
}): Promise<{ dayChange: string | null; dayChangePercent: string | null; noTradesYet: boolean }> {
  const since = new Date(Date.now() - 86_400_000);
  const prior = await prisma.terminalCryptoPriceCandle.findFirst({
    where: {
      assetId: input.assetId,
      interval: { in: ["M1", "D1"] },
      intervalStart: { lte: since },
      tradeCount: { gt: 0 },
    },
    orderBy: { intervalStart: "desc" },
  });

  const anyTrade = await prisma.terminalCryptoPriceCandle.findFirst({
    where: { assetId: input.assetId, tradeCount: { gt: 0 } },
    select: { id: true },
  });

  if (!prior) {
    return {
      dayChange: null,
      dayChangePercent: null,
      noTradesYet: !anyTrade,
    };
  }

  const current = d(input.currentPrice);
  const previous = d(prior.close.toString());
  if (!previous.greaterThan(0)) {
    return { dayChange: null, dayChangePercent: null, noTradesYet: !anyTrade };
  }

  const change = current.minus(previous);
  const changePercent = change.div(previous).mul(100);
  return {
    dayChange: serializeCryptoPrice(change),
    dayChangePercent: changePercent.toFixed(2),
    noTradesYet: false,
  };
}

function mapAssetSummary(
  row: {
    symbol: string;
    displayName: string;
    kind: "STABLE" | "BONDING_CURVE";
    status: TerminalCryptoAssetStatus;
    pegOrStartingPrice: { toString(): string };
    curveRate: { toString(): string } | null;
    marketState: {
      circulatingSupply: { toString(): string };
      currentMarginalPrice: { toString(): string };
    } | null;
  },
  dayMetrics: {
    dayChange: string | null;
    dayChangePercent: string | null;
    noTradesYet: boolean;
  },
): CryptoMarketAssetSummary | null {
  if (row.status === "DRAFT" || !row.marketState) return null;

  const currentPrice = markedUnitPrice({
    symbol: row.symbol,
    kind: row.kind,
    pegOrStartingPrice: row.pegOrStartingPrice.toString(),
    curveRate: row.curveRate?.toString() ?? null,
    circulatingSupply: row.marketState.circulatingSupply.toString(),
    currentMarginalPrice: row.marketState.currentMarginalPrice.toString(),
  });

  return {
    symbol: row.symbol,
    displayName: resolveDisplayName(row.symbol, row.displayName),
    kind: row.kind,
    status: row.status,
    currentPrice,
    dayChange: dayMetrics.dayChange,
    dayChangePercent: dayMetrics.dayChangePercent,
    noTradesYet: dayMetrics.noTradesYet,
    tradingCapabilities: tradingCapabilitiesForStatus(row.status),
    statusLabel: customerStatusLabel(row.status),
    tradingContextLabel: tradingContextLabel(row.status),
  };
}

export async function listVisibleCryptoAssets(opts?: {
  heldSymbols?: string[];
  includeHalted?: boolean;
}): Promise<CryptoMarketAssetSummary[]> {
  const held = new Set((opts?.heldSymbols ?? []).map((s) => s.toUpperCase()));
  const rows = await prisma.terminalCryptoAsset.findMany({
    where: { status: { not: "DRAFT" } },
    include: { marketState: true },
    orderBy: { symbol: "asc" },
  });

  const visible = rows.filter((row) =>
    isCryptoSymbolVisible(row.status, held.has(row.symbol), {
      includeHalted: opts?.includeHalted,
    }),
  );

  const summaries: CryptoMarketAssetSummary[] = [];
  for (const row of visible) {
    if (!row.marketState) continue;
    const currentPrice = markedUnitPrice({
      symbol: row.symbol,
      kind: row.kind,
      pegOrStartingPrice: row.pegOrStartingPrice.toString(),
      curveRate: row.curveRate?.toString() ?? null,
      circulatingSupply: row.marketState.circulatingSupply.toString(),
      currentMarginalPrice: row.marketState.currentMarginalPrice.toString(),
    });
    const dayMetrics = await computeDayChange({ assetId: row.id, currentPrice });
    const summary = mapAssetSummary(row, dayMetrics);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

export async function getCryptoAssetDetail(
  symbol: string,
  opts?: { held?: boolean },
): Promise<CryptoAssetDetail | null> {
  const normalized = symbol.trim().toUpperCase();
  const row = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol: normalized },
    include: { marketState: true },
  });
  if (!row?.marketState) return null;
  if (
    !isCryptoSymbolVisible(row.status, opts?.held === true, {
      includeHalted: opts?.held === true,
    })
  ) {
    return null;
  }

  const currentPrice = markedUnitPrice({
    symbol: row.symbol,
    kind: row.kind,
    pegOrStartingPrice: row.pegOrStartingPrice.toString(),
    curveRate: row.curveRate?.toString() ?? null,
    circulatingSupply: row.marketState.circulatingSupply.toString(),
    currentMarginalPrice: row.marketState.currentMarginalPrice.toString(),
  });
  const dayMetrics = await computeDayChange({ assetId: row.id, currentPrice });
  const summary = mapAssetSummary(row, dayMetrics);
  if (!summary) return null;

  const description = isLaunchSymbol(row.symbol)
    ? ASSET_DESCRIPTIONS[row.symbol]
    : `${row.displayName} is a fictional florin-denominated Alta Terminal crypto asset.`;
  const feeDisclosure = isLaunchSymbol(row.symbol)
    ? FEE_DISCLOSURES[row.symbol]
    : `${row.totalFeeBps / 100}% fee on trades.`;

  return {
    ...summary,
    description,
    feeDisclosure,
    quantityPrecision: row.quantityPrecision,
    displayPrecision: row.displayPrecision,
    marketStateVersion: row.marketState.version,
  };
}

export async function getCryptoPriceHistory(
  symbol: string,
  range: CryptoChartRange,
): Promise<CryptoPriceHistoryResult> {
  const normalized = symbol.trim().toUpperCase();
  const asset = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol: normalized },
    select: { id: true, status: true },
  });
  if (!asset || asset.status === "DRAFT") {
    return { points: [], limitedHistory: true, noTradesYet: true };
  }

  const { interval, since } = rangeWindow(range);
  const candles = await prisma.terminalCryptoPriceCandle.findMany({
    where: {
      assetId: asset.id,
      interval,
      intervalStart: { gte: since },
    },
    orderBy: { intervalStart: "asc" },
  });

  const traded = candles.some((c) => c.tradeCount > 0);
  const points: CryptoPriceHistoryPoint[] = candles.map((c) => ({
    t: c.intervalStart.getTime(),
    price: serializeCryptoPrice(c.close),
  }));

  return {
    points,
    limitedHistory: points.length <= 1,
    noTradesYet: !traded,
  };
}

export async function getPortfolioCryptoSummary(
  portfolioId: string,
): Promise<CryptoPortfolioSummary> {
  const wallet = await prisma.terminalCryptoWallet.findUnique({
    where: { portfolioId },
    include: {
      balances: {
        include: {
          asset: { include: { marketState: true } },
        },
      },
    },
  });

  if (!wallet) {
    return {
      portfolioId,
      walletPublicId: null,
      walletStatus: null,
      balances: [],
      totalMarkedValue: serializeCryptoMoney(0),
      hasWallet: false,
    };
  }

  let totalMarked = d("0");
  const balances: CryptoPortfolioBalance[] = [];

  for (const balance of wallet.balances) {
    const qty = d(balance.availableQuantity.toString());
    if (!qty.greaterThan(0)) continue;
    const asset = balance.asset;
    const market = asset.marketState;
    if (!market) continue;

    const currentPrice = markedUnitPrice({
      symbol: asset.symbol,
      kind: asset.kind,
      pegOrStartingPrice: asset.pegOrStartingPrice.toString(),
      curveRate: asset.curveRate?.toString() ?? null,
      circulatingSupply: market.circulatingSupply.toString(),
      currentMarginalPrice: market.currentMarginalPrice.toString(),
    });

    const markedValue = roundDownMoney(qty.mul(d(currentPrice)));
    totalMarked = totalMarked.plus(markedValue);

    const avgCost = d(balance.averageCost.toString());
    let totalReturn: string | null = null;
    let totalReturnPercent: string | null = null;
    if (avgCost.greaterThan(0)) {
      const costBasis = qty.mul(avgCost);
      const ret = markedValue.minus(costBasis);
      totalReturn = serializeCryptoMoney(ret);
      totalReturnPercent = costBasis.greaterThan(0)
        ? ret.div(costBasis).mul(100).toFixed(2)
        : null;
    }

    balances.push({
      symbol: asset.symbol,
      displayName: resolveDisplayName(asset.symbol, asset.displayName),
      quantity: qty.toFixed(8),
      averageCost: serializeCryptoPrice(avgCost),
      currentPrice,
      markedValue: serializeCryptoMoney(markedValue),
      totalReturn,
      totalReturnPercent,
    });
  }

  balances.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    portfolioId,
    walletPublicId: wallet.publicWalletId,
    walletStatus: wallet.status,
    balances,
    totalMarkedValue: serializeCryptoMoney(totalMarked),
    hasWallet: true,
  };
}

export async function getPortfolioCryptoOrders(
  portfolioId: string,
  limit = 50,
): Promise<CryptoOrderSummary[]> {
  const rows = await prisma.terminalOrder.findMany({
    where: {
      portfolioId,
      OR: [{ instrumentKind: "CRYPTO" }, { executionVenue: "ALTA_CRYPTO" }],
    },
    include: {
      cryptoSettlement: {
        include: { wallet: { select: { publicWalletId: true } } },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });

  return rows.map((row) => {
    const settlement = row.cryptoSettlement;
    const assetDisplayName = isLaunchSymbol(row.symbol)
      ? CRYPTO_ASSET_CONFIGS[row.symbol].displayName
      : row.symbol;

    return {
      orderId: row.id,
      symbol: row.symbol,
      assetDisplayName,
      side: row.side,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      filledAt: row.completedAt?.toISOString() ?? settlement?.executedAt.toISOString() ?? null,
      executedQuantity: settlement
        ? settlement.executedQuantity.toFixed(8)
        : row.filledQuantity.greaterThan(0)
          ? row.filledQuantity.toFixed(8)
          : null,
      grossTradeValue: settlement ? serializeCryptoMoney(settlement.grossValue) : null,
      totalFee: settlement ? serializeCryptoMoney(settlement.totalFee) : null,
      averageExecutionPrice: settlement
        ? serializeCryptoPrice(settlement.averageExecutionPrice)
        : null,
      priceBefore: settlement ? serializeCryptoPrice(settlement.priceBefore) : null,
      priceAfter: settlement ? serializeCryptoPrice(settlement.priceAfter) : null,
      priceImpactPercent: settlement
        ? d(settlement.priceAfter.toString())
            .minus(settlement.priceBefore.toString())
            .div(settlement.priceBefore.toString())
            .mul(100)
            .toFixed(4)
        : null,
      customerCashDelta: settlement ? serializeCryptoMoney(settlement.customerCashDelta) : null,
      realizedGainLoss:
        settlement?.realizedGainLoss != null
          ? serializeCryptoMoney(settlement.realizedGainLoss)
          : null,
      walletPublicId: settlement?.wallet.publicWalletId ?? null,
    };
  });
}
