/** Domain types for Alta Terminal ↔ TSE adapter. Wire-format agnostic. */

export type TerminalChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type MarketSessionStatus = "open" | "closed" | "pre_market" | "after_hours" | "holiday";

export type SecurityTradingStatus = "trading" | "halted" | "delayed" | "unavailable";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "filled" | "cancelled" | "rejected" | "partial";

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
  equityValue: number;
  cashBalance: number;
  buyingPower: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: Holding[];
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
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
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number | null;
};

export type OrderPreviewResult = {
  ok: boolean;
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
      code?: "market_closed" | "halted" | "validation" | "unavailable";
    };

export type CancelOrderResult = { ok: true; order: OrderRecord } | { ok: false; errors: string[] };

export type HomeDashboard = {
  portfolio: PortfolioSnapshot;
  watchlistPreview: WatchlistItem[];
  movers: { gainers: SecuritySummary[]; losers: SecuritySummary[] };
  recentOrders: OrderRecord[];
  marketStatus: MarketStatusSnapshot;
};

export type TseDataSourceMode = "mock" | "unavailable" | "live";

export type TseClientContext = {
  /** Authenticated Alta customer. Future live adapters resolve this to a brokerage account. */
  userId: string;
};

export interface TseClient {
  readonly mode: TseDataSourceMode;
  getMarketStatus(): Promise<MarketStatusSnapshot>;
  listSecurities(query?: string): Promise<SecuritySummary[]>;
  getSecurity(symbol: string): Promise<SecurityDetail | null>;
  getQuote(symbol: string): Promise<SecuritySummary | null>;
  getPriceHistory(symbol: string, range: TerminalChartRange): Promise<PricePoint[]>;
  getPortfolio(): Promise<PortfolioSnapshot>;
  getHoldings(): Promise<Holding[]>;
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(symbol: string): Promise<WatchlistItem[]>;
  removeFromWatchlist(symbol: string): Promise<WatchlistItem[]>;
  listOrders(): Promise<OrderRecord[]>;
  previewOrder(input: OrderPreviewInput): Promise<OrderPreviewResult>;
  submitOrder(input: OrderPreviewInput): Promise<SubmitOrderResult>;
  cancelOrder(orderId: string): Promise<CancelOrderResult>;
  getHomeDashboard(): Promise<HomeDashboard>;
}
