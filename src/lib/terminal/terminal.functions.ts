import { createServerFn } from "@tanstack/react-start";
import type {
  OrderPreviewInput,
  TerminalPortfolioSummary,
  TseClient,
} from "@/lib/terminal/types";
import type { CreateTerminalPortfolioInput } from "@/lib/terminal/terminal-portfolio.service";

async function enrichPortfolioSummaries(
  client: TseClient,
  portfolios: TerminalPortfolioSummary[],
): Promise<TerminalPortfolioSummary[]> {
  return Promise.all(
    portfolios.map(async (portfolio) => {
      try {
        const snapshot = await client.getPortfolio(portfolio.id);
        return {
          ...portfolio,
          totalValue: snapshot.totalValue,
          dayChange: snapshot.dayChange,
          dayChangePercent: snapshot.dayChangePercent,
        };
      } catch {
        return portfolio;
      }
    }),
  );
}

async function requireTerminalUser() {
  const { isUiLabMode, getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return labUser;
  }
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

async function requireTerminalUserId(): Promise<string> {
  return (await requireTerminalUser()).id;
}

export const fetchTerminalHome = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTerminalUser();
  const { listAccessibleTerminalPortfolios } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const portfolios = await listAccessibleTerminalPortfolios(user);
  const client = getTseClient({ userId: user.id });
  const dashboard = await client.getHomeDashboard(portfolios);
  return { mode: client.mode, dashboard, userDisplayName: user.minecraftUsername || user.discordUsername };
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
  .inputValidator((input: { symbol: string; portfolioId?: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId: user.id });
    const portfolios = await enrichPortfolioSummaries(
      client,
      await listAccessibleTerminalPortfolios(user),
    );
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
    const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

    if (!portfolioId) {
      const security = await client.getSecurity(data.symbol.toUpperCase());
      const historyByRange = Object.fromEntries(
        await Promise.all(
          ranges.map(async (range) => [range, await client.getPriceHistory(data.symbol.toUpperCase(), range)]),
        ),
      ) as Record<(typeof ranges)[number], Awaited<ReturnType<typeof client.getPriceHistory>>>;
      return {
        mode: client.mode,
        security,
        historyByRange,
        position: null,
        onWatchlist: false,
        buyingPower: 0,
        marketStatus: await client.getMarketStatus(),
        portfolios,
        selectedPortfolio: null,
      };
    }
    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    const symbol = data.symbol.toUpperCase();
    const [security, portfolio, watchlist, marketStatus, ...histories] = await Promise.all([
      client.getSecurity(symbol),
      client.getPortfolio(portfolioId),
      client.getWatchlist(),
      client.getMarketStatus(),
      ...ranges.map((range) => client.getPriceHistory(symbol, range)),
    ]);
    const historyByRange = Object.fromEntries(
      ranges.map((range, index) => [range, histories[index] ?? []]),
    ) as Record<(typeof ranges)[number], Awaited<ReturnType<typeof client.getPriceHistory>>>;
    const position = portfolio.holdings.find((h) => h.symbol === symbol) ?? null;
    const onWatchlist = watchlist.some((w) => w.symbol === symbol);
    return {
      mode: client.mode,
      security,
      historyByRange,
      position,
      onWatchlist,
      buyingPower: portfolio.buyingPower,
      marketStatus,
      portfolios,
      selectedPortfolio,
    };
  });

export const fetchTerminalPortfolio = createServerFn({ method: "GET" })
  .inputValidator((input?: { portfolioId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
      eligibleCompaniesForPortfolioCreate,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId: user.id });
    const portfolios = await enrichPortfolioSummaries(
      client,
      await listAccessibleTerminalPortfolios(user),
    );
    const eligibleCompanies = eligibleCompaniesForPortfolioCreate(user);

    if (data.portfolioId && !portfolios.some((portfolio) => portfolio.id === data.portfolioId)) {
      return {
        mode: client.mode,
        portfolios,
        selectedPortfolio: null,
        portfolio: null,
        orders: [],
        eligibleCompanies,
        portfolioUnavailable: true as const,
      };
    }

    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);

    if (!portfolioId) {
      return {
        mode: client.mode,
        portfolios,
        selectedPortfolio: null,
        portfolio: null,
        orders: [],
        eligibleCompanies,
        portfolioUnavailable: false as const,
      };
    }

    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    const [portfolio, orders] = await Promise.all([
      client.getPortfolio(portfolioId),
      client.listOrders(portfolioId),
    ]);
    return {
      mode: client.mode,
      portfolios,
      selectedPortfolio,
      portfolio,
      orders,
      eligibleCompanies,
      portfolioUnavailable: false as const,
    };
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

export const fetchTerminalOrders = createServerFn({ method: "GET" })
  .inputValidator((input?: { portfolioId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId: user.id });
    const portfolios = await enrichPortfolioSummaries(
      client,
      await listAccessibleTerminalPortfolios(user),
    );
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
    if (!portfolioId) {
      return { mode: client.mode, orders: [], portfolios, selectedPortfolio: null };
    }
    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    return {
      mode: client.mode,
      orders: await client.listOrders(portfolioId),
      portfolios,
      selectedPortfolio,
    };
  });

export const previewTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    if (!data.portfolioId?.trim()) {
      return {
        ok: false,
        portfolioId: "",
        symbol: data.symbol,
        side: data.side,
        type: data.type,
        quantity: data.quantity,
        limitPrice: data.limitPrice ?? null,
        estimatedValue: 0,
        estimatedFees: 0,
        buyingPowerAfter: null,
        holdingsAfter: null,
        warnings: [],
        errors: ["Portfolio is required"],
      };
    }
    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    assertCanTradePortfolio(user, portfolio);
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId: user.id }).previewOrder(data);
  });

export const submitTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    if (!data.portfolioId?.trim()) {
      return { ok: false as const, errors: ["Portfolio is required"], code: "portfolio_required" as const };
    }
    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    assertCanTradePortfolio(user, portfolio);
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId: user.id }).submitOrder(data);
  });

export const cancelTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { portfolioId: string; orderId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    assertCanTradePortfolio(user, portfolio);
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId: user.id }).cancelOrder(data.portfolioId, data.orderId);
  });

export const searchTerminalSymbols = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }) => {
    const userId = await requireTerminalUserId();
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId }).listSecurities(query);
  });

export const createTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateTerminalPortfolioInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const { createTerminalPortfolio, rememberSelectedTerminalPortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const created = await createTerminalPortfolio(user, data);
    const client = getTseClient({ userId: user.id });
    await client.ensurePortfolioMarketState?.(created.id, "empty");
    await rememberSelectedTerminalPortfolio(user, created.id);
    return created;
  });

export const renameTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((input: { portfolioId: string; name: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const { renameTerminalPortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
    return renameTerminalPortfolio(user, data.portfolioId, data.name);
  });

export const archiveTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }) => {
    const user = await requireTerminalUser();
    const { archiveTerminalPortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
    return archiveTerminalPortfolio(user, portfolioId);
  });

export const selectTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }) => {
    const user = await requireTerminalUser();
    const { rememberSelectedTerminalPortfolio, getTerminalPortfolioForUser } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    await rememberSelectedTerminalPortfolio(user, portfolioId);
    return getTerminalPortfolioForUser(user, portfolioId);
  });

export const fetchEligibleTerminalCompanies = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireTerminalUser();
    const { eligibleCompaniesForPortfolioCreate } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    return eligibleCompaniesForPortfolioCreate(user);
  },
);
