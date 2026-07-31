/**
 * Server functions for Alta Terminal crypto market reads and unified instrument search.
 * UI Lab branches to demonstration fixtures — production uses PostgreSQL read service.
 */
import { createServerFn } from "@tanstack/react-start";
import type { CryptoChartRange } from "./crypto-market-read.service";

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

export type TerminalInstrumentSearchResult = {
  symbol: string;
  name: string;
  instrumentKind: "STOCK" | "CRYPTO";
  lastPrice: number | null;
  tradingStatus: string;
};

export const fetchTerminalCryptoMarkets = createServerFn({ method: "GET" })
  .inputValidator((input?: { scenario?: string; heldSymbols?: string[] }) => input ?? {})
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();

    if (await isUiLab()) {
      const { listUiLabCryptoAssets } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      const assets = listUiLabCryptoAssets({ userKey: user.id, scenario: data.scenario });
      return {
        available: assets.length > 0,
        assets,
        demonstration: true as const,
      };
    }

    const { listVisibleCryptoAssets } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );
    const assets = await listVisibleCryptoAssets({
      heldSymbols: data.heldSymbols,
    });
    return {
      available: assets.length > 0,
      assets,
      demonstration: false as const,
    };
  });

export const fetchTerminalCryptoAsset = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; portfolioId?: string; scenario?: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const symbol = data.symbol.trim().toUpperCase();

    if (await isUiLab()) {
      const { getUiLabCryptoDetail, getUiLabPortfolioCrypto } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      const asset = getUiLabCryptoDetail({
        symbol,
        userKey: user.id,
        scenario: data.scenario,
      });
      const portfolio =
        data.portfolioId != null
          ? getUiLabPortfolioCrypto({
              portfolioId: data.portfolioId,
              userKey: user.id,
              scenario: data.scenario,
            })
          : null;
      const holding =
        portfolio?.balances.find((b) => b.symbol === symbol) ?? null;
      return {
        demonstration: true as const,
        asset,
        portfolio,
        holding,
      };
    }

    const {
      getCryptoAssetDetail,
      getPortfolioCryptoSummary,
    } = await import("@/lib/terminal/crypto/crypto-market-read.service");

    let held = false;
    if (data.portfolioId) {
      const summary = await getPortfolioCryptoSummary(data.portfolioId);
      held = summary.balances.some(
        (b) => b.symbol === symbol && Number.parseFloat(b.quantity) > 0,
      );
    }

    const asset = await getCryptoAssetDetail(symbol, { held });
    const portfolio =
      data.portfolioId != null
        ? await getPortfolioCryptoSummary(data.portfolioId)
        : null;
    const holding = portfolio?.balances.find((b) => b.symbol === symbol) ?? null;

    return {
      demonstration: false as const,
      asset,
      portfolio,
      holding,
    };
  });

export const fetchTerminalCryptoHistory = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; range: CryptoChartRange; scenario?: string }) => input)
  .handler(async ({ data }) => {
    await requireTerminalUser();
    const symbol = data.symbol.trim().toUpperCase();

    if (await isUiLab()) {
      const { getUiLabCryptoHistory } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      return {
        demonstration: true as const,
        ...getUiLabCryptoHistory({ symbol, range: data.range }),
      };
    }

    const { getCryptoPriceHistory } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );
    const history = await getCryptoPriceHistory(symbol, data.range);
    return {
      demonstration: false as const,
      ...history,
    };
  });

export const fetchTerminalPortfolioCrypto = createServerFn({ method: "GET" })
  .inputValidator((input: { portfolioId: string; scenario?: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();

    if (await isUiLab()) {
      const { getUiLabPortfolioCrypto } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      return {
        demonstration: true as const,
        summary: getUiLabPortfolioCrypto({
          portfolioId: data.portfolioId,
          userKey: user.id,
          scenario: data.scenario,
        }),
      };
    }

    const { getTerminalPortfolioForUser } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const portfolio = await getTerminalPortfolioForUser(user, data.portfolioId);
    if (!portfolio) {
      return {
        demonstration: false as const,
        summary: null,
        forbidden: true as const,
      };
    }

    const { getPortfolioCryptoSummary, getPortfolioCryptoOrders } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );
    const [summary, orders] = await Promise.all([
      getPortfolioCryptoSummary(data.portfolioId),
      getPortfolioCryptoOrders(data.portfolioId, 20),
    ]);

    return {
      demonstration: false as const,
      summary,
      orders,
      forbidden: false as const,
    };
  });

