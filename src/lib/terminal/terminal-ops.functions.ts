import { createServerFn } from "@tanstack/react-start";
import type {
  TerminalInvestorRow,
  TerminalOpsHomeSummary,
  TerminalOpsOrderRow,
  TerminalOpsPortfolioDetail,
  TerminalOpsPortfolioRow,
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
      const { getUiLabTerminalHomeSummary } = await import(
        "@/lib/terminal/ui-lab-terminal-ops-fixtures"
      );
      return getUiLabTerminalHomeSummary();
    }
    const {
      listTerminalOpsPortfoliosFromDb,
      buildInvestorsFromPortfolios,
      buildTerminalOpsHomeSummary,
    } = await import("@/lib/terminal/terminal-ops-admin.service");
    const portfolios = await listTerminalOpsPortfoliosFromDb();
    const investors = buildInvestorsFromPortfolios(portfolios);
    return buildTerminalOpsHomeSummary({ portfolios, investors, orders: [] });
  },
);

export const fetchTerminalInvestors = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalInvestorRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalInvestors } = await import(
        "@/lib/terminal/ui-lab-terminal-ops-fixtures"
      );
      return getUiLabTerminalInvestors();
    }
    const { listTerminalOpsPortfoliosFromDb, buildInvestorsFromPortfolios } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
    return buildInvestorsFromPortfolios(await listTerminalOpsPortfoliosFromDb());
  },
);

export const fetchTerminalPortfolios = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsPortfolioRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalPortfolios } = await import(
        "@/lib/terminal/ui-lab-terminal-ops-fixtures"
      );
      return getUiLabTerminalPortfolios();
    }
    const { listTerminalOpsPortfoliosFromDb } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
    return listTerminalOpsPortfoliosFromDb();
  },
);

export const fetchTerminalPortfolioDetail = createServerFn({ method: "GET" })
  .inputValidator((portfolioId: string) => portfolioId)
  .handler(async ({ data: portfolioId }): Promise<TerminalOpsPortfolioDetail> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalPortfolioDetail } = await import(
        "@/lib/terminal/ui-lab-terminal-ops-fixtures"
      );
      const detail = getUiLabTerminalPortfolioDetail(portfolioId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { getTerminalOpsPortfolioFromDb } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
    const detail = await getTerminalOpsPortfolioFromDb(portfolioId);
    if (!detail) throw new Error("NOT_FOUND");
    return detail;
  });

export const fetchTerminalOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsOrderRow[]> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalOrders } = await import("@/lib/terminal/ui-lab-terminal-ops-fixtures");
      return getUiLabTerminalOrders();
    }
    // Live/unavailable: no TSE order ledger for operators yet.
    return [];
  },
);

export const fetchTerminalOrderDetail = createServerFn({ method: "GET" })
  .inputValidator((orderId: string) => orderId)
  .handler(async ({ data: orderId }): Promise<TerminalOpsOrderRow> => {
    await requireTerminalOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalOrderDetail } = await import(
        "@/lib/terminal/ui-lab-terminal-ops-fixtures"
      );
      const detail = getUiLabTerminalOrderDetail(orderId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    throw new Error("NOT_FOUND");
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
      const { getUiLabTerminalAttention, getUiLabTerminalOrders, getUiLabTerminalPortfolios, getUiLabTerminalInvestors } =
        await import("@/lib/terminal/ui-lab-terminal-ops-fixtures");
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
                    : "Review case",
          investorLabel: order?.investorLabel ?? portfolio?.ownerLabel ?? investor?.label ?? null,
          portfolioLabel: order?.portfolioName ?? portfolio?.name ?? null,
          symbol: order?.symbol ?? null,
        };
      });
    }
    const { buildTerminalOpsAttention } = await import("@/lib/terminal/terminal-ops-admin.service");
    return buildTerminalOpsAttention().map((a) => ({
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
            : "Review case",
      investorLabel: null,
      portfolioLabel: null,
      symbol: null,
    }));
  },
);

export const fetchTerminalSystemStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<TerminalOpsSystemStatus> => {
    await requireTerminalOperator();
    const { getTerminalOpsSystemStatus } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
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
