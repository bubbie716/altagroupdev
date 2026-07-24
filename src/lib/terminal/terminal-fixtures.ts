import type {
  OrderRecord,
  PortfolioSnapshot,
  PricePoint,
  SecurityDetail,
  SecuritySummary,
  TerminalChartRange,
  WatchlistItem,
} from "@/lib/terminal/types";

/** Deterministic pseudo-random in [0, 1) from integer seed. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Stable sparkline / history series around a base price. */
export function buildDeterministicSeries(
  seed: number,
  base: number,
  points: number,
  volatility: number,
  endTime = Date.UTC(2026, 6, 21, 16, 0, 0),
): PricePoint[] {
  const out: PricePoint[] = [];
  let price = base * (1 - volatility * 0.35);
  const stepMs = Math.max(60_000, Math.floor((6.5 * 60 * 60 * 1000) / Math.max(points - 1, 1)));
  for (let i = 0; i < points; i++) {
    const drift = (hash01(seed + i * 17) - 0.48) * volatility * base;
    price = Math.max(0.5, price + drift);
    out.push({ t: endTime - (points - 1 - i) * stepMs, v: Number(price.toFixed(2)) });
  }
  if (out.length) out[out.length - 1] = { ...out[out.length - 1]!, v: Number(base.toFixed(2)) };
  return out;
}

function seriesForRanges(
  seed: number,
  base: number,
  vol: number,
): Record<TerminalChartRange, PricePoint[]> {
  return {
    "1D": buildDeterministicSeries(seed + 1, base, 78, vol * 0.35),
    "1W": buildDeterministicSeries(seed + 2, base, 48, vol * 0.55),
    "1M": buildDeterministicSeries(seed + 3, base, 42, vol * 0.7),
    "3M": buildDeterministicSeries(seed + 4, base, 64, vol * 0.85),
    "1Y": buildDeterministicSeries(seed + 5, base, 52, vol),
    ALL: buildDeterministicSeries(seed + 6, base, 72, vol * 1.1),
  };
}

type FixtureSecurity = Omit<SecurityDetail, "sparkline"> & {
  seed: number;
  volatility: number;
};

const FIXTURE_SECURITIES: FixtureSecurity[] = [
  {
    seed: 101,
    volatility: 0.012,
    symbol: "ALTA",
    name: "Alta Group Holdings",
    lastPrice: 128.4,
    previousClose: 125.1,
    dayChange: 3.3,
    dayChangePercent: 2.64,
    volume: 1_842_300,
    marketCap: 4_820_000_000,
    tradingStatus: "trading",
    open: 125.8,
    high: 129.1,
    low: 124.9,
    description:
      "Holding company for Alta’s banking, brokerage, and digital infrastructure businesses in the Republic of Newport.",
    sector: "Financials",
  },
  {
    seed: 202,
    volatility: 0.018,
    symbol: "NPRT",
    name: "Newport Republic Transport",
    lastPrice: 42.15,
    previousClose: 43.8,
    dayChange: -1.65,
    dayChangePercent: -3.77,
    volume: 980_400,
    marketCap: 910_000_000,
    tradingStatus: "trading",
    open: 43.5,
    high: 43.9,
    low: 41.8,
    description: "Rail, harbor, and logistics operator serving Newport’s industrial corridors.",
    sector: "Industrials",
  },
  {
    seed: 303,
    volatility: 0.022,
    symbol: "MINE",
    name: "Minecart Logistics",
    lastPrice: 18.72,
    previousClose: 17.4,
    dayChange: 1.32,
    dayChangePercent: 7.59,
    volume: 2_410_000,
    marketCap: 312_000_000,
    tradingStatus: "trading",
    open: 17.55,
    high: 19.05,
    low: 17.2,
    description: "Freight routing and warehouse automation for mining and manufacturing clients.",
    sector: "Technology",
  },
  {
    seed: 404,
    volatility: 0.016,
    symbol: "GOLD",
    name: "Gold Coast Mining",
    lastPrice: 67.9,
    previousClose: 66.2,
    dayChange: 1.7,
    dayChangePercent: 2.57,
    volume: 640_200,
    marketCap: 1_150_000_000,
    tradingStatus: "trading",
    open: 66.4,
    high: 68.3,
    low: 66.1,
    description: "Precious metals extraction and refining across the Gold Coast region.",
    sector: "Materials",
  },
  {
    seed: 505,
    volatility: 0.01,
    symbol: "HALT",
    name: "Harbor Halt Industries",
    lastPrice: 22.0,
    previousClose: 22.0,
    dayChange: 0,
    dayChangePercent: 0,
    volume: 12_400,
    marketCap: 180_000_000,
    tradingStatus: "halted",
    open: 22.0,
    high: 22.0,
    low: 22.0,
    description:
      "Industrial equipment manufacturer currently under a trading halt pending disclosure.",
    sector: "Industrials",
  },
  {
    seed: 606,
    volatility: 0.02,
    symbol: "CYBR",
    name: "Cyberdock Systems",
    lastPrice: 91.25,
    previousClose: 94.1,
    dayChange: -2.85,
    dayChangePercent: -3.03,
    volume: 1_120_000,
    marketCap: 2_040_000_000,
    tradingStatus: "trading",
    open: 93.8,
    high: 94.4,
    low: 90.6,
    description: "Enterprise cybersecurity and identity infrastructure for Newport institutions.",
    sector: "Technology",
  },
  {
    seed: 707,
    volatility: 0.014,
    symbol: "AGRI",
    name: "Agrivista Co-op",
    lastPrice: 33.48,
    previousClose: 32.9,
    dayChange: 0.58,
    dayChangePercent: 1.76,
    volume: 410_800,
    marketCap: 540_000_000,
    tradingStatus: "delayed",
    open: 33.0,
    high: 33.7,
    low: 32.7,
    description: "Agricultural cooperative with delayed quote distribution in this session.",
    sector: "Consumer Staples",
  },
  {
    seed: 808,
    volatility: 0.011,
    symbol: "UTIL",
    name: "Unified Grid Power",
    lastPrice: 54.1,
    previousClose: 53.6,
    dayChange: 0.5,
    dayChangePercent: 0.93,
    volume: 305_000,
    marketCap: 1_620_000_000,
    tradingStatus: "trading",
    open: 53.7,
    high: 54.4,
    low: 53.4,
    description: "Electric and water utility serving metropolitan Newport.",
    sector: "Utilities",
  },
];

