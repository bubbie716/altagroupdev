import type {
  HomeDashboard,
  MarketStatusSnapshot,
  OrderPreviewInput,
  OrderPreviewResult,
  OrderRecord,
  PortfolioSnapshot,
  PricePoint,
  SecurityDetail,
  SecuritySummary,
  SubmitOrderResult,
  CancelOrderResult,
  TerminalChartRange,
  TerminalPortfolioSummary,
  TseClient,
  WatchlistItem,
  Holding,
} from "@/lib/terminal/types";

const UNAVAILABLE_MSG = "Market connection unavailable";

function emptyPortfolio(portfolioId = ""): PortfolioSnapshot {
  return {
    portfolioId,
    equityValue: 0,
    cashBalance: 0,
    buyingPower: 0,
    totalValue: 0,
    dayChange: 0,
    dayChangePercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    unrealizedReturn: 0,
    unrealizedReturnPercent: 0,
    holdings: [],
    seriesByRange: {
      "1D": [],
      "1W": [],
      "1M": [],
      "3M": [],
      "1Y": [],
      ALL: [],
    },
  };
}

/** Production-safe client when no live TSE adapter is configured. */
export class UnavailableTseClient implements TseClient {
  readonly mode = "unavailable" as const;

  async getMarketStatus(): Promise<MarketStatusSnapshot> {
    return {
      status: "closed",
      label: UNAVAILABLE_MSG,
      asOf: new Date(0).toISOString(),
      nextOpenAt: null,
      nextCloseAt: null,
    };
  }

  async listSecurities(): Promise<SecuritySummary[]> {
    return [];
  }

  async getSecurity(): Promise<SecurityDetail | null> {
    return null;
  }

  async getQuote(): Promise<SecuritySummary | null> {
    return null;
  }

  async getPriceHistory(): Promise<PricePoint[]> {
    return [];
  }

  async getPortfolio(portfolioId: string): Promise<PortfolioSnapshot> {
    return emptyPortfolio(portfolioId);
  }

  async getHoldings(): Promise<Holding[]> {
    return [];
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return [];
  }

  async addToWatchlist(): Promise<WatchlistItem[]> {
    return [];
  }

  async removeFromWatchlist(): Promise<WatchlistItem[]> {
    return [];
  }

  async listOrders(): Promise<OrderRecord[]> {
    return [];
  }

  async previewOrder(input: OrderPreviewInput): Promise<OrderPreviewResult> {
    return {
      ok: false,
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      limitPrice: input.limitPrice ?? null,
      estimatedValue: 0,
      estimatedFees: 0,
      buyingPowerAfter: null,
      holdingsAfter: null,
      warnings: [],
      errors: [UNAVAILABLE_MSG],
    };
  }

  async submitOrder(_input: OrderPreviewInput): Promise<SubmitOrderResult> {
    return { ok: false, errors: [UNAVAILABLE_MSG], code: "unavailable" };
  }

  async cancelOrder(): Promise<CancelOrderResult> {
    return { ok: false, errors: [UNAVAILABLE_MSG] };
  }

  async getHomeDashboard(portfolios: TerminalPortfolioSummary[]): Promise<HomeDashboard> {
    return {
      marketStatus: await this.getMarketStatus(),
      combinedValue: 0,
      combinedDayChange: 0,
      combinedDayChangePercent: 0,
      portfolios,
      watchlistPreview: [],
      movers: { gainers: [], losers: [] },
      recentOrders: [],
    };
  }
}
