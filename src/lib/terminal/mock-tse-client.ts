import type {
  MarketStatusSnapshot,
  OrderRecord,
  OrderPreviewInput,
  SecuritySummary,
  TerminalChartRange,
  TseClient,
  TseClientContext,
  WatchlistItem,
} from "@/lib/terminal/types";
import {
  FIXTURE_CASH_BALANCE,
  FIXTURE_INITIAL_WATCHLIST,
  FIXTURE_MARKET_STATUS,
  buildEmptyFixturePortfolio,
  buildFixtureOrders,
  buildFixturePortfolio,
  getFixturePriceHistory,
  getFixtureSecurity,
  listFixtureSecurities,
  watchlistFromSymbols,
} from "@/lib/terminal/terminal-fixtures";
import { validateOrderPreview } from "@/lib/terminal/order-validation";

export type MockPortfolioMode = "populated" | "empty";

/**
 * In-memory demonstration client. Deterministic fixtures; session mutations
 * do not touch Bank balances or persist to a database.
 */
export class MockTseClient implements TseClient {
  readonly mode = "mock" as const;
  readonly context: TseClientContext;

  private cash = FIXTURE_CASH_BALANCE;
  private watchlistSymbols: string[] = [...FIXTURE_INITIAL_WATCHLIST];
  private orders = buildFixtureOrders();
  private portfolioMode: MockPortfolioMode = "populated";
  private orderSeq = 100;

  constructor(context: TseClientContext = { userId: "terminal-demo-user" }) {
    this.context = context;
  }

  setPortfolioMode(mode: MockPortfolioMode) {
    this.portfolioMode = mode;
  }

  async getMarketStatus(): Promise<MarketStatusSnapshot> {
    return { ...FIXTURE_MARKET_STATUS };
  }

  async listSecurities(query?: string): Promise<SecuritySummary[]> {
    const q = query?.trim().toLowerCase() ?? "";
    const all = listFixtureSecurities();
    if (!q) return all;
    return all.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }

  async getSecurity(symbol: string) {
    return getFixtureSecurity(symbol);
  }

  async getQuote(symbol: string) {
    const detail = getFixtureSecurity(symbol);
    if (!detail) return null;
    const { open: _o, high: _h, low: _l, description: _d, sector: _s, ...summary } = detail;
    return summary;
  }

  async getPriceHistory(symbol: string, range: TerminalChartRange) {
    return getFixturePriceHistory(symbol, range);
  }

  async getPortfolio() {
    if (this.portfolioMode === "empty") {
      return buildEmptyFixturePortfolio(this.cash);
    }
    return buildFixturePortfolio(listFixtureSecurities(), this.cash);
  }

  async getHoldings() {
    return (await this.getPortfolio()).holdings;
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return watchlistFromSymbols(this.watchlistSymbols);
  }

  async addToWatchlist(symbol: string) {
    const upper = symbol.toUpperCase();
    if (!getFixtureSecurity(upper)) return this.getWatchlist();
    if (!this.watchlistSymbols.includes(upper)) {
      this.watchlistSymbols = [...this.watchlistSymbols, upper];
    }
    return this.getWatchlist();
  }

  async removeFromWatchlist(symbol: string) {
    const upper = symbol.toUpperCase();
    this.watchlistSymbols = this.watchlistSymbols.filter((s) => s !== upper);
    return this.getWatchlist();
  }

  async listOrders() {
    return [...this.orders].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async previewOrder(input: OrderPreviewInput) {
    const security = getFixtureSecurity(input.symbol);
    const portfolio = await this.getPortfolio();
    const market = await this.getMarketStatus();
    const holding = portfolio.holdings.find((h) => h.symbol === input.symbol.toUpperCase()) ?? null;
    return validateOrderPreview({
      order: { ...input, symbol: input.symbol.toUpperCase() },
      security,
      marketStatus: market.status,
      buyingPower: portfolio.buyingPower,
      holding,
    });
  }

  async submitOrder(input: OrderPreviewInput) {
    const preview = await this.previewOrder(input);
    if (!preview.ok) {
      const code = preview.errors.some((e) => /halted/i.test(e))
        ? ("halted" as const)
        : preview.errors.some((e) => /closed/i.test(e))
          ? ("market_closed" as const)
          : ("validation" as const);
      return { ok: false as const, errors: preview.errors, code };
    }

    const security = getFixtureSecurity(input.symbol)!;
    const now = "2026-07-21T16:05:00.000Z";
    this.orderSeq += 1;
    const order: OrderRecord = {
      id: `ord_mock_${this.orderSeq}`,
      symbol: security.symbol,
      name: security.name,
      side: input.side,
      type: input.type,
      status: input.type === "market" ? "filled" : "open",
      quantity: input.quantity,
      filledQuantity: input.type === "market" ? input.quantity : 0,
      limitPrice: input.type === "limit" ? (input.limitPrice ?? null) : null,
      averageFillPrice: input.type === "market" ? security.lastPrice : null,
      estimatedValue: preview.estimatedValue,
      submittedAt: now,
      updatedAt: now,
      rejectReason: null,
    };

    if (input.type === "market") {
      if (input.side === "buy") {
        this.cash = Number((this.cash - preview.estimatedValue - preview.estimatedFees).toFixed(2));
      } else {
        this.cash = Number((this.cash + preview.estimatedValue - preview.estimatedFees).toFixed(2));
      }
    }

    this.orders = [order, ...this.orders];
    return { ok: true as const, order };
  }

  async cancelOrder(orderId: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false as const, errors: ["Order not found"] };
    if (order.status !== "open" && order.status !== "partial") {
      return { ok: false as const, errors: ["Only open orders can be cancelled"] };
    }
    const updated: OrderRecord = {
      ...order,
      status: "cancelled",
      updatedAt: "2026-07-21T16:06:00.000Z",
    };
    this.orders = this.orders.map((o) => (o.id === orderId ? updated : o));
    return { ok: true as const, order: updated };
  }

  async getHomeDashboard() {
    const [portfolio, watchlistPreview, securities, recentOrders, marketStatus] = await Promise.all(
      [
        this.getPortfolio(),
        this.getWatchlist(),
        this.listSecurities(),
        this.listOrders(),
        this.getMarketStatus(),
      ],
    );
    const tradable = securities.filter((s) => s.tradingStatus !== "halted");
    const gainers = [...tradable]
      .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
      .slice(0, 5);
    const losers = [...tradable]
      .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
      .slice(0, 5);
    return {
      portfolio,
      watchlistPreview: watchlistPreview.slice(0, 5),
      movers: { gainers, losers },
      recentOrders: recentOrders.slice(0, 5),
      marketStatus,
    };
  }
}
