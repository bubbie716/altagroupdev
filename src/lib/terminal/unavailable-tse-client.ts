import type {
  CancelOrderResult,
  HomeDashboard,
  MarketStatusSnapshot,
  OrderPreviewInput,
  OrderPreviewResult,
  PortfolioSnapshot,
  PricePoint,
  SecurityDetail,
  SecuritySummary,
  SubmitOrderResult,
  TerminalChartRange,
  TseClient,
} from "@/lib/terminal/types";

const UNAVAILABLE_MSG = "Market connection unavailable";

function emptySeries(): Record<TerminalChartRange, PricePoint[]> {
  return {
    "1D": [],
    "1W": [],
    "1M": [],
    "3M": [],
    "1Y": [],
    ALL: [],
  };
}

/** Production-safe market client when no live TSE adapter is configured. */
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
}

/** Empty local portfolio snapshot used when no DB row exists yet. */
export function emptyLocalPortfolioSnapshot(portfolioId = ""): PortfolioSnapshot {
  return {
    portfolioId,
    cashBalance: 0,
    buyingPower: 0,
    holdings: [],
    valuationAvailable: false,
    equityValue: null,
    totalValue: null,
    dayChange: null,
    dayChangePercent: null,
    totalReturn: null,
    totalReturnPercent: null,
    unrealizedReturn: null,
    unrealizedReturnPercent: null,
    seriesByRange: emptySeries(),
  };
}

export function emptyHomeDashboard(): HomeDashboard {
  return {
    marketStatus: {
      status: "closed",
      label: UNAVAILABLE_MSG,
      asOf: new Date(0).toISOString(),
      nextOpenAt: null,
      nextCloseAt: null,
    },
    marketDataAvailable: false,
    combinedValue: null,
    combinedDayChange: null,
    combinedDayChangePercent: null,
    portfolios: [],
    watchlistPreview: [],
    movers: { gainers: [], losers: [] },
    recentOrders: [],
  };
}
