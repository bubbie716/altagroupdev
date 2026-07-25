/**
 * Deterministic portfolio ledgers for MockTseClient.
 * Each profile starts from an opening cash balance and applies dated events
 * chronologically so cash, holdings, orders, activity, and charts reconcile.
 */
import type {
  OrderRecord,
  PortfolioActivityRecord,
  PortfolioSnapshot,
  PricePoint,
  TerminalChartRange,
} from "@/lib/terminal/types";
import {
  buildAnchoredSeries,
  buildEmptyFixturePortfolio,
  buildFixturePortfolioFromLots,
  getFixtureSecurity,
  type FixtureLot,
} from "@/lib/terminal/terminal-fixtures";

export type FixtureProfileKey = "core" | "growth" | "income" | "active" | "treasury" | "empty";

type LedgerEventBase = {
  id: string;
  at: string;
};

type DepositEvent = LedgerEventBase & { kind: "deposit"; amount: number; note?: string };
type WithdrawalEvent = LedgerEventBase & { kind: "withdrawal"; amount: number; note?: string };
type BuyFillEvent = LedgerEventBase & {
  kind: "buy_fill";
  symbol: string;
  quantity: number;
  price: number;
  fee?: number;
  orderStatus?: "filled" | "partial";
  orderType?: "market" | "limit";
  limitPrice?: number;
};
type SellFillEvent = LedgerEventBase & {
  kind: "sell_fill";
  symbol: string;
  quantity: number;
  price: number;
  fee?: number;
  orderStatus?: "filled" | "partial";
  orderType?: "market" | "limit";
  limitPrice?: number;
};
type DividendEvent = LedgerEventBase & {
  kind: "dividend";
  symbol: string;
  amount: number;
};
type FeeEvent = LedgerEventBase & { kind: "fee"; amount: number; note?: string };
type AdjustmentEvent = LedgerEventBase & {
  kind: "adjustment";
  amount: number;
  note: string;
};
type OpenOrderEvent = LedgerEventBase & {
  kind: "open_order";
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  limitPrice: number;
};
type CancelledOrderEvent = LedgerEventBase & {
  kind: "cancelled_order";
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  limitPrice: number;
  cancelledAt: string;
};
type RejectedOrderEvent = LedgerEventBase & {
  kind: "rejected_order";
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  reason: string;
};

export type LedgerEvent =
  | DepositEvent
  | WithdrawalEvent
  | BuyFillEvent
  | SellFillEvent
  | DividendEvent
  | FeeEvent
  | AdjustmentEvent
  | OpenOrderEvent
  | CancelledOrderEvent
  | RejectedOrderEvent;

export type FixtureProfileDefinition = {
  key: FixtureProfileKey;
  name: string;
  openingCash: number;
  openingAt: string;
  seriesSeed: number;
  /** Volatility shaping for portfolio value charts (investment performance only). */
  chartVolatility: number;
  events: LedgerEvent[];
};

function money(n: number): number {
  return Number(n.toFixed(2));
}

function securityName(symbol: string): string {
  return getFixtureSecurity(symbol)?.name ?? symbol;
}

