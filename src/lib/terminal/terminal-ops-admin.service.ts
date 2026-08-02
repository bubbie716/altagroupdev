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
  TerminalOpsScheduledTradeRow,
} from "@/lib/terminal/terminal-ops-types";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import { formatAltaUserHandle } from "@/lib/auth/user-display";

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
        ownerUser: { select: { id: true, discordUsername: true, minecraftUsername: true } },
        cashAccount: { select: { availableCash: true } },
        orders: {
          where: { status: { in: ["OPEN", "PARTIAL"] } },
          select: { id: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });
    return rows.map((row) => {
      const ownerType = row.ownerType === "PERSONAL" ? ("personal" as const) : ("company" as const);
      const ownerLabel =
        ownerType === "personal"
          ? (row.ownerUser ? formatAltaUserHandle(row.ownerUser) : null) || "Individual"
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
        cashBalance: row.cashAccount ? Number(row.cashAccount.availableCash) : 0,
        buyingPower: row.cashAccount ? Number(row.cashAccount.availableCash) : 0,
        openOrderCount: row.orders.length,
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

export async function listTerminalOpsOrdersFromDb(): Promise<TerminalOpsOrderRow[]> {
  const { prisma } = await import("@/server/db");
  const orders = await prisma.terminalOrder.findMany({
    include: {
      portfolio: {
        select: {
          name: true,
          ownerUserId: true,
          ownerCompanyId: true,
          ownerUser: { select: { discordUsername: true, minecraftUsername: true } },
          ownerCompany: { select: { name: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 500,
  });
  return orders.map((order) => {
    const investorLabel =
      (order.portfolio.ownerUser
        ? formatAltaUserHandle(order.portfolio.ownerUser)
        : null) ??
      order.portfolio.ownerCompany?.name ??
      "Unknown investor";
    return {
      id: order.id,
      portfolioId: order.portfolioId,
      portfolioName: order.portfolio.name,
      investorLabel,
      ownerUserId: order.portfolio.ownerUserId,
      ownerCompanyId: order.portfolio.ownerCompanyId,
      symbol: order.symbol,
      name: order.symbol,
      side: order.side === "BUY" ? "buy" : "sell",
      type: order.orderType === "MARKET" ? "market" : "limit",
      status: order.status.toLowerCase() as TerminalOpsOrderRow["status"],
      quantity: Number(order.quantity),
      filledQuantity: Number(order.filledQuantity),
      limitPrice: order.limitPrice == null ? null : Number(order.limitPrice),
      averageFillPrice: order.averageFillPrice == null ? null : Number(order.averageFillPrice),
      estimatedValue: order.estimatedValue == null ? 0 : Number(order.estimatedValue),
      submittedAt: order.submittedAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      rejectReason: order.rejectReason,
      needsAttention: order.status === "REJECTED" || Boolean(order.rejectReason),
    };
  });
}

export async function listTerminalOpsScheduledTradesFromDb(): Promise<TerminalOpsScheduledTradeRow[]> {
  try {
    const { prisma } = await import("@/server/db");
    const rows = await prisma.terminalScheduledTradeInstruction.findMany({
      include: {
        portfolio: {
          select: {
            name: true,
            ownerUserId: true,
            ownerCompanyId: true,
            ownerUser: { select: { discordUsername: true, minecraftUsername: true } },
            ownerCompany: { select: { name: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { nextRunAt: "asc" }, { updatedAt: "desc" }],
      take: 500,
    });
    return rows.map((row) => {
      const investorLabel =
        (row.portfolio.ownerUser ? formatAltaUserHandle(row.portfolio.ownerUser) : null) ??
        row.portfolio.ownerCompany?.name ??
        "Unknown investor";
      const status = row.status.toLowerCase() as TerminalOpsScheduledTradeRow["status"];
      const needsAttention =
        status === "paused" ||
        row.consecutiveFailures > 0 ||
        Boolean(row.lastFailureSummary) ||
        (row.nextRunAt != null && row.nextRunAt.getTime() < Date.now() - 60 * 60 * 1000);
      return {
        id: row.id,
        portfolioId: row.portfolioId,
        portfolioName: row.portfolio.name,
        investorLabel,
        ownerUserId: row.portfolio.ownerUserId,
        ownerCompanyId: row.portfolio.ownerCompanyId,
        symbol: row.symbol,
        side: row.side === "BUY" ? "buy" : "sell",
        quantity: Number(row.quantity),
        scheduleType: row.scheduleType === "ONE_TIME" ? "one_time" : "recurring",
        frequency: row.frequency
          ? (row.frequency.toLowerCase() as TerminalOpsScheduledTradeRow["frequency"])
          : null,
        status,
        nextRunAt: row.nextRunAt?.toISOString() ?? null,
        lastFailureSummary: row.lastFailureSummary,
        consecutiveFailures: row.consecutiveFailures,
        needsAttention,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/terminalscheduledtrade|does not exist|no such table/i.test(message)) return [];
    throw error;
  }
}

export async function getTerminalOpsPortfolioFromDb(
  portfolioId: string,
): Promise<TerminalOpsPortfolioDetail | null> {
  const rows = await listTerminalOpsPortfoliosFromDb();
  const row = rows.find((p) => p.id === portfolioId);
  if (!row) return null;
  const { prisma } = await import("@/server/db");
  const orders = await prisma.terminalOrder.findMany({
    where: { portfolioId },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  const orderRows: TerminalOpsOrderRow[] = orders.map((order) => ({
    id: order.id,
    portfolioId: order.portfolioId,
    portfolioName: row.name,
    investorLabel: row.ownerLabel,
    ownerUserId: row.ownerUserId,
    ownerCompanyId: row.ownerCompanyId,
    symbol: order.symbol,
    name: order.symbol,
    side: order.side === "BUY" ? "buy" : "sell",
    type: order.orderType === "MARKET" ? "market" : "limit",
    status: order.status.toLowerCase() as TerminalOpsOrderRow["status"],
    quantity: Number(order.quantity),
    filledQuantity: Number(order.filledQuantity),
    limitPrice: order.limitPrice == null ? null : Number(order.limitPrice),
    averageFillPrice: order.averageFillPrice == null ? null : Number(order.averageFillPrice),
    estimatedValue: order.estimatedValue == null ? 0 : Number(order.estimatedValue),
    submittedAt: order.submittedAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    rejectReason: order.rejectReason,
    needsAttention: order.status === "REJECTED" || Boolean(order.rejectReason),
  }));
  const { listPortfolioFundingTransfersForOps } = await import(
    "@/server/terminal-funding.service"
  );
  const fundingRows = await listPortfolioFundingTransfersForOps(portfolioId, {
    maskBank: true,
    limit: 20,
  });

  return {
    ...row,
    holdings: [],
    openOrders: orderRows.filter((order) => order.status === "open" || order.status === "partial"),
    recentOrders: orderRows,
    activity: [],
    fundingTransfers: fundingRows.map((t) => ({
      id: t.id,
      referenceCode: t.referenceCode,
      direction: t.direction,
      status: t.status,
      amount: t.amount,
      bankAccountMasked: t.bankAccountMasked,
      createdAt: t.createdAt,
    })),
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
  cryptoCriticalIssues: Array<{
    id: string;
    summary: string;
    createdAt: string;
    symbol: string | null;
  }> = [],
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
  const seenCrypto = new Set<string>();
  for (const issue of cryptoCriticalIssues) {
    const dedupeKey = issue.symbol ?? issue.id;
    if (seenCrypto.has(dedupeKey)) continue;
    seenCrypto.add(dedupeKey);
    items.push({
      id: `attn-crypto-${issue.id}`,
      kind: "crypto_reconciliation",
      title: issue.symbol
        ? `Crypto recon · ${issue.symbol}`
        : "Crypto reconciliation critical",
      detail: issue.summary,
      href: issue.symbol
        ? `/internal/terminal/crypto/${issue.symbol}?tab=overview`
        : "/internal/terminal/crypto",
      createdAt: issue.createdAt,
      symbol: issue.symbol ?? undefined,
    });
  }
  return items;
}

export async function loadCryptoCriticalAttentionIssues(): Promise<
  Array<{ id: string; summary: string; createdAt: string; symbol: string | null }>
> {
  try {
    const { isDatabaseConfigured, prisma } = await import("@/server/db");
    if (!isDatabaseConfigured()) return [];
    const issues = await prisma.terminalCryptoReconciliationIssue.findMany({
      where: { status: "OPEN", severity: "CRITICAL" },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { symbol: true } } },
    });
    return issues.map((issue) => ({
      id: issue.id,
      summary: issue.summary,
      createdAt: issue.createdAt.toISOString(),
      symbol: issue.asset?.symbol ?? null,
    }));
  } catch {
    return [];
  }
}

export function buildTerminalOpsHomeSummary(input: {
  portfolios: TerminalOpsPortfolioRow[];
  investors: TerminalInvestorRow[];
  orders: TerminalOpsOrderRow[];
  cryptoCriticalIssues?: Array<{
    id: string;
    summary: string;
    createdAt: string;
    symbol: string | null;
  }>;
}): TerminalOpsHomeSummary {
  const environment = resolveTerminalOpsEnvironmentStatus();
  const active = input.portfolios.filter((p) => p.status === "active");
  const rejected = input.orders.filter((o) => o.status === "rejected");
  const attention = buildTerminalOpsAttention(
    environment,
    rejected,
    input.cryptoCriticalIssues ?? [],
  );
  return {
    environment,
    attention,
    investorCount: input.investors.length,
    activePortfolioCount: active.length,
    openOrderCount: input.orders.filter((o) => o.status === "open" || o.status === "partial")
      .length,
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
  localDatabase: {
    available: boolean;
    detail: string;
  };
  marketData: {
    available: boolean;
    detail: string;
  };
  orderExecution: {
    available: boolean;
    detail: string;
  };
  synchronization: {
    available: boolean;
    detail: string;
  };
  reconciliation: {
    available: boolean;
    detail: string;
    readiness: string[];
  };
  /** Alta Crypto ledger reconciliation (self-managed) — distinct from TSE pooled custody. */
  cryptoReconciliation: {
    available: boolean;
    statusLabel: string;
    detail: string;
    lastSuccessfulAt: string | null;
    openCritical: number;
    openWarning: number;
  };
  candleRollup: {
    available: boolean;
    detail: string;
  };
  revenueSweep: {
    available: boolean;
    detail: string;
  };
  configurationSecrets: {
    quoteSecretConfigured: boolean;
    revenuePortfolioConfigured: boolean;
    detail: string;
  };
  backupReadiness: {
    available: boolean;
    detail: string;
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
  cryptoMarkets: {
    available: boolean;
    statusLabel: string;
    detail: string;
    assetStatuses: Array<{ symbol: string; status: string }>;
  };
  newportLiveMarket: {
    available: boolean;
    detail: string;
  };
};

export async function getTerminalOpsSystemStatus(): Promise<TerminalOpsSystemStatus> {
  const environment = resolveTerminalOpsEnvironmentStatus();
  let localDatabaseAvailable = false;
  let localDatabaseDetail =
    "Terminal PostgreSQL persistence is not configured (DATABASE_URL missing).";
  try {
    const { isDatabaseConfigured, prisma } = await import("@/server/db");
    if (isDatabaseConfigured()) {
      await prisma.terminalPortfolio.count();
      try {
        await prisma.terminalPortfolioCashAccount.count();
        localDatabaseAvailable = true;
        localDatabaseDetail =
          "Local Terminal database is reachable. Portfolio metadata, cash accounts, orders, and watchlists persist in PostgreSQL.";
      } catch {
        localDatabaseAvailable = false;
        localDatabaseDetail =
          "Terminal portfolio metadata is reachable, but the persistent foundation migration has not been applied yet.";
      }
    }
  } catch {
    localDatabaseAvailable = false;
    localDatabaseDetail =
      "Local Terminal database is configured but unreachable or not migrated.";
  }

  let cryptoMarkets: TerminalOpsSystemStatus["cryptoMarkets"] = {
    available: false,
    statusLabel: "Not configured",
    detail:
      "Fictional Alta Crypto schema/state is not available yet. Apply Phase 1–4 migrations before activation.",
    assetStatuses: [],
  };
  try {
    const { isDatabaseConfigured, prisma } = await import("@/server/db");
    if (isDatabaseConfigured()) {
      const assets = await prisma.terminalCryptoAsset.findMany({
        select: { symbol: true, status: true },
        orderBy: { symbol: "asc" },
      });
      if (assets.length > 0) {
        let openCritical = 0;
        try {
          openCritical = await prisma.terminalCryptoReconciliationIssue.count({
            where: { status: "OPEN", severity: "CRITICAL" },
          });
        } catch {
          openCritical = 0;
        }

        const statuses = new Set(assets.map((a) => a.status));
        const anyActive = statuses.has("ACTIVE");
        const anyHalted = statuses.has("HALTED");
        const anyRedemption = statuses.has("REDEMPTION_ONLY");
        const allDraft = assets.every((a) => a.status === "DRAFT");
        const allClosed = assets.every((a) => a.status === "CLOSED");

        let statusLabel = "Draft";
        let detail =
          "Assets remain DRAFT until a Corporate admin activates them after migration and staging checks. No activate controls on this System page.";
        if (openCritical > 0) {
          statusLabel = "Critical issue";
          detail = `${openCritical} unresolved critical reconciliation issue(s). Review Crypto markets before activation or trading.`;
        } else if (anyHalted && !anyActive && !anyRedemption) {
          statusLabel = "Halted";
          detail = "One or more assets are halted. New trades are blocked until Corporate admin resume.";
        } else if (anyRedemption && !anyActive) {
          statusLabel = "Redemption only";
          detail = "Buys are blocked; legitimate sells/redemptions may still execute.";
        } else if (anyHalted || (anyRedemption && anyActive)) {
          statusLabel = "Degraded";
          detail =
            "Mixed asset lifecycle states — some markets may be halted or redemption-only. TSE status is separate.";
        } else if (anyActive) {
          statusLabel = "Active";
          detail =
            "One or more crypto assets are ACTIVE on Alta Crypto (separate from TSE). Manage from Crypto markets.";
        } else if (allDraft) {
          // Do not run full evaluateActivationReadiness here — it is multi-second per
          // asset and times out Vercel on Terminal System. Point operators to Crypto markets.
          statusLabel = "Draft";
          detail =
            "Crypto assets remain DRAFT. Open Crypto markets for readiness details and activation.";
        } else if (allClosed) {
          statusLabel = "Not configured";
          detail = "All crypto assets are CLOSED.";
        }

        cryptoMarkets = {
          available: anyActive,
          statusLabel,
          detail,
          assetStatuses: assets.map((a) => ({ symbol: a.symbol, status: a.status })),
        };
      }
    }
  } catch {
    // Keep default Not configured when crypto tables are unavailable.
  }

  let cryptoReconciliation: TerminalOpsSystemStatus["cryptoReconciliation"] = {
    available: false,
    statusLabel: "Not configured",
    detail: "Crypto reconciliation tables are not available yet.",
    lastSuccessfulAt: null,
    openCritical: 0,
    openWarning: 0,
  };
  try {
    const { isDatabaseConfigured, prisma } = await import("@/server/db");
    if (isDatabaseConfigured()) {
      const [lastSuccess, openCritical, openWarning, lastRun] = await Promise.all([
        prisma.terminalCryptoReconciliationRun.findFirst({
          where: { status: "SUCCEEDED" },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        }),
        prisma.terminalCryptoReconciliationIssue.count({
          where: { status: "OPEN", severity: "CRITICAL" },
        }),
        prisma.terminalCryptoReconciliationIssue.count({
          where: { status: "OPEN", severity: "WARNING" },
        }),
        prisma.terminalCryptoReconciliationRun.findFirst({
          where: { status: { in: ["SUCCEEDED", "PARTIAL", "FAILED"] } },
          orderBy: { completedAt: "desc" },
          select: { status: true, summary: true, completedAt: true },
        }),
      ]);
      cryptoReconciliation = {
        available: true,
        statusLabel:
          openCritical > 0
            ? "Critical issues open"
            : openWarning > 0
              ? "Warnings open"
              : lastSuccess
                ? "Healthy"
                : "Never succeeded",
        detail: lastRun?.summary
          ? lastRun.summary
          : "No reconciliation runs recorded yet. Run from Crypto markets.",
        lastSuccessfulAt: lastSuccess?.completedAt?.toISOString() ?? null,
        openCritical,
        openWarning,
      };
    }
  } catch {
    // Keep default when crypto recon tables missing.
  }

  const quoteSecretConfigured = Boolean(
    process.env.TERMINAL_CRYPTO_QUOTE_SECRET &&
      process.env.TERMINAL_CRYPTO_QUOTE_SECRET.trim().length >= 32,
  );
  const revenuePortfolioConfigured = Boolean(
    process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID?.trim(),
  );

  return {
    environment,
    localDatabase: {
      available: localDatabaseAvailable,
      detail: localDatabaseDetail,
    },
    marketData: {
      available: false,
      detail: "Market data is unavailable until the Newport TSE adapter is wired.",
    },
    orderExecution: {
      available: false,
      detail: "Stock order submission and cancellation require a live TSE adapter.",
    },
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
    cryptoReconciliation,
    candleRollup: {
      available: true,
      detail:
        "Candle rollup job is registered. Aggregates real crypto settlements only — never invents volatility.",
    },
    revenueSweep: {
      available: revenuePortfolioConfigured,
      detail: revenuePortfolioConfigured
        ? "Revenue sweep destination portfolio is configured (Corporate admin)."
        : "Set TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID to enable revenue sweeps.",
    },
    configurationSecrets: {
      quoteSecretConfigured,
      revenuePortfolioConfigured,
      detail: quoteSecretConfigured
        ? "Quote secret is configured (value never displayed). Revenue portfolio " +
          (revenuePortfolioConfigured ? "configured." : "not configured.")
        : "TERMINAL_CRYPTO_QUOTE_SECRET missing or too short — crypto trading fails closed.",
    },
    backupReadiness: {
      available: false,
      detail:
        "No automated backup freshness probe is wired in-app. Operators must verify PostgreSQL logical backups covering Terminal + crypto tables before migrations (see docs/terminal-crypto-disaster-recovery.md).",
    },
    jobs: {
      available: true,
      detail:
        "Crypto reconciliation and candle-rollup jobs are registered in the ops catalog. Manual runs require Terminal admin; UI Lab blocks mutations. Terminal site has no embedded jobs table — use Corporate jobs if authorized.",
    },
    audit: {
      available: true,
      detail:
        "Crypto lifecycle, fee config, sweep, contribution, and recon-issue actions write audit logs. Terminal-scoped audit browser aggregation remains limited — review asset Activity and platform audit where available.",
    },
    recurringTrades: {
      available: true,
      detail:
        "Scheduled/recurring Terminal stock trades are implemented. Crypto schedules use ALTA_CRYPTO execution with automated price-impact skip.",
    },
    cryptoMarkets,
    newportLiveMarket: {
      available: false,
      detail:
        "Newport / live stock market integration is not implemented. Alta Crypto (fictional florin markets) operates independently and must not be reported as TSE-healthy.",
    },
  };
}
