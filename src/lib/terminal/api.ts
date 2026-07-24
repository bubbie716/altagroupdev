/**
 * Alta Terminal API — production service layer.
 *
 * Market and portfolio datasets return empty/unavailable values until backed by
 * persisted Terminal and Exchange services. Cash flows use server functions.
 */

export * from "./types";
export { compact, florin, pct } from "@/lib/format/money-display";

export const terminalDescription =
  "Alta’s brokerage and trading platform. Portfolio tools, watchlists, and order entry for Newport investors.";

export function getEstimatedCost(qty: number, price: number) {
  return qty * price;
}

/** GET /v1/terminal/description */
export function getTerminalDescription() {
  return terminalDescription;
}

/** GET /v1/terminal/dashboard */
export function getTerminalDashboard() {
  return {
    totalNetWorth: 0,
    portfolioValue: 0,
    dailyPnL: 0,
    dailyPnLPercent: 0,
    cashAvailable: 0,
    performanceSeries: [] as { t: number; v: number }[],
  };
}

/** GET /v1/terminal/portfolio/performance */
export function getPortfolioSeries() {
  return [] as { t: number; v: number }[];
}

/** GET /v1/terminal/portfolio/summary */
export function getPortfolioSummary() {
  return {
    cashBalance: 0,
    unrealizedGain: 0,
    realizedGain: 0,
    totalReturn: 0,
  };
}

/** GET /v1/terminal/portfolio/sector-allocation */
export function getSectorAllocation() {
  return [] as { sector: string; weight: number }[];
}

/** GET /v1/terminal/portfolio/holdings */
export function getHoldings() {
  return [] as {
    symbol: string;
    shares: number;
    avg: number;
    value: number;
    weight: number;
  }[];
}

/** GET /v1/terminal/portfolio/transactions */
export function getPortfolioTransactions() {
  return [] as {
    id: string;
    date: string;
    desc: string;
    category: string;
    amount: number;
  }[];
}

/** GET /v1/terminal/watchlist */
export function getWatchlistGroups() {
  return [] as {
    name: string;
    items: {
      symbol: string;
      name: string;
      sector: string;
      price: number;
      change: number;
      volume: number;
      marketCap: number;
      alert?: string;
    }[];
  }[];
}

/** GET /v1/terminal/research */
export function getTerminalResearch() {
  return [];
}

/** GET /v1/terminal/news */
export function getTerminalNews() {
  return [];
}

/** GET /v1/terminal/ipo-access */
export function getTerminalIpoAccess() {
  return [];
}

/** GET /v1/terminal/leaderboard */
export function getLeaderboard() {
  return {
    largestPortfolios: [],
    bestDaily: [],
    mostActive: [],
    topPrivate: [],
    winners: [],
    losers: [],
  };
}

/** GET /v1/terminal/trade/defaults */
export function getTradeDefaults() {
  return null;
}

/** GET /v1/terminal/trade/history */
export function getTradeHistory() {
  return [];
}

/** GET /v1/terminal/orders */
export function getOrders() {
  return [];
}

export const terminalApi = {
  getTerminalDescription,
  getTerminalDashboard,
  getPortfolioSummary,
  getPortfolioSeries,
  getSectorAllocation,
  getHoldings,
  getPortfolioTransactions,
  getWatchlistGroups,
  getTerminalResearch,
  getTerminalNews,
  getTerminalIpoAccess,
  getLeaderboard,
  getTradeDefaults,
  getTradeHistory,
  getOrders,
  getEstimatedCost,
};