export const FIXTURE_PROFILES: Record<FixtureProfileKey, FixtureProfileDefinition> = {
  core: {
    key: "core",
    name: "Core Portfolio",
    openingCash: 25_000,
    openingAt: "2025-10-01T14:00:00.000Z",
    seriesSeed: 9001,
    chartVolatility: 0.006,
    events: [
      { id: "c_dep1", kind: "deposit", at: "2025-10-01T14:00:00.000Z", amount: 25_000, note: "Opening deposit" },
      { id: "c_buy1", kind: "buy_fill", at: "2025-10-03T15:12:00.000Z", symbol: "ALTA", quantity: 40, price: 110.25, fee: 4.5 },
      { id: "c_buy2", kind: "buy_fill", at: "2025-10-08T14:40:00.000Z", symbol: "UTIL", quantity: 50, price: 49.8, fee: 3.2 },
      { id: "c_buy3", kind: "buy_fill", at: "2025-11-04T16:05:00.000Z", symbol: "GOLD", quantity: 25, price: 61.4, fee: 3.8 },
      { id: "c_dep2", kind: "deposit", at: "2025-12-02T13:00:00.000Z", amount: 2_500, note: "Monthly contribution" },
      { id: "c_div1", kind: "dividend", at: "2026-01-15T12:00:00.000Z", symbol: "UTIL", amount: 42.5 },
      { id: "c_buy4", kind: "buy_fill", at: "2026-02-10T15:30:00.000Z", symbol: "AGRI", quantity: 35, price: 31.2, fee: 2.9 },
      { id: "c_div2", kind: "dividend", at: "2026-04-15T12:00:00.000Z", symbol: "UTIL", amount: 44.0 },
      { id: "c_sell1", kind: "sell_fill", at: "2026-05-20T15:10:00.000Z", symbol: "UTIL", quantity: 20, price: 53.1, fee: 2.5 },
      { id: "c_dep3", kind: "deposit", at: "2026-06-02T13:00:00.000Z", amount: 1_500, note: "Monthly contribution" },
      { id: "c_div3", kind: "dividend", at: "2026-07-15T12:00:00.000Z", symbol: "UTIL", amount: 28.0 },
      {
        id: "c_open1",
        kind: "open_order",
        at: "2026-07-21T13:42:00.000Z",
        symbol: "ALTA",
        side: "buy",
        quantity: 10,
        limitPrice: 126.5,
      },
      {
        id: "c_rej1",
        kind: "rejected_order",
        at: "2026-07-21T12:05:00.000Z",
        symbol: "HALT",
        side: "buy",
        quantity: 20,
        reason: "Security is halted",
      },
      {
        id: "c_can1",
        kind: "cancelled_order",
        at: "2026-07-17T14:02:00.000Z",
        symbol: "CYBR",
        side: "sell",
        quantity: 5,
        limitPrice: 98,
        cancelledAt: "2026-07-17T16:01:00.000Z",
      },
    ],
  },
  growth: {
    key: "growth",
    name: "Growth Portfolio",
    openingCash: 40_000,
    openingAt: "2025-09-15T14:00:00.000Z",
    seriesSeed: 9102,
    chartVolatility: 0.014,
    events: [
      { id: "g_dep1", kind: "deposit", at: "2025-09-15T14:00:00.000Z", amount: 40_000, note: "Seed capital" },
      { id: "g_buy1", kind: "buy_fill", at: "2025-09-16T15:00:00.000Z", symbol: "MINE", quantity: 400, price: 14.2, fee: 8 },
      { id: "g_buy2", kind: "buy_fill", at: "2025-09-22T14:20:00.000Z", symbol: "CYBR", quantity: 120, price: 78.5, fee: 9.5 },
      { id: "g_sell1", kind: "sell_fill", at: "2025-11-08T15:45:00.000Z", symbol: "MINE", quantity: 150, price: 12.1, fee: 6 },
      { id: "g_buy3", kind: "buy_fill", at: "2025-12-03T16:10:00.000Z", symbol: "ALTA", quantity: 60, price: 118.0, fee: 7 },
      { id: "g_buy4", kind: "buy_fill", at: "2026-01-14T14:55:00.000Z", symbol: "CYBR", quantity: 40, price: 102.4, fee: 5.5 },
      { id: "g_sell2", kind: "sell_fill", at: "2026-03-05T15:20:00.000Z", symbol: "CYBR", quantity: 50, price: 88.0, fee: 5 },
      { id: "g_buy5", kind: "buy_fill", at: "2026-04-22T13:40:00.000Z", symbol: "MINE", quantity: 200, price: 16.8, fee: 6.5 },
      { id: "g_fee1", kind: "fee", at: "2026-05-01T12:00:00.000Z", amount: 12.5, note: "Platform fee" },
      {
        id: "g_part1",
        kind: "buy_fill",
        at: "2026-07-18T15:10:00.000Z",
        symbol: "MINE",
        quantity: 50,
        price: 17.9,
        fee: 3,
        orderStatus: "partial",
        orderType: "limit",
        limitPrice: 18.0,
      },
      {
        id: "g_open1",
        kind: "open_order",
        at: "2026-07-20T14:00:00.000Z",
        symbol: "CYBR",
        side: "buy",
        quantity: 25,
        limitPrice: 89.5,
      },
      {
        id: "g_rej1",
        kind: "rejected_order",
        at: "2026-07-19T15:30:00.000Z",
        symbol: "MINE",
        side: "buy",
        quantity: 500,
        reason: "Insufficient buying power",
      },
    ],
  },
  income: {
    key: "income",
    name: "Income Portfolio",
    openingCash: 55_000,
    openingAt: "2025-08-01T14:00:00.000Z",
    seriesSeed: 9203,
    chartVolatility: 0.004,
    events: [
      { id: "i_dep1", kind: "deposit", at: "2025-08-01T14:00:00.000Z", amount: 55_000, note: "Income sleeve funding" },
      { id: "i_buy1", kind: "buy_fill", at: "2025-08-05T15:00:00.000Z", symbol: "UTIL", quantity: 200, price: 51.2, fee: 6 },
      { id: "i_buy2", kind: "buy_fill", at: "2025-08-12T14:30:00.000Z", symbol: "GOLD", quantity: 80, price: 58.9, fee: 5 },
      { id: "i_buy3", kind: "buy_fill", at: "2025-09-10T15:15:00.000Z", symbol: "AGRI", quantity: 150, price: 30.5, fee: 4.5 },
      { id: "i_div1", kind: "dividend", at: "2025-10-15T12:00:00.000Z", symbol: "UTIL", amount: 175 },
      { id: "i_div2", kind: "dividend", at: "2026-01-15T12:00:00.000Z", symbol: "UTIL", amount: 180 },
      { id: "i_div3", kind: "dividend", at: "2026-01-20T12:00:00.000Z", symbol: "AGRI", amount: 62 },
      { id: "i_buy4", kind: "buy_fill", at: "2026-02-18T14:45:00.000Z", symbol: "UTIL", quantity: 40, price: 52.8, fee: 3 },
      { id: "i_div4", kind: "dividend", at: "2026-04-15T12:00:00.000Z", symbol: "UTIL", amount: 210 },
      { id: "i_div5", kind: "dividend", at: "2026-07-15T12:00:00.000Z", symbol: "UTIL", amount: 215 },
      { id: "i_wd1", kind: "withdrawal", at: "2026-07-16T13:00:00.000Z", amount: 500, note: "Income distribution" },
      {
        id: "i_open1",
        kind: "open_order",
        at: "2026-07-21T14:10:00.000Z",
        symbol: "GOLD",
        side: "buy",
        quantity: 15,
        limitPrice: 66.0,
      },
    ],
  },
  active: {
    key: "active",
    name: "Active Trading Portfolio",
    openingCash: 20_000,
    openingAt: "2026-05-01T13:00:00.000Z",
    seriesSeed: 9304,
    chartVolatility: 0.018,
    events: [
      { id: "a_dep1", kind: "deposit", at: "2026-05-01T13:00:00.000Z", amount: 20_000, note: "Trading capital" },
      { id: "a_buy1", kind: "buy_fill", at: "2026-05-02T14:05:00.000Z", symbol: "NPRT", quantity: 100, price: 44.2, fee: 4 },
      { id: "a_sell1", kind: "sell_fill", at: "2026-05-05T15:20:00.000Z", symbol: "NPRT", quantity: 100, price: 42.8, fee: 4 },
      { id: "a_buy2", kind: "buy_fill", at: "2026-05-06T13:50:00.000Z", symbol: "MINE", quantity: 180, price: 16.1, fee: 4.5 },
      { id: "a_sell2", kind: "sell_fill", at: "2026-05-12T14:40:00.000Z", symbol: "MINE", quantity: 80, price: 19.4, fee: 3.5 },
      { id: "a_buy3", kind: "buy_fill", at: "2026-06-03T15:00:00.000Z", symbol: "CYBR", quantity: 45, price: 93.0, fee: 5 },
      { id: "a_sell3", kind: "sell_fill", at: "2026-06-10T16:00:00.000Z", symbol: "CYBR", quantity: 45, price: 90.5, fee: 5 },
      { id: "a_buy4", kind: "buy_fill", at: "2026-06-18T14:15:00.000Z", symbol: "ALTA", quantity: 30, price: 122.0, fee: 4 },
      { id: "a_buy5", kind: "buy_fill", at: "2026-07-02T13:30:00.000Z", symbol: "NPRT", quantity: 60, price: 41.5, fee: 3 },
      {
        id: "a_part1",
        kind: "sell_fill",
        at: "2026-07-08T15:05:00.000Z",
        symbol: "ALTA",
        quantity: 10,
        price: 127.2,
        fee: 2.5,
        orderStatus: "partial",
        orderType: "limit",
        limitPrice: 127.0,
      },
      { id: "a_fee1", kind: "fee", at: "2026-07-10T12:00:00.000Z", amount: 9.75, note: "Inactivity / clearing fee" },
      {
        id: "a_open1",
        kind: "open_order",
        at: "2026-07-21T11:20:00.000Z",
        symbol: "MINE",
        side: "sell",
        quantity: 50,
        limitPrice: 19.8,
      },
      {
        id: "a_open2",
        kind: "open_order",
        at: "2026-07-21T12:40:00.000Z",
        symbol: "NPRT",
        side: "buy",
        quantity: 40,
        limitPrice: 40.5,
      },
      {
        id: "a_can1",
        kind: "cancelled_order",
        at: "2026-07-14T14:00:00.000Z",
        symbol: "GOLD",
        side: "buy",
        quantity: 25,
        limitPrice: 65,
        cancelledAt: "2026-07-15T10:00:00.000Z",
      },
      {
        id: "a_rej1",
        kind: "rejected_order",
        at: "2026-07-16T15:45:00.000Z",
        symbol: "HALT",
        side: "sell",
        quantity: 10,
        reason: "Security is halted",
      },
      {
        id: "a_rej2",
        kind: "rejected_order",
        at: "2026-07-20T13:10:00.000Z",
        symbol: "CYBR",
        side: "buy",
        quantity: 200,
        reason: "Order exceeds risk limit",
      },
    ],
  },
  treasury: {
    key: "treasury",
    name: "ALTG Treasury",
    openingCash: 250_000,
    openingAt: "2025-07-01T14:00:00.000Z",
    seriesSeed: 9405,
    chartVolatility: 0.007,
    events: [
      { id: "t_dep1", kind: "deposit", at: "2025-07-01T14:00:00.000Z", amount: 250_000, note: "Treasury allocation" },
      { id: "t_buy1", kind: "buy_fill", at: "2025-07-08T15:00:00.000Z", symbol: "ALTA", quantity: 800, price: 98.5, fee: 25 },
      { id: "t_buy2", kind: "buy_fill", at: "2025-08-20T14:30:00.000Z", symbol: "CYBR", quantity: 200, price: 88.2, fee: 18 },
      { id: "t_buy3", kind: "buy_fill", at: "2025-09-15T15:20:00.000Z", symbol: "NPRT", quantity: 400, price: 39.1, fee: 16 },
      { id: "t_div1", kind: "dividend", at: "2025-12-15T12:00:00.000Z", symbol: "ALTA", amount: 1_240 },
      { id: "t_buy4", kind: "buy_fill", at: "2026-01-22T14:10:00.000Z", symbol: "UTIL", quantity: 300, price: 52.0, fee: 12 },
      { id: "t_sell1", kind: "sell_fill", at: "2026-03-18T15:40:00.000Z", symbol: "NPRT", quantity: 100, price: 45.5, fee: 8 },
      { id: "t_adj1", kind: "adjustment", at: "2026-04-01T12:00:00.000Z", amount: 150, note: "Corporate action cash residual" },
      { id: "t_div2", kind: "dividend", at: "2026-06-15T12:00:00.000Z", symbol: "ALTA", amount: 1_280 },
      { id: "t_div3", kind: "dividend", at: "2026-07-15T12:00:00.000Z", symbol: "UTIL", amount: 265 },
      {
        id: "t_open1",
        kind: "open_order",
        at: "2026-07-20T14:22:00.000Z",
        symbol: "ALTA",
        side: "buy",
        quantity: 25,
        limitPrice: 124,
      },
      {
        id: "t_can1",
        kind: "cancelled_order",
        at: "2026-07-10T13:00:00.000Z",
        symbol: "GOLD",
        side: "buy",
        quantity: 50,
        limitPrice: 64,
        cancelledAt: "2026-07-11T09:30:00.000Z",
      },
    ],
  },
  empty: {
    key: "empty",
    name: "New Portfolio",
    openingCash: 0,
    openingAt: "2026-07-21T12:00:00.000Z",
    seriesSeed: 9506,
    chartVolatility: 0.001,
    events: [],
  },
};

