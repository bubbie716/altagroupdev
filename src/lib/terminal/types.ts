/** Domain types for Alta Terminal. Local persistence and TSE market access are distinct. */

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

export type TerminalInstrumentKind = "STOCK" | "CRYPTO";

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
  /** Present on unified instrument search results; omit for stock-only TSE payloads. */
  instrumentKind?: TerminalInstrumentKind;
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
  /** Null when live quotes are unavailable. */
  lastPrice: number | null;
  /** Null when live quotes are unavailable — never treat cost basis as live value. */
  marketValue: number | null;
  totalReturn: number | null;
  totalReturnPercent: number | null;
  dayReturn: number | null;
  dayReturnPercent: number | null;
  weightPercent: number | null;
  sparkline: PricePoint[];
};

export type PortfolioSnapshot = {
  portfolioId: string;
  /** Local ledger cash — authoritative even without TSE. */
  cashBalance: number;
  buyingPower: number;
  holdings: Holding[];
  /**
   * True only when holdings and performance fields come from live TSE quotes.
   * When false, totalValue may still contain the authoritative cash-only value.
   */
  valuationAvailable: boolean;
  /** Holdings value is null when valuationAvailable is false. */
  equityValue: number | null;
  /** Falls back to authoritative cash when market valuation is unavailable. */
  totalValue: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  totalReturn: number | null;
  totalReturnPercent: number | null;
  unrealizedReturn: number | null;
  unrealizedReturnPercent: number | null;
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
  /** Falls back to authoritative cash when live valuation is unavailable. */
  totalValue: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  valuationAvailable: boolean;
  /** Authoritative local cash when loaded; otherwise null. */
  cashBalance: number | null;
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
  /** Null when quotes are unavailable. */
  lastPrice: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  sparkline: PricePoint[];
  tradingStatus: SecurityTradingStatus;
  quoteAvailable: boolean;
};

/** Customer-safe crypto settlement fields for order presentation (never reserve internals). */
export type OrderCryptoSettlementSummary = {
  executedQuantity: string | null;
  grossTradeValue: string | null;
  /** Shown once — do not add cash-ledger fee rows on top of this. */
  totalFee: string | null;
  averageExecutionPrice: string | null;
  priceImpactPercent: string | null;
  customerCashDelta: string | null;
  walletPublicId: string | null;
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
  instrumentKind?: TerminalInstrumentKind;
  executionVenue?: "TSE" | "ALTA_CRYPTO";
  cryptoSettlement?: OrderCryptoSettlementSummary | null;
};

export type OrderPreviewInput = {
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number | null;
  /** Idempotency key forwarded to TSE/local order persistence. */
  clientKey?: string | null;
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

/** Portfolio cash/security activity — persisted locally and/or synced from TSE fills. */
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
  /** Running cash after this event (when provided). */
  cashAfter: number | null;
};

export type HomeDashboard = {
  marketStatus: MarketStatusSnapshot;
  marketDataAvailable: boolean;
  /** Null when valuation is unavailable — do not display as ƒ0.00. */
  combinedValue: number | null;
  combinedDayChange: number | null;
  combinedDayChangePercent: number | null;
  portfolios: TerminalPortfolioSummary[];
  watchlistPreview: WatchlistItem[];
  movers: { gainers: SecuritySummary[]; losers: SecuritySummary[] };
  recentOrders: OrderRecord[];
};

/** TSE adapter modes. `mock` is retained only for explicit UI Lab / test doubles. */
export type TseDataSourceMode = "unavailable" | "live" | "mock";

export type TseClientContext = {
  userId: string;
};

/**
 * External TSE market and execution interface.
 * Local portfolio/order/watchlist persistence is NOT part of this interface.
 */
export interface TseMarketClient {
  readonly mode: TseDataSourceMode;
  getMarketStatus(): Promise<MarketStatusSnapshot>;
  listSecurities(query?: string): Promise<SecuritySummary[]>;
  getSecurity(symbol: string): Promise<SecurityDetail | null>;
  getQuote(symbol: string): Promise<SecuritySummary | null>;
  getPriceHistory(symbol: string, range: TerminalChartRange): Promise<PricePoint[]>;
  previewOrder(input: OrderPreviewInput): Promise<OrderPreviewResult>;
  submitOrder(input: OrderPreviewInput): Promise<SubmitOrderResult>;
  cancelOrder(portfolioId: string, orderId: string): Promise<CancelOrderResult>;
}

/** @deprecated Prefer TseMarketClient — kept as alias during migration of call sites. */
export type TseClient = TseMarketClient;
