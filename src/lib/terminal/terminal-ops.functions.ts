import { createServerFn } from "@tanstack/react-start";
import type {
  TerminalInvestorRow,
  TerminalOpsHomeSummary,
  TerminalOpsOrderRow,
  TerminalOpsPortfolioDetail,
  TerminalOpsPortfolioRow,
  TerminalOpsScheduledTradeRow,
} from "@/lib/terminal/terminal-ops-types";
import type { TerminalOpsSystemStatus } from "@/lib/terminal/terminal-ops-admin.service";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";

async function requireTerminalOperator() {
  const { requireTerminalAdmin } = await import("@/server/permissions.service");
  return requireTerminalAdmin();
}

export const fetchTerminalOpsHomeSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsHomeSummary> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalHomeSummary } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      return getUiLabTerminalHomeSummary();
    }
    const {
      listTerminalOpsPortfoliosFromDb,
      listTerminalOpsOrdersFromDb,
      buildInvestorsFromPortfolios,
      buildTerminalOpsHomeSummary,
      loadCryptoCriticalAttentionIssues,
    } = await import("@/lib/terminal/terminal-ops-admin.service");
    const portfolios = await listTerminalOpsPortfoliosFromDb();
    const investors = buildInvestorsFromPortfolios(portfolios);
    const orders = await listTerminalOpsOrdersFromDb();
    const cryptoCriticalIssues = await loadCryptoCriticalAttentionIssues();
    return buildTerminalOpsHomeSummary({
      portfolios,
      investors,
      orders,
      cryptoCriticalIssues,
    });
  },
);

export const fetchTerminalInvestors = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalInvestorRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalInvestors } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      return getUiLabTerminalInvestors();
    }
    const { listTerminalOpsPortfoliosFromDb, buildInvestorsFromPortfolios } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    return buildInvestorsFromPortfolios(await listTerminalOpsPortfoliosFromDb());
  },
);

export const fetchTerminalPortfolios = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsPortfolioRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalPortfolios } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      return getUiLabTerminalPortfolios();
    }
    const { listTerminalOpsPortfoliosFromDb } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    return listTerminalOpsPortfoliosFromDb();
  },
);

export const fetchTerminalPortfolioDetail = createServerFn({ method: "GET" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }): Promise<TerminalOpsPortfolioDetail> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalPortfolioDetail } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      const detail = getUiLabTerminalPortfolioDetail(portfolioId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { getTerminalOpsPortfolioFromDb } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    const detail = await getTerminalOpsPortfolioFromDb(portfolioId);
    if (!detail) throw new Error("NOT_FOUND");
    return detail;
  });

export const fetchTerminalOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsOrderRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalOrders } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      return getUiLabTerminalOrders();
    }
    const { listTerminalOpsOrdersFromDb } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    return listTerminalOpsOrdersFromDb();
  },
);

export const fetchTerminalScheduledTrades = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsScheduledTradeRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { listUiLabScheduledTrades } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return listUiLabScheduledTrades().map((row) => ({
        id: row.id,
        portfolioId: row.portfolioId,
        portfolioName: row.portfolioName,
        investorLabel: "UI Lab investor",
        ownerUserId: null,
        ownerCompanyId: null,
        symbol: row.symbol,
        side: row.side,
        quantity: row.quantity,
        scheduleType: row.scheduleType,
        frequency: row.frequency,
        status: row.status,
        nextRunAt: row.nextRunAt,
        lastFailureSummary: row.lastFailureSummary,
        consecutiveFailures: row.consecutiveFailures,
        needsAttention: Boolean(row.lastFailureSummary) || row.status === "paused",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    }
    const { listTerminalOpsScheduledTradesFromDb } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
    return listTerminalOpsScheduledTradesFromDb();
  },
);

export const fetchTerminalOrderDetail = createServerFn({ method: "GET" })
  .inputValidator((orderId: string) => orderId)
  .handler(async ({ data: orderId }): Promise<TerminalOpsOrderRow> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalOrderDetail } =
        await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      const detail = getUiLabTerminalOrderDetail(orderId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { listTerminalOpsOrdersFromDb } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    const orders = await listTerminalOpsOrdersFromDb();
    const detail = orders.find((order) => order.id === orderId);
    if (!detail) throw new Error("NOT_FOUND");
    return detail;
  });