export type AppliedFixtureLedger = {
  profile: FixtureProfileKey;
  cash: number;
  lots: FixtureLot[];
  orders: OrderRecord[];
  activity: PortfolioActivityRecord[];
  /** Equity-only value samples for charting (excludes deposit/withdrawal jumps as performance). */
  equityMarks: { t: number; equity: number; cash: number }[];
  totalDeposits: number;
  totalWithdrawals: number;
  realizedGainLoss: number;
};

function applyBuyLot(lots: FixtureLot[], symbol: string, quantity: number, price: number) {
  const existing = lots.find((l) => l.symbol === symbol);
  if (existing) {
    const totalQty = existing.quantity + quantity;
    const totalCost = existing.quantity * existing.averageCost + quantity * price;
    existing.quantity = totalQty;
    existing.averageCost = Number((totalCost / totalQty).toFixed(4));
    return;
  }
  lots.push({ symbol, quantity, averageCost: price });
}

function applySellLot(lots: FixtureLot[], symbol: string, quantity: number): number {
  const existing = lots.find((l) => l.symbol === symbol);
  if (!existing || existing.quantity < quantity) {
    throw new Error(`Ledger sell exceeds holdings for ${symbol}`);
  }
  const costBasis = existing.averageCost * quantity;
  existing.quantity -= quantity;
  if (existing.quantity <= 1e-9) {
    const idx = lots.findIndex((l) => l.symbol === symbol);
    if (idx >= 0) lots.splice(idx, 1);
  }
  return costBasis;
}