export const searchTerminalInstruments = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string; scenario?: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const query = data.q.trim().toLowerCase();

    if (await isUiLab()) {
      const { listUiLabCryptoAssets } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-fixtures"
      );
      const { getUiLabDemonstrationClient } = await import(
        "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client"
      );
      const client = getUiLabDemonstrationClient(user.id);
      const [stocks, cryptoAssets] = await Promise.all([
        client.listSecurities(data.q),
        Promise.resolve(listUiLabCryptoAssets({ userKey: user.id, scenario: data.scenario })),
      ]);

      const stockResults: TerminalInstrumentSearchResult[] = stocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        instrumentKind: "STOCK" as const,
        lastPrice: s.lastPrice,
        tradingStatus: s.tradingStatus,
      }));

      const cryptoResults: TerminalInstrumentSearchResult[] = cryptoAssets
        .filter(
          (a) =>
            !query ||
            a.symbol.toLowerCase().includes(query) ||
            a.displayName.toLowerCase().includes(query),
        )
        .map((a) => ({
          symbol: a.symbol,
          name: a.displayName,
          instrumentKind: "CRYPTO" as const,
          lastPrice: Number.parseFloat(a.currentPrice),
          tradingStatus: a.statusLabel,
        }));

      return {
        demonstration: true as const,
        results: [...cryptoResults, ...stockResults].slice(0, 20),
      };
    }

    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const { listVisibleCryptoAssets } = await import(
      "@/lib/terminal/crypto/crypto-market-read.service"
    );

    const client = getTseClient({ userId: user.id });
    const [stocks, cryptoAssets] = await Promise.all([
      client.listSecurities(data.q),
      listVisibleCryptoAssets(),
    ]);

    const stockResults: TerminalInstrumentSearchResult[] = stocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      instrumentKind: "STOCK" as const,
      lastPrice: s.lastPrice,
      tradingStatus: s.tradingStatus,
    }));

    const cryptoResults: TerminalInstrumentSearchResult[] = cryptoAssets
      .filter(
        (a) =>
          !query ||
          a.symbol.toLowerCase().includes(query) ||
          a.displayName.toLowerCase().includes(query),
      )
      .map((a) => ({
        symbol: a.symbol,
        name: a.displayName,
        instrumentKind: "CRYPTO" as const,
        lastPrice: Number.parseFloat(a.currentPrice),
        tradingStatus: a.statusLabel,
      }));

    return {
      demonstration: false as const,
      results: [...cryptoResults, ...stockResults].slice(0, 20),
    };
  });

const CRYPTO_CHART_RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

/**
 * Security-detail page payload for crypto instruments.
 * Loads portfolio picker data the same way stock security does (without requiring a TSE security).
 */
