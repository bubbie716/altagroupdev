/**
 * Platform-wide mock data policy.
 *
 * Public simulated market data (Exchange listings, indices, etc.) may remain visible
 * when `SHOW_PUBLIC_SIMULATED_MARKET_DATA` is true.
 *
 * User-specific financial mock data (balances, portfolios, transactions) must not
 * display as real when `SHOW_USER_FINANCIAL_MOCK_DATA` is false.
 */
export const SHOW_PUBLIC_SIMULATED_MARKET_DATA = true;

export const SHOW_USER_FINANCIAL_MOCK_DATA = false;

export function isPublicSimulatedMarketDataEnabled(): boolean {
  return SHOW_PUBLIC_SIMULATED_MARKET_DATA;
}

export function isUserFinancialMockDataEnabled(): boolean {
  return SHOW_USER_FINANCIAL_MOCK_DATA;
}