function markEquity(lots: FixtureLot[], at: string, cash: number, marks: AppliedFixtureLedger["equityMarks"]) {
  let equity = 0;
  for (const lot of lots) {
    const quote = getFixtureSecurity(lot.symbol);
    const px = quote?.lastPrice ?? lot.averageCost;
    equity += lot.quantity * px;
  }
  marks.push({ t: Date.parse(at), equity: money(equity), cash: money(cash) });
}

export function applyFixtureLedger(
  portfolioId: string,
  profile: FixtureProfileDefinition,
): AppliedFixtureLedger {
  const lots: FixtureLot[] = [];
  let cash = 0;
  const orders: OrderRecord[] = [];
  const activity: PortfolioActivityRecord[] = [];
  const equityMarks: AppliedFixtureLedger["equityMarks"] = [];
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let realizedGainLoss = 0;
  let orderSeq = 0;

  const pushActivity = (row: Omit<PortfolioActivityRecord, "portfolioId" | "cashAfter"> & { cashAfter?: number }) => {
    activity.push({
      portfolioId,
      cashAfter: row.cashAfter ?? money(cash),
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurredAt,
      amount: row.amount,
      symbol: row.symbol,
      quantity: row.quantity,
      price: row.price,
      orderId: row.orderId,
      description: row.description,
    });
  };

  const sorted = [...profile.events].sort((a, b) => a.at.localeCompare(b.at));

  for (const event of sorted) {
    orderSeq += 1;
    const orderId = `ord_${portfolioId}_${event.id}`;

    switch (event.kind) {
      case "deposit": {
        cash = money(cash + event.amount);
        totalDeposits = money(totalDeposits + event.amount);
        pushActivity({
          id: `act_${event.id}`,
          kind: "cash_deposit",
          occurredAt: event.at,
          amount: event.amount,
          symbol: null,
          quantity: null,
          price: null,
          orderId: null,
          description: event.note ?? "Cash deposit",
        });
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "withdrawal": {
        cash = money(cash - event.amount);
        totalWithdrawals = money(totalWithdrawals + event.amount);
        pushActivity({
          id: `act_${event.id}`,
          kind: "cash_withdrawal",
          occurredAt: event.at,
          amount: -event.amount,
          symbol: null,
          quantity: null,
          price: null,
          orderId: null,
          description: event.note ?? "Cash withdrawal",
        });
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "buy_fill": {
        const fee = event.fee ?? 0;
        const notional = money(event.quantity * event.price);
        cash = money(cash - notional - fee);
        applyBuyLot(lots, event.symbol, event.quantity, event.price);
        const status = event.orderStatus ?? "filled";
        const type = event.orderType ?? "market";
        orders.push({
          id: orderId,
          portfolioId,
          symbol: event.symbol,
          name: securityName(event.symbol),
          side: "buy",
          type,
          status,
          quantity: status === "partial" ? event.quantity * 2 : event.quantity,
          filledQuantity: event.quantity,
          limitPrice: event.limitPrice ?? (type === "limit" ? event.price : null),
          averageFillPrice: event.price,
          estimatedValue: notional,
          submittedAt: event.at,
          updatedAt: event.at,
          rejectReason: null,
        });
        pushActivity({
          id: `act_${event.id}`,
          kind: "buy_fill",
          occurredAt: event.at,
          amount: -notional,
          symbol: event.symbol,
          quantity: event.quantity,
          price: event.price,
          orderId,
          description: `Bought ${event.quantity} ${event.symbol}`,
        });
        if (fee > 0) {
          pushActivity({
            id: `act_${event.id}_fee`,
            kind: "trading_fee",
            occurredAt: event.at,
            amount: -fee,
            symbol: event.symbol,
            quantity: null,
            price: null,
            orderId,
            description: `Trading fee · ${event.symbol}`,
          });
        }
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "sell_fill": {
        const fee = event.fee ?? 0;
        const notional = money(event.quantity * event.price);
        const costBasis = applySellLot(lots, event.symbol, event.quantity);
        const gain = money(notional - costBasis);
        realizedGainLoss = money(realizedGainLoss + gain);
        cash = money(cash + notional - fee);
        const status = event.orderStatus ?? "filled";
        const type = event.orderType ?? "market";
        orders.push({
          id: orderId,
          portfolioId,
          symbol: event.symbol,
          name: securityName(event.symbol),
          side: "sell",
          type,
          status,
          quantity: status === "partial" ? event.quantity * 2 : event.quantity,
          filledQuantity: event.quantity,
          limitPrice: event.limitPrice ?? (type === "limit" ? event.price : null),
          averageFillPrice: event.price,
          estimatedValue: notional,
          submittedAt: event.at,
          updatedAt: event.at,
          rejectReason: null,
        });
        pushActivity({
          id: `act_${event.id}`,
          kind: "sell_fill",
          occurredAt: event.at,
          amount: notional,
          symbol: event.symbol,
          quantity: event.quantity,
          price: event.price,
          orderId,
          description: `Sold ${event.quantity} ${event.symbol}`,
        });
        pushActivity({
          id: `act_${event.id}_gl`,
          kind: "realized_gain_loss",
          occurredAt: event.at,
          amount: gain,
          symbol: event.symbol,
          quantity: event.quantity,
          price: event.price,
          orderId,
          description: gain >= 0 ? `Realized gain · ${event.symbol}` : `Realized loss · ${event.symbol}`,
        });
        if (fee > 0) {
          pushActivity({
            id: `act_${event.id}_fee`,
            kind: "trading_fee",
            occurredAt: event.at,
            amount: -fee,
            symbol: event.symbol,
            quantity: null,
            price: null,
            orderId,
            description: `Trading fee · ${event.symbol}`,
          });
        }
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "dividend": {
        cash = money(cash + event.amount);
        pushActivity({
          id: `act_${event.id}`,
          kind: "dividend",
          occurredAt: event.at,
          amount: event.amount,
          symbol: event.symbol,
          quantity: null,
          price: null,
          orderId: null,
          description: `Dividend · ${event.symbol}`,
        });
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "fee": {
        cash = money(cash - event.amount);
        pushActivity({
          id: `act_${event.id}`,
          kind: "trading_fee",
          occurredAt: event.at,
          amount: -event.amount,
          symbol: null,
          quantity: null,
          price: null,
          orderId: null,
          description: event.note ?? "Fee",
        });
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "adjustment": {
        cash = money(cash + event.amount);
        pushActivity({
          id: `act_${event.id}`,
          kind: "adjustment",
          occurredAt: event.at,
          amount: event.amount,
          symbol: null,
          quantity: null,
          price: null,
          orderId: null,
          description: event.note,
        });
        markEquity(lots, event.at, cash, equityMarks);
        break;
      }
      case "open_order": {
        orders.push({
          id: orderId,
          portfolioId,
          symbol: event.symbol,
          name: securityName(event.symbol),
          side: event.side,
          type: "limit",
          status: "open",
          quantity: event.quantity,
          filledQuantity: 0,
          limitPrice: event.limitPrice,
          averageFillPrice: null,
          estimatedValue: money(event.quantity * event.limitPrice),
          submittedAt: event.at,
          updatedAt: event.at,
          rejectReason: null,
        });
        break;
      }
      case "cancelled_order": {
        orders.push({
          id: orderId,
          portfolioId,
          symbol: event.symbol,
          name: securityName(event.symbol),
          side: event.side,
          type: "limit",
          status: "cancelled",
          quantity: event.quantity,
          filledQuantity: 0,
          limitPrice: event.limitPrice,
          averageFillPrice: null,
          estimatedValue: money(event.quantity * event.limitPrice),
          submittedAt: event.at,
          updatedAt: event.cancelledAt,
          rejectReason: null,
        });
        break;
      }
      case "rejected_order": {
        const px = getFixtureSecurity(event.symbol)?.lastPrice ?? 0;
        orders.push({
          id: orderId,
          portfolioId,
          symbol: event.symbol,
          name: securityName(event.symbol),
          side: event.side,
          type: "market",
          status: "rejected",
          quantity: event.quantity,
          filledQuantity: 0,
          limitPrice: null,
          averageFillPrice: null,
          estimatedValue: money(event.quantity * px),
          submittedAt: event.at,
          updatedAt: event.at,
          rejectReason: event.reason,
        });
        break;
      }
      default:
        break;
    }
  }

  return {
    profile: profile.key,
    cash: money(cash),
    lots: lots.map((l) => ({ ...l })),
    orders,
    activity: activity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    equityMarks,
    totalDeposits,
    totalWithdrawals,
    realizedGainLoss,
  };
}

/** Build chart series from equity marks; cash flows do not invent investment performance. */
export function buildLedgerChartSeries(
  applied: AppliedFixtureLedger,
  seriesSeed: number,
  volatility: number,
  opts: { totalValue: number; dayChange: number },
): Record<TerminalChartRange, PricePoint[]> {
  const end = Date.UTC(2026, 6, 21, 16, 0, 0);
  const totalValue = money(opts.totalValue);
  const dayChange = money(opts.dayChange);
  const start1d = money(totalValue - dayChange);

  // Empty / cash-only with no day move → flat charts.
  if (applied.lots.length === 0 && Math.abs(dayChange) < 0.005) {
    const flat = buildAnchoredSeries({
      seed: seriesSeed,
      startValue: totalValue,
      endValue: totalValue,
      points: 40,
      volatility: 0,
      endTime: end,
    });
    return {
      "1D": flat,
      "1W": flat,
      "1M": flat,
      "3M": flat,
      "1Y": flat,
      ALL: flat,
    };
  }

  const pointsByRange: Record<TerminalChartRange, number> = {
    "1D": 78,
    "1W": 48,
    "1M": 42,
    "3M": 64,
    "1Y": 52,
    ALL: 72,
  };

  // Longer ranges get distinct prior levels (not day change) so shapes differ.
  const priorByRange: Record<TerminalChartRange, number> = {
    "1D": start1d,
    "1W": money(totalValue - dayChange * 2.4 - totalValue * volatility * 0.4),
    "1M": money(totalValue - dayChange * 4.1 - totalValue * volatility * 1.1),
    "3M": money(totalValue - dayChange * 5.5 - totalValue * volatility * 2.2),
    "1Y": money(totalValue - dayChange * 7.2 - totalValue * volatility * 4.5),
    ALL: money(totalValue - dayChange * 8.5 - totalValue * volatility * 6.5),
  };

  const out = {} as Record<TerminalChartRange, PricePoint[]>;
  (Object.keys(pointsByRange) as TerminalChartRange[]).forEach((range, idx) => {
    const startValue = Math.max(0, priorByRange[range]);
    const series = buildAnchoredSeries({
      seed: seriesSeed + idx * 17,
      startValue,
      endValue: totalValue,
      points: pointsByRange[range],
      volatility: volatility * (0.5 + idx * 0.15),
      endTime: end,
    });
    // Mild mid-range texture per profile — never a near-zero plunge.
    if (volatility > 0.01 && range !== "1D") {
      const dipAt = Math.floor(series.length * 0.45);
      const dip = series[dipAt];
      if (dip) {
        const dipped = money(Math.max(startValue * 0.92, dip.v * 0.97));
        series[dipAt] = { ...dip, v: dipped };
      }
    }
    out[range] = sanitizeSeries(series, totalValue);
  });
  return out;
}

function sanitizeSeries(series: PricePoint[], endValue: number): PricePoint[] {
  const cleaned: PricePoint[] = [];
  for (const point of series) {
    if (!Number.isFinite(point.t) || !Number.isFinite(point.v) || point.v < 0) continue;
    const last = cleaned[cleaned.length - 1];
    if (last && point.t <= last.t) continue;
    cleaned.push({ t: point.t, v: money(point.v) });
  }
  if (cleaned.length === 0) {
    const t = Date.UTC(2026, 6, 21, 16, 0, 0);
    return [
      { t: t - 60_000, v: money(endValue) },
      { t, v: money(endValue) },
    ];
  }
  cleaned[cleaned.length - 1] = { ...cleaned[cleaned.length - 1]!, v: money(endValue) };
  return cleaned;
}

export function buildSnapshotFromLedger(
  portfolioId: string,
  applied: AppliedFixtureLedger,
  profile: FixtureProfileDefinition,
): PortfolioSnapshot {
  if (applied.lots.length === 0) {
    const empty = buildEmptyFixturePortfolio(applied.cash, portfolioId);
    return {
      ...empty,
      seriesByRange: buildLedgerChartSeries(applied, profile.seriesSeed, profile.chartVolatility, {
        totalValue: empty.totalValue,
        dayChange: empty.dayChange,
      }),
    };
  }
  const snap = buildFixturePortfolioFromLots(
    portfolioId,
    applied.lots,
    applied.cash,
    profile.seriesSeed,
  );
  return {
    ...snap,
    seriesByRange: buildLedgerChartSeries(applied, profile.seriesSeed, profile.chartVolatility, {
      totalValue: snap.totalValue,
      dayChange: snap.dayChange,
    }),
  };
}

/** Chart series invariants for tests and fixture validation. */
export function assertChartSeriesHealthy(
  series: PricePoint[],
  opts?: { endValue?: number; startValue?: number; maxSingleStepRatio?: number },
): void {
  if (series.length < 2) throw new Error("Series too short");
  for (let i = 0; i < series.length; i++) {
    const point = series[i]!;
    if (!Number.isFinite(point.t) || !Number.isFinite(point.v) || point.v < 0) {
      throw new Error(`Invalid point at ${i}`);
    }
    if (i > 0 && point.t <= series[i - 1]!.t) {
      throw new Error(`Non-increasing timestamp at ${i}`);
    }
    if (i > 0 && opts?.maxSingleStepRatio) {
      const prev = series[i - 1]!.v;
      if (prev > 1 && Math.abs(point.v - prev) / prev > opts.maxSingleStepRatio) {
        throw new Error(`Unexplained jump at ${i}: ${prev} → ${point.v}`);
      }
    }
  }
  if (opts?.endValue != null) {
    const end = series[series.length - 1]!.v;
    if (Math.abs(end - opts.endValue) > 0.02) {
      throw new Error(`End value ${end} != ${opts.endValue}`);
    }
  }
  if (opts?.startValue != null) {
    const start = series[0]!.v;
    if (Math.abs(start - opts.startValue) > 0.02) {
      throw new Error(`Start value ${start} != ${opts.startValue}`);
    }
  }
}

/** Invariant helpers for tests. */
export function assertLedgerReconciles(applied: AppliedFixtureLedger): void {
  const buyCash = applied.activity
    .filter((a) => a.kind === "buy_fill" || a.kind === "trading_fee" || a.kind === "cash_withdrawal")
    .reduce((s, a) => s + Math.abs(Math.min(a.amount, 0)), 0);
  const sellCash = applied.activity
    .filter(
      (a) =>
        a.kind === "sell_fill" ||
        a.kind === "cash_deposit" ||
        a.kind === "dividend" ||
        a.kind === "adjustment",
    )
    .reduce((s, a) => s + Math.max(a.amount, 0), 0);
  // Net cash from activity should match ending cash within rounding.
  const net = money(sellCash - buyCash);
  if (Math.abs(net - applied.cash) > 0.05) {
    throw new Error(`Cash mismatch: activity net ${net} vs ledger cash ${applied.cash}`);
  }
  for (const lot of applied.lots) {
    if (lot.quantity <= 0) throw new Error(`Non-positive lot ${lot.symbol}`);
  }
}
