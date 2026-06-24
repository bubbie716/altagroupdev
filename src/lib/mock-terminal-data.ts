/**
 * @deprecated Import from `@/lib/terminal/api` instead.
 */
export {
  compact,
  florin,
  pct,
  getEstimatedCost,
  getHoldings,
  getLeaderboard,
  getOrders,
  getPortfolioSummary,
  getPortfolioTransactions,
  getSectorAllocation,
  getTerminalDashboard,
  getTerminalDescription,
  getTerminalIpoAccess,
  getTerminalNews,
  getTerminalResearch,
  getTradeDefaults,
  getTradeHistory,
  getWatchlistGroups,
} from "./terminal/api";

export * from "./terminal/types";

import {
  getEstimatedCost,
  getHoldings,
  getLeaderboard,
  getOrders,
  getPortfolioSummary,
  getSectorAllocation,
  getTerminalDashboard,
  getTerminalDescription,
  getTerminalIpoAccess,
  getTerminalNews,
  getTerminalResearch,
  getTradeDefaults,
  getTradeHistory,
  getWatchlistGroups,
} from "./terminal/api";
import { holdings, movers, orders, portfolioSeries, stocks, transactions } from "./terminal/data";

/** @deprecated Use getTerminalDescription() */
export const terminalDescription = getTerminalDescription();

/** @deprecated Use getTerminalDashboard() */
export const terminalDashboard = getTerminalDashboard();

/** @deprecated Use getPortfolioSummary() */
export const portfolioSummary = getPortfolioSummary();

/** @deprecated Use getSectorAllocation() */
export { sectorAllocation } from "./terminal/data";

/** @deprecated Use getWatchlistGroups() */
export const watchlistGroups = getWatchlistGroups();

/** @deprecated Use getTerminalResearch() */
export const terminalResearch = getTerminalResearch();

/** @deprecated Use getTerminalNews() */
export const terminalNews = getTerminalNews();

/** @deprecated Use getTerminalIpoAccess() */
export const terminalIpoAccess = getTerminalIpoAccess();

/** @deprecated Use getLeaderboard() */
export const leaderboard = getLeaderboard();

/** @deprecated Use getTradeDefaults() */
export const tradeDefaults = getTradeDefaults();

/** @deprecated Use getTradeHistory() */
export const tradeHistory = getTradeHistory();

export { holdings, movers, orders, portfolioSeries, stocks, transactions };
