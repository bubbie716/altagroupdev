/**
 * Alta-owned Terminal financial state — PostgreSQL is authoritative.
 * Does not fabricate quotes, valuations, or successful TSE trades.
 */
import type {
  Holding,
  OrderRecord,
  OrderSide,
  OrderStatus,
  OrderType,
  PortfolioActivityKind,
  PortfolioActivityRecord,
  PortfolioSnapshot,
  WatchlistItem,
} from "@/lib/terminal/types";
import {
  decimalToNumberOrNull,
  normalizeTerminalSymbol,
  serializeMoney,
  serializePrice,
  serializeQuantity,
} from "@/lib/terminal/terminal-decimal";
import { emptyLocalPortfolioSnapshot } from "@/lib/terminal/unavailable-tse-client";
import { TerminalPersistenceUnavailableError } from "@/lib/terminal/terminal-portfolio.service";

async function requirePrisma() {
  const { isDatabaseConfigured, prisma } = await import("@/server/db");
  if (!isDatabaseConfigured()) {
    throw new TerminalPersistenceUnavailableError();
  }
  return prisma;
}

function mapDbError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2021" ||
      (error as { code?: string }).code === "P2010")
  ) {
    throw new TerminalPersistenceUnavailableError("Terminal tables are not migrated yet");
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/terminalportfolio|does not exist|relation .* does not exist/i.test(message)) {
    throw new TerminalPersistenceUnavailableError("Terminal tables are not migrated yet");
  }
  throw error;
}

function mapOrderSide(side: "BUY" | "SELL"): OrderSide {
  return side === "BUY" ? "buy" : "sell";
}

function mapOrderType(type: "MARKET" | "LIMIT"): OrderType {
  return type === "MARKET" ? "market" : "limit";
}

function mapOrderStatus(
  status: "OPEN" | "FILLED" | "CANCELLED" | "REJECTED" | "PARTIAL",
): OrderStatus {
  switch (status) {
    case "OPEN":
      return "open";
    case "FILLED":
      return "filled";
    case "CANCELLED":
      return "cancelled";
    case "REJECTED":
      return "rejected";
    case "PARTIAL":
      return "partial";
  }
}

function mapActivityKind(
  kind:
    | "CASH_DEPOSIT"
    | "CASH_WITHDRAWAL"
    | "BUY_FILL"
    | "SELL_FILL"
    | "DIVIDEND"
    | "TRADING_FEE"
    | "ADJUSTMENT"
    | "REALIZED_GAIN_LOSS",
): PortfolioActivityKind {
  switch (kind) {
    case "CASH_DEPOSIT":
      return "cash_deposit";
    case "CASH_WITHDRAWAL":
      return "cash_withdrawal";
    case "BUY_FILL":
      return "buy_fill";
    case "SELL_FILL":
      return "sell_fill";
    case "DIVIDEND":
      return "dividend";
    case "TRADING_FEE":
      return "trading_fee";
    case "ADJUSTMENT":
      return "adjustment";
    case "REALIZED_GAIN_LOSS":
      return "realized_gain_loss";
  }
}

function emptySeries() {
  return {
    "1D": [] as { t: number; v: number }[],
    "1W": [] as { t: number; v: number }[],
    "1M": [] as { t: number; v: number }[],
    "3M": [] as { t: number; v: number }[],
    "1Y": [] as { t: number; v: number }[],
    ALL: [] as { t: number; v: number }[],
  };
}

/**
 * Build a portfolio snapshot from local DB only.
 * Total value falls back to authoritative cash; market-dependent fields remain unavailable.
 */
export async function getLocalPortfolioSnapshot(portfolioId: string): Promise<PortfolioSnapshot> {
  const prisma = await requirePrisma();
  try {
    const [cashAccount, positions] = await Promise.all([
      prisma.terminalPortfolioCashAccount.findUnique({ where: { portfolioId } }),
      prisma.terminalPosition.findMany({
        where: { portfolioId },
        orderBy: [{ symbol: "asc" }],
      }),
    ]);

    if (!cashAccount) {
      // Idempotent repair for legacy rows missing a cash account.
      await prisma.terminalPortfolioCashAccount.create({
        data: {
          portfolioId,
          availableCash: 0,
          reservedCash: 0,
          currency: "FLORIN",
        },
      });
      return emptyLocalPortfolioSnapshot(portfolioId);
    }

    const available = serializeMoney(cashAccount.availableCash);
    const holdings: Holding[] = positions
      .filter((p) => serializeQuantity(p.quantity) !== 0)
      .map((p) => ({
        symbol: p.symbol,
        name: p.symbol,
        quantity: serializeQuantity(p.quantity),
        averageCost: serializePrice(p.averageCost) ?? 0,
        lastPrice: null,
        marketValue: null,
        totalReturn: null,
        totalReturnPercent: null,
        dayReturn: null,
        dayReturnPercent: null,
        weightPercent: null,
        sparkline: [],
      }));

    return {
      portfolioId,
      cashBalance: available,
      buyingPower: available,
      holdings,
      valuationAvailable: false,
      equityValue: null,
      totalValue: available,
      dayChange: null,
      dayChangePercent: null,
      totalReturn: null,
      totalReturnPercent: null,
      unrealizedReturn: null,
      unrealizedReturnPercent: null,
      seriesByRange: emptySeries(),
    };
  } catch (error) {
    mapDbError(error);
  }
}