export const fetchTerminalCryptoSecurityPage = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; portfolioId?: string; scenario?: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireTerminalUser();
    const symbol = data.symbol.trim().toUpperCase();
    const scenario = data.scenario;

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
      const {
        getUiLabCryptoDetail,
        getUiLabPortfolioCrypto,
        getUiLabCryptoHistory,
      } = await import("@/lib/terminal/ui-lab/ui-lab-crypto-fixtures");

      const client = getUiLabDemonstrationClient(user.id);
      const listed = listUiLabTerminalPortfolios(user);
      const portfolioId = resolveUiLabTerminalPortfolioId(user, data.portfolioId);
      const asset = getUiLabCryptoDetail({ symbol, userKey: user.id, scenario });
      if (!asset) {
        return {
          kind: "crypto" as const,
          demonstration: true as const,
          mode: client.mode,
          asset: null,
          historyByRange: Object.fromEntries(
            CRYPTO_CHART_RANGES.map((range) => [range, [] as { t: number; v: number }[]]),
          ) as unknown as Record<(typeof CRYPTO_CHART_RANGES)[number], { t: number; v: number }[]>,
          holding: null,
          walletPublicId: null,
          buyingPower: 0,
          portfolios: listed.map((p) => ({ ...p, buyingPower: 0, holdingQuantity: 0 })),
          selectedPortfolio: null,
        };
      }

      const historyByRange = Object.fromEntries(
        CRYPTO_CHART_RANGES.map((range) => {
          const history = getUiLabCryptoHistory({ symbol, range });
          return [
            range,
            history.points.map((p) => ({ t: p.t, v: Number.parseFloat(p.price) })),
          ];
        }),
      ) as Record<(typeof CRYPTO_CHART_RANGES)[number], { t: number; v: number }[]>;

      const portfolios = await Promise.all(
        listed.map(async (portfolio) => {
          try {
            const [snapshot, cryptoSummary] = await Promise.all([
              client.getPortfolio(portfolio.id),
              Promise.resolve(
                getUiLabPortfolioCrypto({
                  portfolioId: portfolio.id,
                  userKey: user.id,
                  scenario,
                }),
              ),
            ]);
            const balance = cryptoSummary.balances.find((b) => b.symbol === symbol);
            return {
              ...portfolio,
              totalValue: snapshot.totalValue,
              dayChange: snapshot.dayChange,
              dayChangePercent: snapshot.dayChangePercent,
              valuationAvailable: true,
              cashBalance: snapshot.cashBalance,
              buyingPower: snapshot.buyingPower,
              holdingQuantity: balance ? Number.parseFloat(balance.quantity) : 0,
            };
          } catch {
            return { ...portfolio, buyingPower: 0, holdingQuantity: 0 };
          }
        }),
      );

      if (!portfolioId) {
        return {
          kind: "crypto" as const,
          demonstration: true as const,
          mode: client.mode,
          asset,
          historyByRange,
          holding: null,
          walletPublicId: null,
          buyingPower: 0,
          portfolios,
          selectedPortfolio: null,
        };
      }

      rememberUiLabSelectedPortfolio(user, portfolioId);
      const selectedPortfolio = getUiLabTerminalPortfolio(user, portfolioId);
      const [snapshot, cryptoSummary] = await Promise.all([
        client.getPortfolio(portfolioId),
        Promise.resolve(
          getUiLabPortfolioCrypto({
            portfolioId,
            userKey: user.id,
            scenario,
          }),
        ),
      ]);
      const holding = cryptoSummary.balances.find((b) => b.symbol === symbol) ?? null;

      return {
        kind: "crypto" as const,
        demonstration: true as const,
        mode: client.mode,
        asset,
        historyByRange,
        holding,
        walletPublicId: cryptoSummary.hasWallet ? cryptoSummary.walletPublicId : null,
        buyingPower: snapshot.buyingPower,
        portfolios: portfolios.map((row) =>
          row.id === portfolioId
            ? {
                ...row,
                buyingPower: snapshot.buyingPower,
                cashBalance: snapshot.cashBalance,
                holdingQuantity: holding ? Number.parseFloat(holding.quantity) : 0,
              }
            : row,
        ),
        selectedPortfolio,
      };
    }

    const {
      listAccessibleTerminalPortfolios,
      resolveTerminalPortfolioId,
      rememberSelectedTerminalPortfolio,
      getTerminalPortfolioForUser,
    } = await import("@/lib/terminal/terminal-portfolio.service");
    const { getLocalPortfolioSnapshot } = await import("@/lib/terminal/terminal-local.service");
    const { getTseClient } = await import("@/lib/terminal/tse-client");
    const {
      getCryptoAssetDetail,
      getPortfolioCryptoSummary,
      getCryptoPriceHistory,
    } = await import("@/lib/terminal/crypto/crypto-market-read.service");

    const client = getTseClient({ userId: user.id });
    const listed = await listAccessibleTerminalPortfolios(user);
    const portfolioId = await resolveTerminalPortfolioId(user, data.portfolioId);

    let held = false;
    if (portfolioId) {
      const summary = await getPortfolioCryptoSummary(portfolioId);
      held = summary.balances.some(
        (b) => b.symbol === symbol && Number.parseFloat(b.quantity) > 0,
      );
    }

    const asset = await getCryptoAssetDetail(symbol, { held });
    const historyByRange = Object.fromEntries(
      await Promise.all(
        CRYPTO_CHART_RANGES.map(async (range) => {
          const history = await getCryptoPriceHistory(symbol, range);
          return [
            range,
            history.points.map((p) => ({ t: p.t, v: Number.parseFloat(p.price) })),
          ];
        }),
      ),
    ) as Record<(typeof CRYPTO_CHART_RANGES)[number], { t: number; v: number }[]>;

    const portfolios = listed.map((portfolio) => ({
      ...portfolio,
      buyingPower: portfolio.cashBalance ?? 0,
      holdingQuantity: 0,
    }));

    if (!asset) {
      return {
        kind: "crypto" as const,
        demonstration: false as const,
        mode: client.mode,
        asset: null,
        historyByRange,
        holding: null,
        walletPublicId: null,
        buyingPower: 0,
        portfolios,
        selectedPortfolio: null,
      };
    }

    if (!portfolioId) {
      return {
        kind: "crypto" as const,
        demonstration: false as const,
        mode: client.mode,
        asset,
        historyByRange,
        holding: null,
        walletPublicId: null,
        buyingPower: 0,
        portfolios,
        selectedPortfolio: null,
      };
    }

    await rememberSelectedTerminalPortfolio(user, portfolioId);
    const [selectedPortfolio, portfolio, cryptoSummary] = await Promise.all([
      getTerminalPortfolioForUser(user, portfolioId),
      getLocalPortfolioSnapshot(portfolioId),
      getPortfolioCryptoSummary(portfolioId),
    ]);
    const holding = cryptoSummary.balances.find((b) => b.symbol === symbol) ?? null;

    return {
      kind: "crypto" as const,
      demonstration: false as const,
      mode: client.mode,
      asset,
      historyByRange,
      holding,
      walletPublicId: cryptoSummary.hasWallet ? cryptoSummary.walletPublicId : null,
      buyingPower: portfolio.buyingPower,
      portfolios: portfolios.map((row) =>
        row.id === portfolioId
          ? {
              ...row,
              buyingPower: portfolio.buyingPower,
              cashBalance: portfolio.cashBalance,
              holdingQuantity: holding ? Number.parseFloat(holding.quantity) : 0,
            }
          : row,
      ),
      selectedPortfolio,
    };
  });
