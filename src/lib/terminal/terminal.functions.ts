import { createServerFn } from "@tanstack/react-start";
import type { OrderPreviewInput, TerminalPortfolioSummary } from "@/lib/terminal/types";
import type { CreateTerminalPortfolioInput } from "@/lib/terminal/terminal-portfolio.service";
import { emptyHomeDashboard } from "@/lib/terminal/unavailable-tse-client";

async function requireTerminalUser() {
  const { isUiLabMode, getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return labUser;
  }
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

async function isUiLab(): Promise<boolean> {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  return isUiLabMode();
}

export const fetchTerminalHome = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTerminalUser();

  if (await isUiLab()) {
    const { listUiLabTerminalPortfolios } = await import(
      "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
    );
    const { getUiLabDemonstrationClient } = await import(
      "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
    );
    const portfolios = listUiLabTerminalPortfolios(user);
    const client = getUiLabDemonstrationClient(user.id);
    const dashboard = await client.getHomeDashboard(portfolios);
    return {
      mode: client.mode,
      dashboard,
      userDisplayName: user.minecraftUsername || user.discordUsername,
      persistence: "ui_lab" as const,
    };
  }

  const { listAccessibleTerminalPortfolios, TerminalPersistenceUnavailableError } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const {
    listLocalWatchlistItems,
    listLocalOrdersForPortfolios,
  } = await import("@/lib/terminal/terminal-local.service");

  try {
    const portfolios = await listAccessibleTerminalPortfolios(user);
    const client = getTseClient({ userId: user.id });
    const marketStatus = await client.getMarketStatus();
    const watchlistPreview = (await listLocalWatchlistItems(user.id)).slice(0, 5);
    const recentOrders = await listLocalOrdersForPortfolios(portfolios.map((p) => p.id));

    const { getPortfolioCryptoSummary } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );
    const { parseCryptoMarkedValue } = await import(
      "@/lib/terminal/crypto/crypto-instrument"
    );

    const cryptoByPortfolio = await Promise.all(
      portfolios.map(async (portfolio) => {
        try {
          const summary = await getPortfolioCryptoSummary(portfolio.id);
          return { portfolioId: portfolio.id, marked: parseCryptoMarkedValue(summary.totalMarkedValue) };
        } catch {
          return { portfolioId: portfolio.id, marked: 0 };
        }
      }),
    );
    const cryptoMarkedById = new Map(cryptoByPortfolio.map((row) => [row.portfolioId, row.marked]));

    const portfoliosWithCrypto = portfolios.map((portfolio) => {
      const cryptoMarked = cryptoMarkedById.get(portfolio.id) ?? 0;
      const cash = portfolio.cashBalance ?? 0;
      const baseTotal = portfolio.totalValue ?? cash;
      return {
        ...portfolio,
        // Merge crypto marked value; do not leak wallet details across portfolios.
        totalValue: baseTotal + cryptoMarked,
      };
    });

    const combinedValue = portfoliosWithCrypto.reduce(
      (total, portfolio) => total + (portfolio.totalValue ?? 0),
      0,
    );

    return {
      mode: client.mode,
      dashboard: {
        marketStatus,
        marketDataAvailable: false,
        combinedValue,
        combinedDayChange: null,
        combinedDayChangePercent: null,
        portfolios: portfoliosWithCrypto,
        watchlistPreview,
        movers: { gainers: [], losers: [] },
        recentOrders: recentOrders.slice(0, 8),
      },
      userDisplayName: user.minecraftUsername || user.discordUsername,
      persistence: "database" as const,
    };
  } catch (error) {
    if (error instanceof TerminalPersistenceUnavailableError) {
      const client = (await import("@/lib/terminal/tse-client")).getTseClient({ userId: user.id });
      return {
        mode: client.mode,
        dashboard: emptyHomeDashboard(),
        userDisplayName: user.minecraftUsername || user.discordUsername,
        persistence: "unavailable" as const,
        persistenceError: error.message,
      };
    }
    throw error;
  }
});