export async function listLocalOrders(portfolioId: string): Promise<OrderRecord[]> {
  const prisma = await requirePrisma();
  try {
    const rows = await prisma.terminalOrder.findMany({
      where: { portfolioId },
      orderBy: [{ submittedAt: "desc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolioId,
      symbol: row.symbol,
      name: row.symbol,
      side: mapOrderSide(row.side),
      type: mapOrderType(row.orderType),
      status: mapOrderStatus(row.status),
      quantity: serializeQuantity(row.quantity),
      filledQuantity: serializeQuantity(row.filledQuantity),
      limitPrice: serializePrice(row.limitPrice),
      averageFillPrice: serializePrice(row.averageFillPrice),
      estimatedValue: row.estimatedValue ? serializeMoney(row.estimatedValue) : 0,
      submittedAt: row.submittedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      rejectReason: row.rejectReason,
    }));
  } catch (error) {
    mapDbError(error);
  }
}

export async function listLocalOrdersForPortfolios(portfolioIds: string[]): Promise<OrderRecord[]> {
  if (portfolioIds.length === 0) return [];
  const prisma = await requirePrisma();
  try {
    const rows = await prisma.terminalOrder.findMany({
      where: { portfolioId: { in: portfolioIds } },
      orderBy: [{ submittedAt: "desc" }],
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolioId,
      symbol: row.symbol,
      name: row.symbol,
      side: mapOrderSide(row.side),
      type: mapOrderType(row.orderType),
      status: mapOrderStatus(row.status),
      quantity: serializeQuantity(row.quantity),
      filledQuantity: serializeQuantity(row.filledQuantity),
      limitPrice: serializePrice(row.limitPrice),
      averageFillPrice: serializePrice(row.averageFillPrice),
      estimatedValue: row.estimatedValue ? serializeMoney(row.estimatedValue) : 0,
      submittedAt: row.submittedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      rejectReason: row.rejectReason,
    }));
  } catch (error) {
    mapDbError(error);
  }
}

export async function listLocalPortfolioActivity(
  portfolioId: string,
): Promise<PortfolioActivityRecord[]> {
  const prisma = await requirePrisma();
  try {
    const rows = await prisma.terminalPortfolioActivity.findMany({
      where: { portfolioId },
      orderBy: [{ occurredAt: "desc" }],
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolioId,
      kind: mapActivityKind(row.kind),
      occurredAt: row.occurredAt.toISOString(),
      amount: serializeMoney(row.amount),
      symbol: row.symbol,
      quantity: decimalToNumberOrNull(row.quantity),
      price: serializePrice(row.price),
      orderId: row.orderId,
      description: row.description,
      cashAfter: row.cashAfter ? serializeMoney(row.cashAfter) : null,
    }));
  } catch (error) {
    mapDbError(error);
  }
}

/** Ensure a default empty watchlist exists for the user (no seeded symbols). */
export async function ensureDefaultWatchlist(userId: string): Promise<string> {
  const prisma = await requirePrisma();
  try {
    const existing = await prisma.terminalWatchlist.findFirst({
      where: { userId, isDefault: true },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.terminalWatchlist.create({
      data: {
        userId,
        name: "Watchlist",
        isDefault: true,
      },
    });
    return created.id;
  } catch (error) {
    mapDbError(error);
  }
}

export async function listLocalWatchlistItems(userId: string): Promise<WatchlistItem[]> {
  const prisma = await requirePrisma();
  try {
    const watchlistId = await ensureDefaultWatchlist(userId);
    const items = await prisma.terminalWatchlistItem.findMany({
      where: { watchlistId },
      orderBy: [{ createdAt: "asc" }],
    });
    // Quotes unavailable without TSE — list symbols only.
    return items.map((item) => ({
      symbol: item.symbol,
      name: item.symbol,
      lastPrice: null,
      dayChange: null,
      dayChangePercent: null,
      sparkline: [],
      tradingStatus: "unavailable" as const,
      quoteAvailable: false,
    }));
  } catch (error) {
    mapDbError(error);
  }
}

/**
 * Add a symbol only when the TSE directory can validate it.
 * Without a live security directory, refuse arbitrary symbols.
 */
export async function addLocalWatchlistSymbol(
  userId: string,
  symbol: string,
  options: { validatedByTse: boolean },
): Promise<WatchlistItem[]> {
  if (!options.validatedByTse) {
    throw new Error("Cannot add watchlist symbols until the market directory is available");
  }
  const normalized = normalizeTerminalSymbol(symbol);
  if (!normalized) throw new Error("Symbol is required");

  const prisma = await requirePrisma();
  try {
    const watchlistId = await ensureDefaultWatchlist(userId);
    await prisma.terminalWatchlistItem.upsert({
      where: {
        watchlistId_symbol: { watchlistId, symbol: normalized },
      },
      create: { watchlistId, symbol: normalized },
      update: {},
    });
    return listLocalWatchlistItems(userId);
  } catch (error) {
    mapDbError(error);
  }
}

export async function removeLocalWatchlistSymbol(
  userId: string,
  symbol: string,
): Promise<WatchlistItem[]> {
  const normalized = normalizeTerminalSymbol(symbol);
  const prisma = await requirePrisma();
  try {
    const watchlistId = await ensureDefaultWatchlist(userId);
    await prisma.terminalWatchlistItem.deleteMany({
      where: { watchlistId, symbol: normalized },
    });
    return listLocalWatchlistItems(userId);
  } catch (error) {
    mapDbError(error);
  }
}

export async function isSymbolOnWatchlist(userId: string, symbol: string): Promise<boolean> {
  const normalized = normalizeTerminalSymbol(symbol);
  const items = await listLocalWatchlistItems(userId);
  return items.some((item) => item.symbol === normalized);
}