export const fetchTerminalInboxCases = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    Array<{
      id: string;
      caseType: string;
      title: string;
      detail: string;
      status: string;
      ageLabel: string;
      href: string;
      primaryAction: string;
      investorLabel: string | null;
      portfolioLabel: string | null;
      symbol: string | null;
    }>
  > => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const {
        getUiLabTerminalAttention,
        getUiLabTerminalOrders,
        getUiLabTerminalPortfolios,
        getUiLabTerminalInvestors,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures");
      const portfolios = getUiLabTerminalPortfolios();
      const byId = new Map(portfolios.map((p) => [p.id, p]));
      return getUiLabTerminalAttention().map((a) => {
        const order = getUiLabTerminalOrders().find((o) => o.id === a.orderId);
        const portfolio = a.portfolioId ? byId.get(a.portfolioId) : null;
        const investor =
          getUiLabTerminalInvestors().find(
            (i) =>
              (i.ownerUserId && a.href.includes(`/users/${i.ownerUserId}`)) ||
              (i.ownerCompanyId && a.href.includes(`/companies/${i.ownerCompanyId}`)),
          ) ?? null;
        return {
          id: a.id,
          caseType: a.kind,
          title: a.title,
          detail: a.detail,
          status: "open",
          ageLabel: a.createdAt.slice(0, 10),
          href: a.href,
          primaryAction:
            a.kind === "rejected_order"
              ? "Review rejected order"
              : a.kind === "connection_unavailable"
                ? "Review connection issue"
                : a.kind === "maintenance"
                  ? "Review investor"
                  : a.kind === "portfolio_access"
                    ? "Review portfolio access"
                    : a.kind.startsWith("crypto_")
                      ? "Review crypto market"
                      : "Review case",
          investorLabel: order?.investorLabel ?? portfolio?.ownerLabel ?? investor?.label ?? null,
          portfolioLabel: order?.portfolioName ?? portfolio?.name ?? null,
          symbol: order?.symbol ?? a.symbol ?? null,
        };
      });
    }
    const {
      buildTerminalOpsAttention,
      listTerminalOpsOrdersFromDb,
      loadCryptoCriticalAttentionIssues,
    } = await import("@/lib/terminal/terminal-ops-admin.service");
    const orders = await listTerminalOpsOrdersFromDb();
    const rejected = orders.filter((o) => o.status === "rejected");
    const cryptoCriticalIssues = await loadCryptoCriticalAttentionIssues();
    return buildTerminalOpsAttention(undefined, rejected, cryptoCriticalIssues).map((a) => ({
      id: a.id,
      caseType: a.kind,
      title: a.title,
      detail: a.detail,
      status: "open",
      ageLabel: a.createdAt.slice(0, 10),
      href: a.href,
      primaryAction:
        a.kind === "connection_unavailable"
          ? "Review connection issue"
          : a.kind === "rejected_order"
            ? "Review rejected order"
            : a.kind === "crypto_reconciliation"
              ? "Review crypto market"
              : "Review case",
      investorLabel: null,
      portfolioLabel: null,
      symbol: a.symbol ?? null,
    }));
  },
);

export const fetchTerminalSystemStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsSystemStatus> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoOpsDeskSummary } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      const { presentCryptoSystemAggregate } = await import(
        "@/lib/terminal/crypto/crypto-status-presentation"
      );
      const { resolveTerminalOpsEnvironmentStatus } = await import(
        "@/lib/terminal/terminal-ops-environment"
      );
      const desk = getUiLabCryptoOpsDeskSummary();
      const aggregate = presentCryptoSystemAggregate({
        statuses: desk.assets.map((a) => a.status),
        openCritical: desk.openCriticalIssueCount,
        uiLab: true,
      });
      return {
        environment: resolveTerminalOpsEnvironmentStatus(),
        localDatabase: {
          available: false,
          detail:
            "UI Lab demonstration — Terminal PostgreSQL is not the source of truth in this mode.",
        },
        marketData: {
          available: false,
          detail: "Demonstration market data — not a live TSE feed.",
        },
        orderExecution: {
          available: false,
          detail: "Demonstration order fixtures only — live TSE execution is unavailable.",
        },
        synchronization: {
          available: false,
          detail: "UI Lab does not synchronize with an external TSE.",
        },
        reconciliation: {
          available: false,
          detail: "Demonstration crypto integrity only — production reconciliation is separate.",
          readiness: [
            "UI Lab fixtures are demonstration-only",
            "Operations disabled in UI Lab",
          ],
        },
        jobs: {
          available: false,
          detail: "Crypto jobs are blocked from mutating in UI Lab.",
        },
        audit: {
          available: false,
          detail: "Demonstration audit detail is fixture-backed only.",
        },
        recurringTrades: {
          available: true,
          detail: "Demonstration scheduled-trade fixtures only.",
        },
        cryptoMarkets: {
          available: aggregate.available,
          statusLabel: aggregate.statusLabel,
          detail: aggregate.detail,
          assetStatuses: desk.assets.map((a) => ({ symbol: a.symbol, status: a.status })),
        },
      };
    }
    const { getTerminalOpsSystemStatus } =
      await import("@/lib/terminal/terminal-ops-admin.service");
    return getTerminalOpsSystemStatus();
  },
);

export const fetchTerminalEnvironmentStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireTerminalOperator();
    return resolveTerminalOpsEnvironmentStatus();
  },
);

/** Mock/UI Lab only — never reaches a live TSE endpoint. */
export const cancelTerminalOpsOrder = createServerFn({ method: "POST" })
  .inputValidator((orderId: string) => orderId)
  .handler(async ({ data: orderId }): Promise<{ ok: true }> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Order mutations are disabled in UI Lab.");
    }
    const env = resolveTerminalOpsEnvironmentStatus();
    if (!env.ordersMutable) {
      throw new Error("BAD_REQUEST:Order cancellation is unavailable — TSE is not live.");
    }
    void orderId;
    throw new Error("BAD_REQUEST:Live order cancellation is not implemented.");
  });
