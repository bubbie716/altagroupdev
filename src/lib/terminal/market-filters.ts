import type { OrderSide, OrderStatus, SecuritySummary } from "@/lib/terminal/types";

export type MarketFilter = "all" | "gainers" | "losers";
export type MarketSortKey = "symbol" | "name" | "lastPrice" | "dayChangePercent" | "volume";

export function filterSecurities(
  rows: SecuritySummary[],
  opts: { query?: string; filter?: MarketFilter },
): SecuritySummary[] {
  const q = opts.query?.trim().toLowerCase() ?? "";
  let next = rows;
  if (q) {
    next = next.filter(
      (r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }
  if (opts.filter === "gainers") next = next.filter((r) => r.dayChangePercent > 0);
  if (opts.filter === "losers") next = next.filter((r) => r.dayChangePercent < 0);
  return next;
}

export function sortSecurities(
  rows: SecuritySummary[],
  key: MarketSortKey,
  direction: "asc" | "desc",
): SecuritySummary[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return (Number(av) - Number(bv)) * dir;
  });
}

export function filterOrders<T extends { status: OrderStatus; side: OrderSide }>(
  orders: T[],
  opts: { status?: OrderStatus | "all"; side?: OrderSide | "all" },
): T[] {
  return orders.filter((o) => {
    if (opts.status && opts.status !== "all" && o.status !== opts.status) return false;
    if (opts.side && opts.side !== "all" && o.side !== opts.side) return false;
    return true;
  });
}
