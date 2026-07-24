import type {
  HomeDashboard,
  MarketStatusSnapshot,
  OrderRecord,
  OrderPreviewInput,
  SecuritySummary,
  TerminalChartRange,
  TerminalPortfolioSummary,
  TseClient,
  TseClientContext,
  WatchlistItem,
} from "@/lib/terminal/types";
import {
  FIXTURE_CASH_BALANCE,
  FIXTURE_COMPANY_CASH,
  FIXTURE_COMPANY_LOTS,
  FIXTURE_EMPTY_CASH,
  FIXTURE_INITIAL_WATCHLIST,
  FIXTURE_MARKET_STATUS,
  FIXTURE_PERSONAL_CORE_LOTS,
  buildEmptyFixturePortfolio,
  buildFixtureOrders,
  buildFixturePortfolioFromLots,
  getFixturePriceHistory,
  getFixtureSecurity,
  listFixtureSecurities,
  mockPortfolioIds,
  watchlistFromSymbols,
  type FixtureLot,
} from "@/lib/terminal/terminal-fixtures";
import { validateOrderPreview } from "@/lib/terminal/order-validation";

type PortfolioMarketState = {
  cash: number;
  lots: FixtureLot[];
  orders: OrderRecord[];
  seriesSeed: number;
  seeded: "populated" | "empty" | "company";
};

function cloneLots(lots: FixtureLot[]): FixtureLot[] {
  return lots.map((lot) => ({ ...lot }));
}

/**
 * In-memory demonstration client. Deterministic fixtures; session mutations
 * do not touch Bank balances. All portfolio/order methods require portfolioId.
 */
export class MockTseClient implements TseClient {
  readonly mode = "mock" as const;
  readonly context: TseClientContext;

  private watchlistSymbols: string[] = [...FIXTURE_INITIAL_WATCHLIST];
  private orderSeq = 100;
  private readonly portfolios = new Map<string, PortfolioMarketState>();

  constructor(context: TseClientContext = { userId: "terminal-demo-user" }) {
    this.context = context;
    this.seedDefaultPortfolios();
  }

  private seedDefaultPortfolios() {
    const ids = mockPortfolioIds(this.context.userId);
    this.portfolios.set(ids.personalCore, {
      cash: FIXTURE_CASH_BALANCE,
      lots: cloneLots(FIXTURE_PERSONAL_CORE_LOTS),
      orders: buildFixtureOrders(ids.personalCore, "core"),
      seriesSeed: 9001,
      seeded: "populated",
    });
    this.portfolios.set(ids.personalGrowth, {
      cash: FIXTURE_EMPTY_CASH,
      lots: [],
      orders: buildFixtureOrders(ids.personalGrowth, "empty"),
      seriesSeed: 9002,
      seeded: "empty",
    });
    this.portfolios.set(ids.companyAltg, {
      cash: FIXTURE_COMPANY_CASH,
      lots: cloneLots(FIXTURE_COMPANY_LOTS),
      orders: buildFixtureOrders(ids.companyAltg, "company"),
      seriesSeed: 9100,
      seeded: "company",
    });
  }

  async ensurePortfolioMarketState(
    portfolioId: string,
    seed: "populated" | "empty" = "empty",
  ): Promise<void> {
    if (this.portfolios.has(portfolioId)) return;
    if (seed === "populated") {
      this.portfolios.set(portfolioId, {
        cash: FIXTURE_CASH_BALANCE,
        lots: cloneLots(FIXTURE_PERSONAL_CORE_LOTS),
        orders: buildFixtureOrders(portfolioId, "core"),
        seriesSeed: 9200 + this.portfolios.size,
        seeded: "populated",
      });
      return;
    }
    this.portfolios.set(portfolioId, {
      cash: FIXTURE_EMPTY_CASH,
      lots: [],
      orders: [],
      seriesSeed: 9300 + this.portfolios.size,
      seeded: "empty",
    });
  }