const historyCache = new Map<string, Record<TerminalChartRange, PricePoint[]>>();

function historiesFor(sec: FixtureSecurity): Record<TerminalChartRange, PricePoint[]> {
  const key = sec.symbol;
  let cached = historyCache.get(key);
  if (!cached) {
    cached = seriesForRanges(sec.seed, sec.lastPrice, sec.volatility);
    historyCache.set(key, cached);
  }
  return cached;
}

export function listFixtureSecurities(): SecuritySummary[] {
  return FIXTURE_SECURITIES.map((sec) => {
    const spark = historiesFor(sec)["1D"].slice(-24);
    return {
      symbol: sec.symbol,
      name: sec.name,
      lastPrice: sec.lastPrice,
      previousClose: sec.previousClose,
      dayChange: sec.dayChange,
      dayChangePercent: sec.dayChangePercent,
      volume: sec.volume,
      marketCap: sec.marketCap,
      tradingStatus: sec.tradingStatus,
      sparkline: spark,
    };
  });
}

export function getFixtureSecurity(symbol: string): SecurityDetail | null {
  const sec = FIXTURE_SECURITIES.find((s) => s.symbol === symbol.toUpperCase());
  if (!sec) return null;
  const spark = historiesFor(sec)["1D"].slice(-24);
  return {
    symbol: sec.symbol,
    name: sec.name,
    lastPrice: sec.lastPrice,
    previousClose: sec.previousClose,
    dayChange: sec.dayChange,
    dayChangePercent: sec.dayChangePercent,
    volume: sec.volume,
    marketCap: sec.marketCap,
    tradingStatus: sec.tradingStatus,
    sparkline: spark,
    open: sec.open,
    high: sec.high,
    low: sec.low,
    description: sec.description,
    sector: sec.sector,
  };
}

export function getFixturePriceHistory(symbol: string, range: TerminalChartRange): PricePoint[] {
  const sec = FIXTURE_SECURITIES.find((s) => s.symbol === symbol.toUpperCase());
  if (!sec) return [];
  return historiesFor(sec)[range];
}

export const FIXTURE_INITIAL_WATCHLIST = ["MINE", "CYBR", "UTIL"] as const;

export const FIXTURE_CASH_BALANCE = 12_450.0;
export const FIXTURE_COMPANY_CASH = 85_000.0;
export const FIXTURE_EMPTY_CASH = 5_000.0;

export type FixtureLot = { symbol: string; quantity: number; averageCost: number };