export const fetchTerminalMarkets = createServerFn({ method: "GET" })
  .inputValidator((query?: string) => query)
  .handler(async ({ data: query }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const [securities, marketStatus] = await Promise.all([
        client.listSecurities(query),
        client.getMarketStatus(),
      ]);
      return { mode: client.mode, securities, marketStatus };
    }
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const client = getTseClient({ userId: user.id });
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
    const symbol = data.symbol.toUpperCase();
    const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

    if (await isUiLab()) {
      const {
        listUiLabTerminalPortfolios,
        resolveUiLabTerminalPortfolioId,
        rememberUiLabSelectedPortfolio,
        getUiLabTerminalPortfolio,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const listed = listUiLabTerminalPortfolios(user);
      const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
      const portfolios = await Promise.all(
        listed.map(async (portfolio) => {
          try {
            const snapshot = await client.getPortfolio(portfolio.id);
            const holding = snapshot.holdings.find((h) => h.symbol === symbol);
            return {
              ...portfolio,
              totalValue: snapshot.totalValue,
              dayChange: snapshot.dayChange,
              dayChangePercent: snapshot.dayChangePercent,
              valuationAvailable: true,
              cashBalance: snapshot.cashBalance,
              buyingPower: snapshot.buyingPower,
              holdingQuantity: holding?.quantity ?? 0,
            };
          } catch {
            return { ...portfolio, buyingPower: 0, holdingQuantity: 0 };
          }
        }),
      );

      if (!portfolioId) {
        const security = await client.getSecurity(symbol);
        const historyByRange = Object.fromEntries(
          await Promise.all(
            ranges.map(async (range) => [range, await client.getPriceHistory(symbol, range)]),
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
      rememberUiLabSelectedPortfolio(user, portfolioId);
      const selectedPortfolio = getUiLabTerminalPortfolio(user, portfolioId);
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
      return {
        mode: client.mode,
        security,
        historyByRange,
        position: portfolio.holdings.find((h) => h.symbol === symbol) ?? null,
        onWatchlist: watchlist.some((w) => w.symbol === symbol),
        buyingPower: portfolio.buyingPower,
        marketStatus,
        portfolios,
        selectedPortfolio,
      };
    }

    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const {
      getLocalPortfolioSnapshot,
      listLocalWatchlistItems,
    } = await import("@/lib/terminal/terminal-local.service");

    const client = getTseClient({ userId: user.id });
    const listed = await listAccessibleTerminalPortfolios(user);
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
    const portfolios = listed.map((portfolio) => ({
      ...portfolio,
      buyingPower: portfolio.cashBalance ?? 0,
      holdingQuantity: 0,
    }));

    const security = await client.getSecurity(symbol);
    const historyByRange = Object.fromEntries(
      await Promise.all(ranges.map(async (range) => [range, await client.getPriceHistory(symbol, range)])),
    ) as Record<(typeof ranges)[number], Awaited<ReturnType<typeof client.getPriceHistory>>>;
    const marketStatus = await client.getMarketStatus();
    const watchlist = await listLocalWatchlistItems(user.id);

    if (!portfolioId) {
      return {
        mode: client.mode,
        security,
        historyByRange,
        position: null,
        onWatchlist: watchlist.some((w) => w.symbol === symbol),
        buyingPower: 0,
        marketStatus,
        portfolios,
        selectedPortfolio: null,
      };
    }

    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    const portfolio = await getLocalPortfolioSnapshot(portfolioId);
    const position = portfolio.holdings.find((h) => h.symbol === symbol) ?? null;
    return {
      mode: client.mode,
      security,
      historyByRange,
      position,
      onWatchlist: watchlist.some((w) => w.symbol === symbol),
      buyingPower: portfolio.buyingPower,
      marketStatus,
      portfolios: portfolios.map((row) =>
        row.id === portfolioId
          ? {
              ...row,
              buyingPower: portfolio.buyingPower,
              holdingQuantity: position?.quantity ?? 0,
              cashBalance: portfolio.cashBalance,
            }
          : row,
      ),
      selectedPortfolio,
    };
  });

export const fetchTerminalPortfolio = createServerFn({ method: "GET" })
  .inputValidator((input?: { portfolioId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();

    if (await isUiLab()) {
      const {
        listUiLabTerminalPortfolios,
        resolveUiLabTerminalPortfolioId,
        rememberUiLabSelectedPortfolio,
        getUiLabTerminalPortfolio,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const { eligibleCompaniesForPortfolioCreate } = await import(
        "@/lib/terminal/terminal-portfolio.service"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const portfolios = listUiLabTerminalPortfolios(user);
      const eligibleCompanies = eligibleCompaniesForPortfolioCreate(user);

      if (data.portfolioId && !portfolios.some((p) => p.id === data.portfolioId)) {
        return {
          mode: client.mode,
          portfolios,
          selectedPortfolio: null,
          portfolio: null,
          crypto: null,
          orders: [],
          activity: [],
          eligibleCompanies,
          portfolioUnavailable: true as const,
        };
      }

      const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
      if (!portfolioId) {
        return {
          mode: client.mode,
          portfolios,
          selectedPortfolio: null,
          portfolio: null,
          crypto: null,
          orders: [],
          activity: [],
          eligibleCompanies,
          portfolioUnavailable: false as const,
        };
      }
      rememberUiLabSelectedPortfolio(user, portfolioId);
      const selectedPortfolio = getUiLabTerminalPortfolio(user, portfolioId);
      const [portfolio, orders, activity] = await Promise.all([
        client.getPortfolio(portfolioId),
        client.listOrders(portfolioId),
        client.listPortfolioActivity(portfolioId),
      ]);
      const { getUiLabPortfolioCrypto } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      const { mergePortfolioSnapshotWithCrypto, parseCryptoMarkedValue } = await import(
        "@/lib/terminal/crypto/crypto-instrument"
      );
      const crypto = getUiLabPortfolioCrypto({
        portfolioId,
        userKey: user.id,
      });
      const withCryptoValue = mergePortfolioSnapshotWithCrypto(portfolio, crypto);
      // UI Lab fixtures lack real fill timelines — align the final chart point once with
      // live marked crypto so headline totalValue and series end do not diverge.
      const cryptoMarked = parseCryptoMarkedValue(crypto.totalMarkedValue);
      let seriesByRange = withCryptoValue.seriesByRange;
      if (cryptoMarked > 0) {
        const next = { ...seriesByRange };
        for (const range of Object.keys(next) as Array<keyof typeof next>) {
          const series = [...(next[range] ?? [])];
          if (series.length === 0) continue;
          const last = series[series.length - 1]!;
          // Fixture series already ends at stock/cash total; add crypto once.
          series[series.length - 1] = { t: last.t, v: last.v + cryptoMarked };
          next[range] = series;
        }
        seriesByRange = next;
      }
      return {
        mode: client.mode,
        portfolios,
        selectedPortfolio,
        portfolio: { ...withCryptoValue, seriesByRange },
        crypto,
        orders,
        activity,
        eligibleCompanies,
        portfolioUnavailable: false as const,
      };
    }

    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
      eligibleCompaniesForPortfolioCreate,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const {
      getLocalPortfolioSnapshot,
      listLocalOrders,
      listLocalPortfolioActivity,
    } = await import("@/lib/terminal/terminal-local.service");

    const client = getTseClient({ userId: user.id });
    const portfolios = await listAccessibleTerminalPortfolios(user);
    const eligibleCompanies = eligibleCompaniesForPortfolioCreate(user);

    if (data.portfolioId && !portfolios.some((portfolio) => portfolio.id === data.portfolioId)) {
      return {
        mode: client.mode,
        portfolios,
        selectedPortfolio: null,
        portfolio: null,
        crypto: null,
        orders: [],
        activity: [],
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
        crypto: null,
        orders: [],
        activity: [],
        eligibleCompanies,
        portfolioUnavailable: false as const,
      };
    }

    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    const { getPortfolioCryptoSummary } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );
    const { mergePortfolioSnapshotWithCrypto } = await import(
      "@/lib/terminal/crypto/crypto-instrument"
    );
    const [portfolio, orders, activity, cryptoResult] = await Promise.all([
      getLocalPortfolioSnapshot(portfolioId),
      listLocalOrders(portfolioId),
      listLocalPortfolioActivity(portfolioId),
      getPortfolioCryptoSummary(portfolioId).catch(() => null),
    ]);
    const crypto = cryptoResult;
    const { enrichPortfolioSnapshotWithCryptoHistory } = await import(
      "@/lib/terminal/crypto/crypto-portfolio-history.service"
    );
    const withCryptoValue = mergePortfolioSnapshotWithCrypto(portfolio, crypto);
    const withHistory = await enrichPortfolioSnapshotWithCryptoHistory(withCryptoValue);
    return {
      mode: client.mode,
      portfolios,
      selectedPortfolio,
      portfolio: withHistory,
      crypto,
      orders,
      activity,
      eligibleCompanies,
      portfolioUnavailable: false as const,
    };
  });

export const fetchTerminalWatchlist = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTerminalUser();
  if (await isUiLab()) {
    const { getUiLabDemonstrationClient } = await import(
      "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
    );
    const client = getUiLabDemonstrationClient(user.id);
    const [watchlist, securities] = await Promise.all([
      client.getWatchlist(),
      client.listSecurities(),
    ]);
    return { mode: client.mode, watchlist, securities };
  }
  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const { listLocalWatchlistItems } = await import("@/lib/terminal/terminal-local.service");
  const client = getTseClient({ userId: user.id });
  const [watchlist, securities] = await Promise.all([
    listLocalWatchlistItems(user.id),
    client.listSecurities(),
  ]);
  return { mode: client.mode, watchlist, securities };
});

export const addTerminalWatchlistSymbol = createServerFn({ method: "POST" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      return getUiLabDemonstrationClient(user.id).addToWatchlist(symbol);
    }
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const { addLocalWatchlistSymbol } = await import("@/lib/terminal/terminal-local.service");
    const client = getTseClient({ userId: user.id });
    const security = await client.getSecurity(symbol);
    if (!security) {
      throw new Error("Cannot add watchlist symbols until the market directory is available");
    }
    return addLocalWatchlistSymbol(user.id, symbol, { validatedByTse: true });
  });

export const removeTerminalWatchlistSymbol = createServerFn({ method: "POST" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      return getUiLabDemonstrationClient(user.id).removeFromWatchlist(symbol);
    }
    const { removeLocalWatchlistSymbol } = await import("@/lib/terminal/terminal-local.service");
    return removeLocalWatchlistSymbol(user.id, symbol);
  });

export const fetchTerminalOrders = createServerFn({ method: "GET" })
  .inputValidator((input?: { portfolioId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();

    if (await isUiLab()) {
      const {
        listUiLabTerminalPortfolios,
        resolveUiLabTerminalPortfolioId,
        rememberUiLabSelectedPortfolio,
        getUiLabTerminalPortfolio,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const portfolios = listUiLabTerminalPortfolios(user);
      const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
      if (!portfolioId) {
        return { mode: client.mode, orders: [], portfolios, selectedPortfolio: null };
      }
      rememberUiLabSelectedPortfolio(user, portfolioId);
      return {
        mode: client.mode,
        orders: await client.listOrders(portfolioId),
        portfolios,
        selectedPortfolio: getUiLabTerminalPortfolio(user, portfolioId),
      };
    }

    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const { listLocalOrders } = await import("@/lib/terminal/terminal-local.service");
    const client = getTseClient({ userId: user.id });
    const portfolios = await listAccessibleTerminalPortfolios(user);
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
    if (!portfolioId) {
      return { mode: client.mode, orders: [], portfolios, selectedPortfolio: null };
    }
    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const selectedPortfolio = await getTerminalPortfolioForUser(user, portfolioId);
    return {
      mode: client.mode,
      orders: await listLocalOrders(portfolioId),
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

    if (await isUiLab()) {
      const { getUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      const { assertCanTradePortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
      const portfolio = getUiLabTerminalPortfolio(user, data.portfolioId);
      assertCanTradePortfolio(user, portfolio);
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      return getUiLabDemonstrationClient(user.id).previewOrder(data);
    }

    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    assertCanTradePortfolio(user, portfolio);
    // Prefer blocking before persistence while TSE is unavailable.
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId: user.id }).previewOrder(data);
  });

export const submitTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderPreviewInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    if (!data.portfolioId?.trim()) {
      return {
        ok: false as const,
        errors: ["Portfolio is required"],
        code: "portfolio_required" as const,
      };
    }

    if (await isUiLab()) {
      const { getUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      const { assertCanTradePortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
      const portfolio = getUiLabTerminalPortfolio(user, data.portfolioId);
      assertCanTradePortfolio(user, portfolio);
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      return getUiLabDemonstrationClient(user.id).submitOrder(data);
    }

    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, "terminal.place_order");

    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    assertCanTradePortfolio(user, portfolio);
    // Block before persistence — do not create rejected local orders merely because TSE is down.
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    return getTseClient({ userId: user.id }).submitOrder(data);
  });

export const cancelTerminalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { portfolioId: string; orderId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();

    if (await isUiLab()) {
      const { getUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      const { assertCanTradePortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
      const portfolio = getUiLabTerminalPortfolio(user, data.portfolioId);
      assertCanTradePortfolio(user, portfolio);
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      return getUiLabDemonstrationClient(user.id).cancelOrder(data.portfolioId, data.orderId);
    }

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
    const { searchTerminalInstruments } = await import(
      "@/lib/terminal/crypto/crypto-market.functions"
    );
    const { results } = await searchTerminalInstruments({ data: { q: query } });

    return results.map((row) => {
      const lastPrice = row.lastPrice ?? 0;
      const tradingStatus =
        row.instrumentKind === "CRYPTO"
          ? mapCryptoSearchStatus(row.tradingStatus)
          : mapStockSearchStatus(row.tradingStatus);

      return {
        symbol: row.symbol,
        name: row.name,
        lastPrice,
        previousClose: lastPrice,
        dayChange: 0,
        dayChangePercent: 0,
        volume: 0,
        marketCap: null,
        tradingStatus,
        sparkline: [] as { t: number; v: number }[],
        instrumentKind: row.instrumentKind,
      };
    });
  });

function mapCryptoSearchStatus(
  statusLabel: string,
): "trading" | "halted" | "delayed" | "unavailable" {
  const s = statusLabel.toLowerCase();
  if (s.includes("halt")) return "halted";
  if (s.includes("redemption")) return "delayed";
  if (s.includes("active")) return "trading";
  if (s.includes("closed") || s.includes("unavailable")) return "unavailable";
  return "trading";
}

function mapStockSearchStatus(
  status: string,
): "trading" | "halted" | "delayed" | "unavailable" {
  if (status === "trading" || status === "halted" || status === "delayed" || status === "unavailable") {
    return status;
  }
  return "trading";
}

export const fetchQuickTradeContext = createServerFn({ method: "GET" })
  .inputValidator((input?: { symbol?: string; portfolioId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const symbol = data.symbol?.trim() ? data.symbol.trim().toUpperCase() : null;
    const { LAUNCH_ASSET_SYMBOLS } = await import("@/lib/terminal/crypto/crypto-constants");
    const isCryptoSymbol =
      symbol != null && (LAUNCH_ASSET_SYMBOLS as readonly string[]).includes(symbol);

    if (isCryptoSymbol && symbol) {
      if (await isUiLab()) {
        const {
          listUiLabTerminalPortfolios,
          resolveUiLabTerminalPortfolioId,
          rememberUiLabSelectedPortfolio,
          getUiLabTerminalPortfolio,
        } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
        const { getUiLabDemonstrationClient } = await import(
          "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
        );
        const { getUiLabCryptoDetail, getUiLabPortfolioCrypto } = await import(
          "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
        );
        const client = getUiLabDemonstrationClient(user.id);
        const listed = listUiLabTerminalPortfolios(user);
        const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
        const marketStatus = await client.getMarketStatus();
        const cryptoAsset = getUiLabCryptoDetail({ symbol, userKey: user.id });
        const basePortfolios = listed.map((portfolio) => ({
          ...portfolio,
          buyingPower: 0,
          holdingQuantity: 0,
        }));

        if (!portfolioId) {
          return {
            mode: client.mode,
            marketStatus,
            portfolios: basePortfolios,
            selectedPortfolio: null,
            security: null,
            position: null,
            buyingPower: 0,
            instrumentKind: "CRYPTO" as const,
            cryptoAsset,
            cryptoHolding: null,
            walletPublicId: null,
          };
        }

        rememberUiLabSelectedPortfolio(user, portfolioId);
        const [selectedPortfolio, portfolio, cryptoSummary] = await Promise.all([
          Promise.resolve(getUiLabTerminalPortfolio(user, portfolioId)),
          client.getPortfolio(portfolioId),
          Promise.resolve(
            getUiLabPortfolioCrypto({ portfolioId, userKey: user.id }),
          ),
        ]);
        const cryptoHolding =
          cryptoSummary.balances.find((b) => b.symbol === symbol) ?? null;

        return {
          mode: client.mode,
          marketStatus,
          portfolios: basePortfolios.map((row) =>
            row.id === portfolioId
              ? {
                  ...row,
                  totalValue: portfolio.totalValue,
                  dayChange: portfolio.dayChange,
                  dayChangePercent: portfolio.dayChangePercent,
                  valuationAvailable: true,
                  cashBalance: portfolio.cashBalance,
                  buyingPower: portfolio.buyingPower,
                  holdingQuantity: cryptoHolding
                    ? Number.parseFloat(cryptoHolding.quantity)
                    : 0,
                }
              : row,
          ),
          selectedPortfolio,
          security: null,
          position: null,
          buyingPower: portfolio.buyingPower,
          instrumentKind: "CRYPTO" as const,
          cryptoAsset,
          cryptoHolding,
          walletPublicId: cryptoSummary.hasWallet ? cryptoSummary.walletPublicId : null,
        };
      }

      const {
        listAccessibleTerminalPortfolios,
        resolveTerminalPortfolioId,
        rememberSelectedTerminalPortfolio,
        getTerminalPortfolioForUser,
      } = await import("@/lib/terminal/terminal-portfolio.service");
      const { getTseClient } = await import("@/lib/terminal/tse-client");
      const { getLocalPortfolioSnapshot } = await import("@/lib/terminal/terminal-local.service");
      const { getCryptoAssetDetail, getPortfolioCryptoSummary } = await import(
        "@/lib/terminal/crypto/crypto-market-read.service"
      );
      const client = getTseClient({ userId: user.id });
      const listed = await listAccessibleTerminalPortfolios(user);
      const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
      const marketStatus = await client.getMarketStatus();
      const basePortfolios = listed.map((portfolio) => ({
        ...portfolio,
        buyingPower: portfolio.cashBalance ?? 0,
        holdingQuantity: 0,
      }));

      let held = false;
      if (portfolioId) {
        try {
          const summary = await getPortfolioCryptoSummary(portfolioId);
          held = summary.balances.some(
            (b) => b.symbol === symbol && Number.parseFloat(b.quantity) > 0,
          );
        } catch {
          held = false;
        }
      }
      const cryptoAsset = await getCryptoAssetDetail(symbol, { held }).catch(() => null);

      if (!portfolioId) {
        return {
          mode: client.mode,
          marketStatus,
          portfolios: basePortfolios,
          selectedPortfolio: null,
          security: null,
          position: null,
          buyingPower: 0,
          instrumentKind: "CRYPTO" as const,
          cryptoAsset,
          cryptoHolding: null,
          walletPublicId: null,
        };
      }

      await rememberSelectedTerminalPortfolio(user, portfolioId);
      const [selectedPortfolio, portfolio, cryptoSummary] = await Promise.all([
        getTerminalPortfolioForUser(user, portfolioId),
        getLocalPortfolioSnapshot(portfolioId),
        getPortfolioCryptoSummary(portfolioId),
      ]);
      const cryptoHolding =
        cryptoSummary.balances.find((b) => b.symbol === symbol) ?? null;

      return {
        mode: client.mode,
        marketStatus,
        portfolios: basePortfolios.map((row) =>
          row.id === portfolioId
            ? {
                ...row,
                cashBalance: portfolio.cashBalance,
                buyingPower: portfolio.buyingPower,
                holdingQuantity: cryptoHolding
                  ? Number.parseFloat(cryptoHolding.quantity)
                  : 0,
              }
            : row,
        ),
        selectedPortfolio,
        security: null,
        position: null,
        buyingPower: portfolio.buyingPower,
        instrumentKind: "CRYPTO" as const,
        cryptoAsset,
        cryptoHolding,
        walletPublicId: cryptoSummary.hasWallet ? cryptoSummary.walletPublicId : null,
      };
    }

    if (await isUiLab()) {
      const {
        listUiLabTerminalPortfolios,
        resolveUiLabTerminalPortfolioId,
        rememberUiLabSelectedPortfolio,
        getUiLabTerminalPortfolio,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const listed = listUiLabTerminalPortfolios(user);
      const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
      const marketStatus = await client.getMarketStatus();
      const basePortfolios = listed.map((portfolio) => ({
        ...portfolio,
        buyingPower: 0,
        holdingQuantity: 0,
      }));
      if (!portfolioId) {
        return {
          mode: client.mode,
          marketStatus,
          portfolios: basePortfolios,
          selectedPortfolio: null,
          security: symbol ? await client.getSecurity(symbol) : null,
          position: null,
          buyingPower: 0,
          instrumentKind: "STOCK" as const,
          cryptoAsset: null,
          cryptoHolding: null,
          walletPublicId: null,
        };
      }
      rememberUiLabSelectedPortfolio(user, portfolioId);
      const [selectedPortfolio, security, portfolio] = await Promise.all([
        Promise.resolve(getUiLabTerminalPortfolio(user, portfolioId)),
        symbol ? client.getSecurity(symbol) : Promise.resolve(null),
        client.getPortfolio(portfolioId),
      ]);
      const position =
        security && portfolio
          ? (portfolio.holdings.find((h) => h.symbol === security.symbol) ?? null)
          : null;
      return {
        mode: client.mode,
        marketStatus,
        portfolios: basePortfolios.map((row) =>
          row.id === portfolioId
            ? {
                ...row,
                totalValue: portfolio.totalValue,
                dayChange: portfolio.dayChange,
                dayChangePercent: portfolio.dayChangePercent,
                valuationAvailable: true,
                cashBalance: portfolio.cashBalance,
                buyingPower: portfolio.buyingPower,
                holdingQuantity: position?.quantity ?? 0,
              }
            : row,
        ),
        selectedPortfolio,
        security,
        position,
        buyingPower: portfolio.buyingPower,
        instrumentKind: "STOCK" as const,
        cryptoAsset: null,
        cryptoHolding: null,
        walletPublicId: null,
      };
    }

    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const { getLocalPortfolioSnapshot } = await import("@/lib/terminal/terminal-local.service");
    const client = getTseClient({ userId: user.id });
    const listed = await listAccessibleTerminalPortfolios(user);
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);
    const marketStatus = await client.getMarketStatus();
    const basePortfolios = listed.map((portfolio) => ({
      ...portfolio,
      buyingPower: portfolio.cashBalance ?? 0,
      holdingQuantity: 0,
    }));

    if (!portfolioId) {
      return {
        mode: client.mode,
        marketStatus,
        portfolios: basePortfolios,
        selectedPortfolio: null,
        security: symbol ? await client.getSecurity(symbol) : null,
        position: null,
        buyingPower: 0,
        instrumentKind: "STOCK" as const,
        cryptoAsset: null,
        cryptoHolding: null,
        walletPublicId: null,
      };
    }

    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const [selectedPortfolio, security, portfolio] = await Promise.all([
      getTerminalPortfolioForUser(user, portfolioId),
      symbol ? client.getSecurity(symbol) : Promise.resolve(null),
      getLocalPortfolioSnapshot(portfolioId),
    ]);
    const position =
      security && portfolio
        ? (portfolio.holdings.find((h) => h.symbol === security.symbol) ?? null)
        : null;

    return {
      mode: client.mode,
      marketStatus,
      portfolios: basePortfolios.map((row) =>
        row.id === portfolioId
          ? {
              ...row,
              cashBalance: portfolio.cashBalance,
              buyingPower: portfolio.buyingPower,
              holdingQuantity: position?.quantity ?? 0,
            }
          : row,
      ),
      selectedPortfolio,
      security,
      position,
      buyingPower: portfolio.buyingPower,
      instrumentKind: "STOCK" as const,
      cryptoAsset: null,
      cryptoHolding: null,
      walletPublicId: null,
    };
  });

export const createTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateTerminalPortfolioInput) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const {
        createUiLabTerminalPortfolio,
        rememberUiLabSelectedPortfolio,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-portfolio");
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const created = createUiLabTerminalPortfolio(user, data);
      await getUiLabDemonstrationClient(user.id).ensurePortfolioMarketState(created.id, "empty");
      rememberUiLabSelectedPortfolio(user, created.id);
      return created;
    }
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, "terminal.create_portfolio");
    const { createTerminalPortfolio, rememberSelectedTerminalPortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const created = await createTerminalPortfolio(user, data);
    await rememberSelectedTerminalPortfolio(user, created.id);
    return created;
  });

export const renameTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((input: { portfolioId: string; name: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { renameUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      return renameUiLabTerminalPortfolio(user, data.portfolioId, data.name);
    }
    const { renameTerminalPortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
    return renameTerminalPortfolio(user, data.portfolioId, data.name);
  });

export const archiveTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { archiveUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      return archiveUiLabTerminalPortfolio(user, portfolioId);
    }
    const { archiveTerminalPortfolio } = await import("@/lib/terminal/terminal-portfolio.service");
    return archiveTerminalPortfolio(user, portfolioId);
  });

export const selectTerminalPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }) => {
    const user = await requireTerminalUser();
    if (await isUiLab()) {
      const { rememberUiLabSelectedPortfolio, getUiLabTerminalPortfolio } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-portfolio"
      );
      rememberUiLabSelectedPortfolio(user, portfolioId);
      return getUiLabTerminalPortfolio(user, portfolioId);
    }
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

/** Type helper for callers that still expect portfolio summaries. */
export type { TerminalPortfolioSummary };