  private requireState(portfolioId: string): PortfolioMarketState {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Unknown portfolio: ${portfolioId}`);
    }
    return state;
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

  async getPortfolio(portfolioId: string) {
    await this.ensurePortfolioMarketState(portfolioId, "empty");
    const state = this.requireState(portfolioId);
    if (state.lots.length === 0) {
      return buildEmptyFixturePortfolio(state.cash, portfolioId);
    }
    return buildFixturePortfolioFromLots(portfolioId, state.lots, state.cash, state.seriesSeed);
  }

  async getHoldings(portfolioId: string) {
    return (await this.getPortfolio(portfolioId)).holdings;
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

  async listOrders(portfolioId: string) {
    await this.ensurePortfolioMarketState(portfolioId, "empty");
    const state = this.requireState(portfolioId);
    return [...state.orders].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async previewOrder(input: OrderPreviewInput) {
    if (!input.portfolioId?.trim()) {
      return {
        ok: false,
        portfolioId: "",
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
        errors: ["Portfolio is required"],
      };
    }
    const security = getFixtureSecurity(input.symbol);
    const portfolio = await this.getPortfolio(input.portfolioId);
    const market = await this.getMarketStatus();
    const holding = portfolio.holdings.find((h) => h.symbol === input.symbol.toUpperCase()) ?? null;
    const preview = validateOrderPreview({
      order: { ...input, symbol: input.symbol.toUpperCase() },
      security,
      marketStatus: market.status,
      buyingPower: portfolio.buyingPower,
      holding,
    });
    return { ...preview, portfolioId: input.portfolioId };
  }

  async submitOrder(input: OrderPreviewInput) {
    if (!input.portfolioId?.trim()) {
      return {
        ok: false as const,
        errors: ["Portfolio is required"],
        code: "portfolio_required" as const,
      };
    }
    const preview = await this.previewOrder(input);
    if (!preview.ok) {
      const code = preview.errors.some((e) => /halted/i.test(e))
        ? ("halted" as const)
        : preview.errors.some((e) => /closed/i.test(e))
          ? ("market_closed" as const)
          : preview.errors.some((e) => /portfolio/i.test(e))
            ? ("portfolio_required" as const)
            : ("validation" as const);
      return { ok: false as const, errors: preview.errors, code };
    }

    const security = getFixtureSecurity(input.symbol)!;
    const state = this.requireState(input.portfolioId);
    const now = "2026-07-21T16:05:00.000Z";
    this.orderSeq += 1;
    const order: OrderRecord = {
      id: `ord_mock_${this.orderSeq}`,
      portfolioId: input.portfolioId,
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
        state.cash = Number(
          (state.cash - preview.estimatedValue - preview.estimatedFees).toFixed(2),
        );
        const existing = state.lots.find((l) => l.symbol === security.symbol);
        if (existing) {
          const totalQty = existing.quantity + input.quantity;
          const totalCost =
            existing.quantity * existing.averageCost + input.quantity * security.lastPrice;
          existing.quantity = totalQty;
          existing.averageCost = Number((totalCost / totalQty).toFixed(4));
        } else {
          state.lots.push({
            symbol: security.symbol,
            quantity: input.quantity,
            averageCost: security.lastPrice,
          });
        }
      } else {
        state.cash = Number(
          (state.cash + preview.estimatedValue - preview.estimatedFees).toFixed(2),
        );
        const existing = state.lots.find((l) => l.symbol === security.symbol);
        if (existing) {
          existing.quantity -= input.quantity;
          if (existing.quantity <= 0) {
            state.lots = state.lots.filter((l) => l.symbol !== security.symbol);
          }
        }
      }
    }

    state.orders = [order, ...state.orders];
    return { ok: true as const, order };
  }

  async cancelOrder(portfolioId: string, orderId: string) {
    const state = this.requireState(portfolioId);
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false as const, errors: ["Order not found"] };
    if (order.status !== "open" && order.status !== "partial") {
      return { ok: false as const, errors: ["Only open orders can be cancelled"] };
    }
    const updated: OrderRecord = {
      ...order,
      status: "cancelled",
      updatedAt: "2026-07-21T16:06:00.000Z",
    };
    state.orders = state.orders.map((o) => (o.id === orderId ? updated : o));
    return { ok: true as const, order: updated };
  }

  async getHomeDashboard(portfolios: TerminalPortfolioSummary[]): Promise<HomeDashboard> {
    const [watchlistPreview, securities, marketStatus] = await Promise.all([
      this.getWatchlist(),
      this.listSecurities(),
      this.getMarketStatus(),
    ]);

    const enriched: TerminalPortfolioSummary[] = [];
    const allOrders: OrderRecord[] = [];
    let combinedValue = 0;
    let combinedDayChange = 0;

    for (const p of portfolios) {
      try {
        const snap = await this.getPortfolio(p.id);
        combinedValue += snap.totalValue;
        combinedDayChange += snap.dayChange;
        enriched.push({
          ...p,
          totalValue: snap.totalValue,
          dayChange: snap.dayChange,
          dayChangePercent: snap.dayChangePercent,
        });
        allOrders.push(...(await this.listOrders(p.id)));
      } catch {
        enriched.push(p);
      }
    }

    const prior = combinedValue - combinedDayChange;
    const tradable = securities.filter((s) => s.tradingStatus !== "halted");
    const gainers = [...tradable]
      .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
      .slice(0, 5);
    const losers = [...tradable]
      .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
      .slice(0, 5);

    return {
      marketStatus,
      combinedValue: Number(combinedValue.toFixed(2)),
      combinedDayChange: Number(combinedDayChange.toFixed(2)),
      combinedDayChangePercent:
        prior > 0 ? Number(((combinedDayChange / prior) * 100).toFixed(2)) : 0,
      portfolios: enriched,
      watchlistPreview: watchlistPreview.slice(0, 5),
      movers: { gainers, losers },
      recentOrders: allOrders
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, 8),
    };
  }
}