export const FIXTURE_PERSONAL_CORE_LOTS: FixtureLot[] = [
  { symbol: "ALTA", quantity: 40, averageCost: 110.25 },
  { symbol: "GOLD", quantity: 25, averageCost: 61.4 },
  { symbol: "UTIL", quantity: 30, averageCost: 49.8 },
];

export const FIXTURE_COMPANY_LOTS: FixtureLot[] = [
  { symbol: "ALTA", quantity: 120, averageCost: 98.5 },
  { symbol: "CYBR", quantity: 45, averageCost: 88.2 },
  { symbol: "NPRT", quantity: 80, averageCost: 39.1 },
];

/** Stable mock portfolio ids for a user (used when DB is unavailable). */
export function mockPortfolioIds(userId: string) {
  return {
    personalCore: `tp_${userId}_core`,
    personalGrowth: `tp_${userId}_growth`,
    personalIncome: `tp_${userId}_income`,
    personalActive: `tp_${userId}_active`,
    companyAltg: `tp_${userId}_co_altg`,
  } as const;
}

export function buildFixturePortfolioFromLots(
  portfolioId: string,
  lots: FixtureLot[],
  cash: number,
  seriesSeed: number,
): PortfolioSnapshot {
  const securities = listFixtureSecurities();
  const bySymbol = new Map(securities.map((s) => [s.symbol, s]));
  let equity = 0;
  const holdings = lots.map((lot) => {
    const quote = bySymbol.get(lot.symbol)!;
    const marketValue = lot.quantity * quote.lastPrice;
    equity += marketValue;
    const costBasis = lot.quantity * lot.averageCost;
    const totalReturn = marketValue - costBasis;
    const dayReturn = lot.quantity * quote.dayChange;
    return {
      symbol: lot.symbol,
      name: quote.name,
      quantity: lot.quantity,
      averageCost: lot.averageCost,
      lastPrice: quote.lastPrice,
      marketValue: Number(marketValue.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      totalReturnPercent: Number(((totalReturn / costBasis) * 100).toFixed(2)),
      dayReturn: Number(dayReturn.toFixed(2)),
      dayReturnPercent: quote.dayChangePercent,
      weightPercent: 0,
      sparkline: quote.sparkline,
    };
  });

  for (const h of holdings) {
    h.weightPercent = equity > 0 ? Number(((h.marketValue / equity) * 100).toFixed(1)) : 0;
  }

  const dayChange = holdings.reduce((sum, h) => sum + h.dayReturn, 0);
  const priorEquity = equity - dayChange;
  const totalCost = lots.reduce((sum, lot) => sum + lot.quantity * lot.averageCost, 0);
  const totalReturn = equity - totalCost;
  const totalValue = equity + cash;

  return {
    portfolioId,
    equityValue: Number(equity.toFixed(2)),
    cashBalance: cash,
    buyingPower: cash,
    totalValue: Number(totalValue.toFixed(2)),
    dayChange: Number(dayChange.toFixed(2)),
    dayChangePercent: priorEquity > 0 ? Number(((dayChange / priorEquity) * 100).toFixed(2)) : 0,
    totalReturn: Number(totalReturn.toFixed(2)),
    totalReturnPercent: totalCost > 0 ? Number(((totalReturn / totalCost) * 100).toFixed(2)) : 0,
    unrealizedReturn: Number(totalReturn.toFixed(2)),
    unrealizedReturnPercent:
      totalCost > 0 ? Number(((totalReturn / totalCost) * 100).toFixed(2)) : 0,
    holdings,
    seriesByRange: seriesForRanges(seriesSeed, Math.max(totalValue, cash), 0.008),
  };
}

export function buildFixturePortfolio(
  securities: SecuritySummary[],
  cash = FIXTURE_CASH_BALANCE,
  portfolioId = "tp_personal_core",
): PortfolioSnapshot {
  void securities;
  return buildFixturePortfolioFromLots(
    portfolioId,
    FIXTURE_PERSONAL_CORE_LOTS,
    cash,
    9001,
  );
}

export function buildEmptyFixturePortfolio(
  cash = FIXTURE_EMPTY_CASH,
  portfolioId = "tp_personal_growth",
): PortfolioSnapshot {
  const flat = buildDeterministicSeries(42, cash, 40, 0.002);
  const series = {
    "1D": flat,
    "1W": flat,
    "1M": flat,
    "3M": flat,
    "1Y": flat,
    ALL: flat,
  } as Record<TerminalChartRange, PricePoint[]>;
  return {
    portfolioId,
    equityValue: 0,
    cashBalance: cash,
    buyingPower: cash,
    totalValue: cash,
    dayChange: 0,
    dayChangePercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    unrealizedReturn: 0,
    unrealizedReturnPercent: 0,
    holdings: [],
    seriesByRange: series,
  };
}

export function watchlistFromSymbols(symbols: string[]): WatchlistItem[] {
  const all = listFixtureSecurities();
  return symbols
    .map((symbol) => all.find((s) => s.symbol === symbol))
    .filter((s): s is SecuritySummary => Boolean(s))
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      lastPrice: s.lastPrice,
      dayChange: s.dayChange,
      dayChangePercent: s.dayChangePercent,
      sparkline: s.sparkline,
      tradingStatus: s.tradingStatus,
    }));
}

