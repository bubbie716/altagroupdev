/**
 * Alta Terminal API — mock service layer.
 *
 * Future architecture:
 *   Alta Terminal UI → Alta Terminal API (HTTP) → terminal + exchange data services
 *
 * Today all functions return in-memory mock data synchronously.
 */

export * from "./types";
export { compact, florin, pct, getEstimatedCost } from "./data";

import {
  getEstimatedCost,
  holdings,
  leaderboard,
  orders,
  portfolioSummary,
  sectorAllocation,
  portfolioSeries,
  terminalDashboard,
  terminalDescription,
  terminalIpoAccess,
  terminalNews,
  terminalResearch,
  tradeDefaults,
  tradeHistory,
  transactions,
  watchlistGroups,
} from "./data";

/** GET /v1/terminal/description */
export function getTerminalDescription() {
  return terminalDescription;
}

/** GET /v1/terminal/dashboard */
export function getTerminalDashboard() {
  return terminalDashboard;
}

/** GET /v1/terminal/portfolio/performance */
export function getPortfolioSeries() {
  return portfolioSeries;
}

/** GET /v1/terminal/portfolio/summary */
export function getPortfolioSummary() {
  return portfolioSummary;
}

/** GET /v1/terminal/portfolio/sector-allocation */
export function getSectorAllocation() {
  return sectorAllocation;
}

/** GET /v1/terminal/portfolio/holdings */
export function getHoldings() {
  return holdings;
}

/** GET /v1/terminal/portfolio/transactions */
export function getPortfolioTransactions() {
  return transactions;
}

/** GET /v1/terminal/watchlist */
export function getWatchlistGroups() {
  return watchlistGroups;
}

/** GET /v1/terminal/research */
export function getTerminalResearch() {
  return terminalResearch;
}

/** GET /v1/terminal/news */
export function getTerminalNews() {
  return terminalNews;
}

/** GET /v1/terminal/ipo-access */
export function getTerminalIpoAccess() {
  return terminalIpoAccess;
}

/** GET /v1/terminal/leaderboard */
export function getLeaderboard() {
  return leaderboard;
}

/** GET /v1/terminal/trade/defaults */
export function getTradeDefaults() {
  return tradeDefaults;
}

/** GET /v1/terminal/trade/history */
export function getTradeHistory() {
  return tradeHistory;
}

/** GET /v1/terminal/orders */
export function getOrders() {
  return orders;
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
