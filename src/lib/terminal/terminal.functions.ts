import { createServerFn } from "@tanstack/react-start";
import type { OrderPreviewInput, TerminalChartRange } from "@/lib/terminal/types";

async function requireTerminalUserId(): Promise<string> {
  const { isUiLabMode, getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return labUser.id;
  }
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchTerminalHome = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireTerminalUserId();
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const client = getTseClient({ userId });
  return { mode: client.mode, dashboard: await client.getHomeDashboard() };
});

export const fetchTerminalMarkets = createServerFn({ method: "GET" })
  .inputValidator((query?: string) => query)
  .handler(async ({ data: query }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId });
    const [securities, marketStatus] = await Promise.all([
      client.listSecurities(query),
      client.getMarketStatus(),
    ]);
    return { mode: client.mode, securities, marketStatus };
  });

export const fetchTerminalSecurity = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; range?: TerminalChartRange }) => input)
  .handler(async ({ data }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId });
    const symbol = data.symbol.toUpperCase();
    const range = data.range ?? "1D";
    const [security, history, portfolio, watchlist, marketStatus] = await Promise.all([
      client.getSecurity(symbol),
      client.getPriceHistory(symbol, range),
      client.getPortfolio(),
      client.getWatchlist(),
      client.getMarketStatus(),
    ]);
    const position = portfolio.holdings.find((h) => h.symbol === symbol) ?? null;
    const onWatchlist = watchlist.some((w) => w.symbol === symbol);
    return {
      mode: client.mode,
      security,
      history,
      range,
      position,
      onWatchlist,
      buyingPower: portfolio.buyingPower,
      marketStatus,
    };
  });

export const fetchTerminalPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireTerminalUserId();
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const client = getTseClient({ userId });
  return { mode: client.mode, portfolio: await client.getPortfolio() };
});

export const fetchTerminalWatchlist = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireTerminalUserId();
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const client = getTseClient({ userId });
  const [watchlist, securities] = await Promise.all([
    client.getWatchlist(),
    client.listSecurities(),
  ]);
  return { mode: client.mode, watchlist, securities };
});

export const addTerminalWatchlistSymbol = createServerFn({ method: "POST" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).addToWatchlist(symbol);
  });

export const removeTerminalWatchlistSymbol = createServerFn({ method: "POST" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).removeFromWatchlist(symbol);
  });

export const fetchTerminalOrders = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireTerminalUserId();
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const client = getTseClient({ userId });
  return { mode: client.mode, orders: await client.listOrders() };
});

export const previewTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).previewOrder(data);
  });

export const submitTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).submitOrder(data);
  });

export const cancelTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((orderId: string) => orderId)
  .handler(async ({ data: orderId }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).cancelOrder(orderId);
  });

export const searchTerminalSymbols = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).listSecurities(query);
  });
