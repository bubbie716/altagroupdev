/** Domain types for Alta Terminal ↔ TSE adapter. Wire-format agnostic. */

export type TerminalChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type MarketSessionStatus = "open" | "closed" | "pre_market" | "after_hours" | "holiday";

export type SecurityTradingStatus = "trading" | "halted" | "delayed" | "unavailable";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "filled" | "cancelled" | "rejected" | "partial";

export type TerminalPortfolioOwnerTypeCode = "personal" | "company";
export type TerminalPortfolioStatusCode = "active" | "archived";

export type PricePoint = {
  t: number;
  v: number;
};

export type SecuritySummary = {
  symbol: string;
  name: string;
  lastPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  volume: number;
  marketCap: number | null;
  tradingStatus: SecurityTradingStatus;
  sparkline: PricePoint[];
};

export type SecurityDetail = SecuritySummary & {
  open: number;
  high: number;
  low: number;
  description: string;
  sector: string;
};

export type MarketStatusSnapshot = {
  status: MarketSessionStatus;
  label: string;
  asOf: string;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
};

export type Holding = {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  lastPrice: number;
  marketValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayReturn: number;
  dayReturnPercent: number;
  weightPercent: number;
  sparkline: PricePoint[];
};

export type PortfolioSnapshot = {
  portfolioId: string;
  equityValue: number;
  cashBalance: number;
  buyingPower: number;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  unrealizedReturn: number;
  unrealizedReturnPercent: number;
  holdings: Holding[];
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
};

export type TerminalPortfolioSummary = {
  id: string;
  name: string;
  ownerType: TerminalPortfolioOwnerTypeCode;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  ownerLabel: string;
  status: TerminalPortfolioStatusCode;
  isDefault: boolean;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  capabilities: {
    canView: boolean;
    canTrade: boolean;
    canRename: boolean;
    canArchive: boolean;
  };
};

export type WatchlistItem = {
  symbol: string;
  name: string;
  lastPrice: number;
  dayChange: number;
  dayChangePercent: number;
  sparkline: PricePoint[];
  tradingStatus: SecurityTradingStatus;
};

export type OrderRecord = {
  id: string;
  portfolioId: string;
  symbol: string;
  name: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  limitPrice: number | null;
  averageFillPrice: number | null;
  estimatedValue: number;
  submittedAt: string;
  updatedAt: string;
  rejectReason: string | null;
};

export type OrderPreviewInput = {
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number | null;
};

export type OrderPreviewResult = {
  ok: boolean;
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice: number | null;
  estimatedValue: number;
  estimatedFees: number;
  buyingPowerAfter: number | null;
  holdingsAfter: number | null;
  warnings: string[];
  errors: string[];
};

export type SubmitOrderResult =
  | { ok: true; order: OrderRecord }
  | {
      ok: false;
      errors: string[];
      code?: "market_closed" | "halted" | "validation" | "unavailable" | "portfolio_required";
    };

export type CancelOrderResult = { ok: true; order: OrderRecord } | { ok: false; errors: string[] };

/** Portfolio cash/security activity — adapter-level ledger, not mock-only. */
export type PortfolioActivityKind =
  | "cash_deposit"
  | "cash_withdrawal"
  | "buy_fill"
  | "sell_fill"
  | "dividend"
  | "trading_fee"
  | "adjustment"
  | "realized_gain_loss";

export type PortfolioActivityRecord = {
  id: string;
  portfolioId: string;
  kind: PortfolioActivityKind;
  occurredAt: string;
  /** Signed cash delta for this event (buys negative, sells/deposits positive). */
  amount: number;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  orderId: string | null;
  description: string;
  /** Running cash after this event (when provided by the adapter). */
  cashAfter: number | null;
};

export type HomeDashboard = {
  marketStatus: MarketStatusSnapshot;
  combinedValue: number;
  combinedDayChange: number;
  combinedDayChangePercent: number;
  portfolios: TerminalPortfolioSummary[];
  watchlistPreview: WatchlistItem[];
  movers: { gainers: SecuritySummary[]; losers: SecuritySummary[] };
  recentOrders: OrderRecord[];
};

export type TseDataSourceMode = "mock" | "unavailable" | "live";

export type TseClientContext = {
  userId: string;
};

export interface TseClient {
  readonly mode: TseDataSourceMode;
  getMarketStatus(): Promise<MarketStatusSnapshot>;
  listSecurities(query?: string): Promise<SecuritySummary[]>;
  getSecurity(symbol: string): Promise<SecurityDetail | null>;
  getQuote(symbol: string): Promise<SecuritySummary | null>;
  getPriceHistory(symbol: string, range: TerminalChartRange): Promise<PricePoint[]>;
  getPortfolio(portfolioId: string): Promise<PortfolioSnapshot>;
  getHoldings(portfolioId: string): Promise<Holding[]>;
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(symbol: string): Promise<WatchlistItem[]>;
  removeFromWatchlist(symbol: string): Promise<WatchlistItem[]>;
  listOrders(portfolioId: string): Promise<OrderRecord[]>;
  previewOrder(input: OrderPreviewInput): Promise<OrderPreviewResult>;
  submitOrder(input: OrderPreviewInput): Promise<SubmitOrderResult>;
  cancelOrder(portfolioId: string, orderId: string): Promise<CancelOrderResult>;
  listPortfolioActivity(portfolioId: string): Promise<PortfolioActivityRecord[]>;
  getHomeDashboard(portfolios: TerminalPortfolioSummary[]): Promise<HomeDashboard>;
  /** Seed mock market state for a newly created portfolio. */
  ensurePortfolioMarketState?(portfolioId: string, seed?: "populated" | "empty"): Promise<void>;
}