export function buildFixtureOrders(portfolioId: string, variant: "core" | "company" | "empty"): OrderRecord[] {
  if (variant === "empty") return [];
  if (variant === "company") {
    return [
      {
        id: `ord_${portfolioId}_open_1`,
        portfolioId,
        symbol: "ALTA",
        name: "Alta Group Holdings",
        side: "buy",
        type: "limit",
        status: "open",
        quantity: 25,
        filledQuantity: 0,
        limitPrice: 124,
        averageFillPrice: null,
        estimatedValue: 3100,
        submittedAt: "2026-07-20T14:22:00.000Z",
        updatedAt: "2026-07-20T14:22:00.000Z",
        rejectReason: null,
      },
      {
        id: `ord_${portfolioId}_filled_1`,
        portfolioId,
        symbol: "CYBR",
        name: "Cyberdock Systems",
        side: "buy",
        type: "market",
        status: "filled",
        quantity: 15,
        filledQuantity: 15,
        limitPrice: null,
        averageFillPrice: 92.1,
        estimatedValue: 1381.5,
        submittedAt: "2026-07-15T16:40:00.000Z",
        updatedAt: "2026-07-15T16:40:03.000Z",
        rejectReason: null,
      },
    ];
  }
  return [
    {
      id: `ord_${portfolioId}_open_alta_1`,
      portfolioId,
      symbol: "ALTA",
      name: "Alta Group Holdings",
      side: "buy",
      type: "limit",
      status: "open",
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 126.5,
      averageFillPrice: null,
      estimatedValue: 1265,
      submittedAt: "2026-07-21T13:42:00.000Z",
      updatedAt: "2026-07-21T13:42:00.000Z",
      rejectReason: null,
    },
    {
      id: `ord_${portfolioId}_filled_mine_1`,
      portfolioId,
      symbol: "MINE",
      name: "Minecart Logistics",
      side: "buy",
      type: "market",
      status: "filled",
      quantity: 50,
      filledQuantity: 50,
      limitPrice: null,
      averageFillPrice: 17.9,
      estimatedValue: 895,
      submittedAt: "2026-07-18T15:10:00.000Z",
      updatedAt: "2026-07-18T15:10:04.000Z",
      rejectReason: null,
    },
    {
      id: `ord_${portfolioId}_cancelled_cybr_1`,
      portfolioId,
      symbol: "CYBR",
      name: "Cyberdock Systems",
      side: "sell",
      type: "limit",
      status: "cancelled",
      quantity: 5,
      filledQuantity: 0,
      limitPrice: 98,
      averageFillPrice: null,
      estimatedValue: 490,
      submittedAt: "2026-07-17T14:02:00.000Z",
      updatedAt: "2026-07-17T16:01:00.000Z",
      rejectReason: null,
    },
    {
      id: `ord_${portfolioId}_rejected_halt_1`,
      portfolioId,
      symbol: "HALT",
      name: "Harbor Halt Industries",
      side: "buy",
      type: "market",
      status: "rejected",
      quantity: 20,
      filledQuantity: 0,
      limitPrice: null,
      averageFillPrice: null,
      estimatedValue: 440,
      submittedAt: "2026-07-21T12:05:00.000Z",
      updatedAt: "2026-07-21T12:05:01.000Z",
      rejectReason: "Security is halted",
    },
  ];
}

export const FIXTURE_MARKET_STATUS = {
  status: "open" as const,
  label: "Market open",
  asOf: "2026-07-21T16:00:00.000Z",
  nextOpenAt: null,
  nextCloseAt: "2026-07-21T21:00:00.000Z",
};
