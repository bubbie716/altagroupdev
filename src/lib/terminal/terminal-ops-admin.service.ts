/**
 * Terminal internal-ops data access (metadata + environment-aware market stubs).
 * Market/order aggregates are never invented for production unavailable mode.
 */
import type {
  TerminalInvestorRow,
  TerminalOpsAttentionItem,
  TerminalOpsHomeSummary,
  TerminalOpsOrderRow,
  TerminalOpsPortfolioDetail,
  TerminalOpsPortfolioRow,
} from "@/lib/terminal/terminal-ops-types";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";

function isMissingTerminalPortfolioTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /terminalportfolio|does not exist|no such table/i.test(message);
}

export async function listTerminalOpsPortfoliosFromDb(): Promise<TerminalOpsPortfolioRow[]> {
  try {
    const { prisma } = await import("@/server/db");
    const rows = await prisma.terminalPortfolio.findMany({
      include: {
        ownerCompany: { select: { id: true, name: true } },
        ownerUser: { select: { id: true, discordUsername: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });
    return rows.map((row) => {
      const ownerType = row.ownerType === "PERSONAL" ? ("personal" as const) : ("company" as const);
      const ownerLabel =
        ownerType === "personal"
          ? (row.ownerUser?.discordUsername ?? "Individual")
          : (row.ownerCompany?.name ?? "Company");
      return {
        id: row.id,
        name: row.name,
        ownerType,
        ownerLabel,
        ownerUserId: row.ownerUserId,
        ownerCompanyId: row.ownerCompanyId,
        status: row.status === "ACTIVE" ? ("active" as const) : ("archived" as const),
        isDefault: row.isDefault,
        totalValue: null,
        cashBalance: null,
        buyingPower: null,
        openOrderCount: 0,
        lastActivityAt: row.updatedAt.toISOString(),
        needsAttention: false,
        attentionDetail: null,
        dataTrustworthy: false,
        updatedAt: row.updatedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch (error) {
    if (isMissingTerminalPortfolioTable(error)) return [];
    throw error;
  }
}

export async function getTerminalOpsPortfolioFromDb(
  portfolioId: string,
): Promise<TerminalOpsPortfolioDetail | null> {
  const rows = await listTerminalOpsPortfoliosFromDb();
  const row = rows.find((p) => p.id === portfolioId);
  if (!row) return null;
  return {
    ...row,
    holdings: [],
    openOrders: [],
    recentOrders: [],
    activity: [],
  };
}

export function buildInvestorsFromPortfolios(
  portfolios: TerminalOpsPortfolioRow[],
): TerminalInvestorRow[] {
  const byKey = new Map<string, TerminalInvestorRow>();
  for (const p of portfolios) {
    if (p.ownerType === "personal" && p.ownerUserId) {
      const key = `user:${p.ownerUserId}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: key,
          kind: "individual",
          label: p.ownerLabel,
          portfolioCount: 1,
          activePortfolioCount: p.status === "active" ? 1 : 0,
          accessStatus: "active",
          needsAttention: false,
          attentionDetail: null,
          lastActivityAt: p.lastActivityAt,
          ownerUserId: p.ownerUserId,
          ownerCompanyId: null,
        });
      } else {
        existing.portfolioCount += 1;
        if (p.status === "active") existing.activePortfolioCount += 1;
        if (
          p.lastActivityAt &&
          (!existing.lastActivityAt || p.lastActivityAt > existing.lastActivityAt)
        ) {
          existing.lastActivityAt = p.lastActivityAt;
        }
      }
    } else if (p.ownerType === "company" && p.ownerCompanyId) {
      const key = `company:${p.ownerCompanyId}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: key,
          kind: "company",
          label: p.ownerLabel,
          portfolioCount: 1,
          activePortfolioCount: p.status === "active" ? 1 : 0,
          accessStatus: "active",
          needsAttention: false,
          attentionDetail: null,
          lastActivityAt: p.lastActivityAt,
          ownerUserId: null,
          ownerCompanyId: p.ownerCompanyId,
        });
      } else {
        existing.portfolioCount += 1;
        if (p.status === "active") existing.activePortfolioCount += 1;
        if (
          p.lastActivityAt &&
          (!existing.lastActivityAt || p.lastActivityAt > existing.lastActivityAt)
        ) {
          existing.lastActivityAt = p.lastActivityAt;
        }
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function buildTerminalOpsAttention(
  environment = resolveTerminalOpsEnvironmentStatus(),
  rejectedOrders: TerminalOpsOrderRow[] = [],
): TerminalOpsAttentionItem[] {
  const items: TerminalOpsAttentionItem[] = [];
  if (environment.connectionState === "unavailable" || environment.connectionState === "degraded") {
    items.push({
      id: "attn-tse-connection",
      kind: "connection_unavailable",
      title: "TSE connection unavailable",
      detail: environment.detail,
      href: "/internal/terminal/system",
      createdAt: environment.lastCheckedAt,
    });
  }
  for (const o of rejectedOrders) {
    items.push({
      id: `attn-order-${o.id}`,
      kind: "rejected_order",
      title: `Rejected order · ${o.symbol}`,
      detail: o.rejectReason ?? "Order rejected",
      href: `/internal/terminal/orders/${o.id}`,
      createdAt: o.updatedAt,
      portfolioId: o.portfolioId,
      orderId: o.id,
    });
  }
  return items;
}

export function buildTerminalOpsHomeSummary(input: {
  portfolios: TerminalOpsPortfolioRow[];
  investors: TerminalInvestorRow[];
  orders: TerminalOpsOrderRow[];
}): TerminalOpsHomeSummary {
  const environment = resolveTerminalOpsEnvironmentStatus();
  const active = input.portfolios.filter((p) => p.status === "active");
  const rejected = input.orders.filter((o) => o.status === "rejected");
  const attention = buildTerminalOpsAttention(environment, rejected);
  return {
    environment,
    attention,
    investorCount: input.investors.length,
    activePortfolioCount: active.length,
    openOrderCount: input.orders.filter((o) => o.status === "open" || o.status === "partial").length,
    rejectedOrderCount: rejected.length,
    recordedPortfolioValue: environment.marketDataTrustworthy
      ? active.reduce((sum, p) => sum + (p.totalValue ?? 0), 0)
      : null,
    lastActivityAt:
      input.portfolios
        .map((p) => p.lastActivityAt)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null,
  };
}

export type TerminalOpsSystemStatus = {
  environment: ReturnType<typeof resolveTerminalOpsEnvironmentStatus>;
  synchronization: {
    available: boolean;
    detail: string;
  };
  reconciliation: {
    available: boolean;
    detail: string;
    readiness: string[];
  };
  jobs: {
    available: boolean;
    detail: string;
  };
  audit: {
    available: boolean;
    detail: string;
  };
  recurringTrades: {
    available: boolean;
    detail: string;
  };
};

export function getTerminalOpsSystemStatus(): TerminalOpsSystemStatus {
  const environment = resolveTerminalOpsEnvironmentStatus();
  return {
    environment,
    synchronization: {
      available: false,
      detail:
        "Portfolio and market synchronization with an external TSE is not implemented. Metadata updates are local to Alta only.",
    },
    reconciliation: {
      available: false,
      detail:
        "Pooled-custody reconciliation (external TSE cash/positions vs internal customer ledgers) is not implemented.",
      readiness: [
        "Wire Newport TSE live client (quotes, orders, fills, positions, cash)",
        "Define custody mapping for pooled settlement vs customer ledgers",
        "Persist fills/settlements and open-order state for comparison",
        "Add idempotent reconciliation job with mismatch cases for Inbox",
      ],
    },
    jobs: {
      available: false,
      detail: "No Terminal-specific maintenance jobs are registered yet.",
    },
    audit: {
      available: false,
      detail: "Terminal-specific audit aggregation is not implemented for this console.",
    },
    recurringTrades: {
      available: false,
      detail:
        "Scheduled/recurring Terminal trades are not implemented (no models, execution jobs, or market-hours handlers).",
    },
  };
}
