import type {
  CancelOrderResult,
  HomeDashboard,
  MarketStatusSnapshot,
  OrderRecord,
  OrderPreviewInput,
  OrderPreviewResult,
  PortfolioActivityRecord,
  PortfolioSnapshot,
  PricePoint,
  SecurityDetail,
  SecuritySummary,
  SubmitOrderResult,
  TerminalChartRange,
  TerminalPortfolioSummary,
  TseClientContext,
  WatchlistItem,
} from "@/lib/terminal/types";
import {
  FIXTURE_EMPTY_CASH,
  FIXTURE_INITIAL_WATCHLIST,
  FIXTURE_MARKET_STATUS,
  getFixturePriceHistory,
  getFixtureSecurity,
  listFixtureSecurities,
  mockPortfolioIds,
  watchlistFromSymbols,
  type FixtureLot,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";
import {
  FIXTURE_PROFILES,
  applyFixtureLedger,
  buildSnapshotFromLedger,
  type FixtureProfileKey,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-fixture-ledger";
import { validateOrderPreview } from "@/lib/terminal/order-validation";
import { isUiLabMode } from "@/lib/auth/ui-lab";

type PortfolioMarketState = {
  profile: FixtureProfileKey;
  cash: number;
  lots: FixtureLot[];
  orders: OrderRecord[];
  activity: PortfolioActivityRecord[];
  seriesSeed: number;
};

function cloneLots(lots: FixtureLot[]): FixtureLot[] {
  return lots.map((lot) => ({ ...lot }));
}

function stateFromProfile(portfolioId: string, key: FixtureProfileKey): PortfolioMarketState {
  const profile = FIXTURE_PROFILES[key];
  const applied = applyFixtureLedger(portfolioId, profile);
  return {
    profile: key,
    cash: applied.cash,
    lots: cloneLots(applied.lots),
    orders: applied.orders.map((o) => ({ ...o })),
    activity: applied.activity.map((a) => ({ ...a })),
    seriesSeed: profile.seriesSeed,
  };
}

/**
 * UI Lab ONLY — in-memory demonstration market/portfolio state.
 * Must never execute outside `isUiLabMode()`. Does not write to PostgreSQL.
 */
export class UiLabDemonstrationTseClient {
  readonly mode = "mock" as const;
  readonly context: TseClientContext;

  private watchlistSymbols: string[] = [...FIXTURE_INITIAL_WATCHLIST];
  private orderSeq = 100;
  private readonly portfolios = new Map<string, PortfolioMarketState>();

  constructor(context: TseClientContext = { userId: "ui-lab-user" }) {
    this.context = context;
    this.seedDefaultPortfolios();
  }

  private seedDefaultPortfolios() {
    const ids = mockPortfolioIds(this.context.userId);
    this.portfolios.set(ids.personalCore, stateFromProfile(ids.personalCore, "core"));
    this.portfolios.set(ids.personalGrowth, stateFromProfile(ids.personalGrowth, "growth"));
    this.portfolios.set(ids.personalIncome, stateFromProfile(ids.personalIncome, "income"));
    this.portfolios.set(ids.personalActive, stateFromProfile(ids.personalActive, "active"));
    this.portfolios.set(ids.companyAltg, stateFromProfile(ids.companyAltg, "treasury"));
  }

  async ensurePortfolioMarketState(
    portfolioId: string,
    seed: "populated" | "empty" = "empty",
  ): Promise<void> {
    if (this.portfolios.has(portfolioId)) return;
    if (seed === "populated") {
      this.portfolios.set(portfolioId, stateFromProfile(portfolioId, "core"));
      return;
    }
    this.portfolios.set(portfolioId, {
      profile: "empty",
      cash: FIXTURE_EMPTY_CASH,
      lots: [],
      orders: [],
      activity: [
        {
          id: `act_${portfolioId}_open`,
          portfolioId,
          kind: "cash_deposit",
          occurredAt: "2026-07-21T12:00:00.000Z",
          amount: FIXTURE_EMPTY_CASH,
          symbol: null,
          quantity: null,
          price: null,
          orderId: null,
          description: "Opening cash",
          cashAfter: FIXTURE_EMPTY_CASH,
        },
      ],
      seriesSeed: 9300 + this.portfolios.size,
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
    return listFixtureSecurities(query);
  }

  async getSecurity(symbol: string): Promise<SecurityDetail | null> {
    return getFixtureSecurity(symbol);
  }

  async getQuote(symbol: string): Promise<SecuritySummary | null> {
    const detail = getFixtureSecurity(symbol);
    if (!detail) return null;
    const { open: _o, high: _h, low: _l, description: _d, sector: _s, ...summary } = detail;
    return summary;
  }

  async getPriceHistory(symbol: string, range: TerminalChartRange): Promise<PricePoint[]> {
    return getFixturePriceHistory(symbol, range);
  }

  async getPortfolio(portfolioId: string): Promise<PortfolioSnapshot> {
    const state = this.requireState(portfolioId);
    const applied = {
      cash: state.cash,
      lots: state.lots,
      orders: state.orders,
      activity: state.activity,
    };
    return buildSnapshotFromLedger(portfolioId, applied, FIXTURE_PROFILES[state.profile]);
  }

  async getHoldings(portfolioId: string) {
    return (await this.getPortfolio(portfolioId)).holdings;
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return watchlistFromSymbols(this.watchlistSymbols);
  }

  async addToWatchlist(symbol: string): Promise<WatchlistItem[]> {
    const upper = symbol.trim().toUpperCase();
    if (!this.watchlistSymbols.includes(upper) && getFixtureSecurity(upper)) {
      this.watchlistSymbols.push(upper);
    }
    return this.getWatchlist();
  }

  async removeFromWatchlist(symbol: string): Promise<WatchlistItem[]> {
    const upper = symbol.trim().toUpperCase();
    this.watchlistSymbols = this.watchlistSymbols.filter((s) => s !== upper);
    return this.getWatchlist();
  }

  async listOrders(portfolioId: string): Promise<OrderRecord[]> {
    return this.requireState(portfolioId).orders.map((o) => ({ ...o }));
  }

  async listPortfolioActivity(portfolioId: string): Promise<PortfolioActivityRecord[]> {
    return this.requireState(portfolioId).activity.map((a) => ({ ...a }));
  }

  async previewOrder(input: OrderPreviewInput): Promise<OrderPreviewResult> {
    const state = this.requireState(input.portfolioId);
    const security = getFixtureSecurity(input.symbol);
    const lot = state.lots.find((l) => l.symbol === input.symbol.toUpperCase());
    const holding = lot
      ? {
          symbol: lot.symbol,
          name: lot.symbol,
          quantity: lot.quantity,
          averageCost: lot.averageCost,
          lastPrice: security?.lastPrice ?? null,
          marketValue: null,
          totalReturn: null,
          totalReturnPercent: null,
          dayReturn: null,
          dayReturnPercent: null,
          weightPercent: null,
          sparkline: [],
        }
      : null;
    return validateOrderPreview({
      order: input,
      security,
      buyingPower: state.cash,
      holding,
      marketStatus: FIXTURE_MARKET_STATUS.status,
    });
  }

  async submitOrder(input: OrderPreviewInput): Promise<SubmitOrderResult> {
    const preview = await this.previewOrder(input);
    if (!preview.ok) {
      return { ok: false, errors: preview.errors, code: "validation" };
    }
    const state = this.requireState(input.portfolioId);
    const security = getFixtureSecurity(input.symbol)!;
    const id = `ord_uilab_${++this.orderSeq}`;
    const now = "2026-07-21T16:05:00.000Z";
    const isMarket = input.type === "market";
    const order: OrderRecord = {
      id,
      portfolioId: input.portfolioId,
      symbol: security.symbol,
      name: security.name,
      side: input.side,
      type: input.type,
      status: isMarket ? "filled" : "open",
      quantity: input.quantity,
      filledQuantity: isMarket ? input.quantity : 0,
      limitPrice: input.limitPrice ?? null,
      averageFillPrice: isMarket ? security.lastPrice : null,
      estimatedValue: preview.estimatedValue,
      submittedAt: now,
      updatedAt: now,
      rejectReason: null,
    };
    state.orders = [order, ...state.orders];
    if (isMarket) {
      const notional = input.quantity * security.lastPrice;
      const fee = Number((notional * 0.001).toFixed(2));
      if (input.side === "buy") {
        state.cash = Number((state.cash - notional - fee).toFixed(2));
        const existing = state.lots.find((l) => l.symbol === security.symbol);
        if (existing) {
          const totalQty = existing.quantity + input.quantity;
          existing.averageCost = Number(
            (
              (existing.averageCost * existing.quantity + security.lastPrice * input.quantity) /
              totalQty
            ).toFixed(6),
          );
          existing.quantity = totalQty;
        } else {
          state.lots.push({
            symbol: security.symbol,
            quantity: input.quantity,
            averageCost: security.lastPrice,
          });
        }
        state.activity.unshift({
          id: `act_${id}`,
          portfolioId: input.portfolioId,
          kind: "buy_fill",
          occurredAt: now,
          amount: Number((-(notional + fee)).toFixed(2)),
          symbol: security.symbol,
          quantity: input.quantity,
          price: security.lastPrice,
          orderId: id,
          description: `Bought ${input.quantity} ${security.symbol}`,
          cashAfter: state.cash,
        });
      } else {
        state.cash = Number((state.cash + notional - fee).toFixed(2));
        const existing = state.lots.find((l) => l.symbol === security.symbol);
        if (existing) existing.quantity = Number((existing.quantity - input.quantity).toFixed(8));
        state.lots = state.lots.filter((l) => l.quantity > 0);
        state.activity.unshift({
          id: `act_${id}`,
          portfolioId: input.portfolioId,
          kind: "sell_fill",
          occurredAt: now,
          amount: Number((notional - fee).toFixed(2)),
          symbol: security.symbol,
          quantity: input.quantity,
          price: security.lastPrice,
          orderId: id,
          description: `Sold ${input.quantity} ${security.symbol}`,
          cashAfter: state.cash,
        });
      }
    }
    return { ok: true, order };
  }

  async cancelOrder(portfolioId: string, orderId: string): Promise<CancelOrderResult> {
    const state = this.requireState(portfolioId);
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, errors: ["Order not found"] };
    if (order.status !== "open" && order.status !== "partial") {
      return { ok: false, errors: ["Only open orders can be cancelled"] };
    }
    const updated: OrderRecord = {
      ...order,
      status: "cancelled",
      updatedAt: "2026-07-21T16:10:00.000Z",
    };
    state.orders = state.orders.map((o) => (o.id === orderId ? updated : o));
    return { ok: true, order: updated };
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
        combinedValue += snap.totalValue ?? 0;
        combinedDayChange += snap.dayChange ?? 0;
        enriched.push({
          ...p,
          totalValue: snap.totalValue,
          dayChange: snap.dayChange,
          dayChangePercent: snap.dayChangePercent,
          valuationAvailable: true,
          cashBalance: snap.cashBalance,
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
      marketDataAvailable: true,
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

/** @deprecated Use UiLabDemonstrationTseClient — alias for test migration. */
export const MockTseClient = UiLabDemonstrationTseClient;

const uiLabClients = new Map<string, UiLabDemonstrationTseClient>();

/** UI Lab ONLY — returns demonstration client when gate succeeds. */
export function getUiLabDemonstrationClient(userId: string): UiLabDemonstrationTseClient {
  if (!isUiLabMode()) {
    throw new Error("UI Lab demonstration client is not available outside UI Lab mode");
  }
  let client = uiLabClients.get(userId);
  if (!client) {
    client = new UiLabDemonstrationTseClient({ userId });
    uiLabClients.set(userId, client);
  }
  return client;
}

export function resetUiLabDemonstrationClientsForTests() {
  uiLabClients.clear();
}
