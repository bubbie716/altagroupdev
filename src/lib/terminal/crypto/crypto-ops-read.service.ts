/**
 * Customer-safe internal crypto ops summaries for overview desk + asset workspace.
 * No secrets. No raw customer PII in summaries.
 */

import { prisma } from "@/server/db";
import { LAUNCH_ASSET_SYMBOLS } from "./crypto-constants";
import { d, serializeCryptoMoney, serializeCryptoPrice, serializeCryptoQuantity } from "./crypto-decimal";
import { reserveLiability } from "./crypto-curve-math";
import { resolveRevenueSweepDestinationPortfolioId } from "./crypto-revenue-sweep.service";
import { tradingCapabilitiesForStatus } from "./crypto-market-read.service";

export type CryptoOpsAssetOverview = {
  symbol: string;
  displayName: string;
  kind: "STABLE" | "BONDING_CURVE";
  status: string;
  version: number;
  marketStateVersion: number;
  currentPrice: string;
  circulatingSupply: string;
  treasuryInventory: string;
  protectedReserve: string;
  requiredLiability: string;
  reserveCoverageAmount: string;
  reserveCoveragePercent: string | null;
  stabilizationFund: string;
  accruedRevenue: string;
  walletCount: number;
  lastTradeAt: string | null;
  openCriticalIssues: number;
  openWarningIssues: number;
  lastReconciliationAt: string | null;
  lastReconciliationStatus: string | null;
  tradingCapabilities: { canBuy: boolean; canSell: boolean };
  revenueSweepConfigured: boolean;
  activationReadinessAllPassed: boolean | null;
};

export type CryptoOpsDeskSummary = {
  assets: CryptoOpsAssetOverview[];
  needsAttention: Array<{
    kind: string;
    symbol?: string;
    summary: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    href?: string;
  }>;
  lastSuccessfulReconciliationAt: string | null;
  openCriticalIssueCount: number;
  revenueSweepConfigured: boolean;
  recentActivity: CryptoOpsActivityEvent[];
  integrity: {
    openCriticalIssueCount: number;
    openWarningIssueCount: number;
    lastReconciliationAt: string | null;
    lastReconciliationStatus: string | null;
    lastReconciliationSummary: string | null;
  };
  jobsReadiness: Array<{
    id: string;
    label: string;
    status: "ready" | "attention" | "not_configured";
    detail: string;
  }>;
};

export type CryptoOpsActivityEvent = {
  id: string;
  kind: "status" | "reconciliation" | "settlement" | "sweep" | "contribution" | "operator";
  title: string;
  detail: string;
  createdAt: string;
  symbol?: string;
};

export type CryptoOpsAssetWorkspace = CryptoOpsAssetOverview & {
  assetId: string;
  maxSupply: string | null;
  pegOrStartingPrice: string;
  curveRate: string | null;
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
  quantityPrecision: number;
  displayPrecision: number;
  openIssues: Array<{
    id: string;
    checkKey: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    summary: string;
    createdAt: string;
  }>;
  activity: CryptoOpsActivityEvent[];
  recentSettlements: Array<{
    id: string;
    orderId: string;
    executedAt: string;
    executedQuantity: string;
    averageExecutionPrice: string;
    grossValue: string;
    totalFee: string;
  }>;
  recentLedger: Array<{
    id: string;
    kind: string;
    account: string;
    delta: string;
    balanceAfter: string;
    createdAt: string;
  }>;
  volumeFlorins: string;
  candleCount: number;
};

function coveragePercent(reserve: ReturnType<typeof d>, liability: ReturnType<typeof d>): string | null {
  if (liability.equals(0)) return reserve.greaterThanOrEqualTo(0) ? "100.00" : null;
  return reserve.mul(100).div(liability).toDecimalPlaces(2).toFixed(2);
}

export async function getCryptoOpsAssetOverview(
  symbolInput: string,
): Promise<CryptoOpsAssetOverview | null> {
  const symbol = symbolInput.trim().toUpperCase();
  const asset = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol },
    include: { marketState: true },
  });
  if (!asset?.marketState) return null;

  const circulating = d(asset.marketState.circulatingSupply.toString());
  const reserve = d(asset.marketState.protectedReserve.toString());
  let liability = circulating;
  if (asset.kind === "BONDING_CURVE" && asset.curveRate) {
    liability = reserveLiability({
      startingPrice: asset.pegOrStartingPrice,
      curveRate: asset.curveRate,
      circulatingSupply: circulating,
    });
  }

  const [
    walletCount,
    lastSettlement,
    openCriticalIssues,
    openWarningIssues,
    lastRun,
  ] = await Promise.all([
    prisma.terminalCryptoWalletBalance.count({
      where: {
        assetId: asset.id,
        OR: [{ availableQuantity: { gt: 0 } }, { reservedQuantity: { gt: 0 } }],
      },
    }),
    prisma.terminalCryptoOrderSettlement.findFirst({
      where: { assetId: asset.id },
      orderBy: { executedAt: "desc" },
      select: { executedAt: true },
    }),
    prisma.terminalCryptoReconciliationIssue.count({
      where: { assetId: asset.id, status: "OPEN", severity: "CRITICAL" },
    }),
    prisma.terminalCryptoReconciliationIssue.count({
      where: { assetId: asset.id, status: "OPEN", severity: "WARNING" },
    }),
    prisma.terminalCryptoReconciliationRun.findFirst({
      where: { status: { in: ["SUCCEEDED", "PARTIAL", "FAILED"] } },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  // Desk/list paths must stay fast — full readiness is loaded on the asset page only.
  // Calling evaluateActivationReadiness here for every DRAFT asset sequentializes ~3s of
  // DB work per market and times out Vercel serverless on /internal/terminal/crypto.
  const activationReadinessAllPassed: boolean | null = null;

  const coverageAmt = reserve.minus(liability);
  return {
    symbol: asset.symbol,
    displayName: asset.displayName,
    kind: asset.kind,
    status: asset.status,
    version: asset.version,
    marketStateVersion: asset.marketState.version,
    currentPrice: serializeCryptoPrice(asset.marketState.currentMarginalPrice),
    circulatingSupply: serializeCryptoQuantity(circulating),
    treasuryInventory: serializeCryptoQuantity(asset.marketState.treasuryInventory),
    protectedReserve: serializeCryptoMoney(reserve),
    requiredLiability: serializeCryptoMoney(liability),
    reserveCoverageAmount: serializeCryptoMoney(coverageAmt),
    reserveCoveragePercent: coveragePercent(reserve, liability),
    stabilizationFund: serializeCryptoMoney(asset.marketState.stabilizationFund),
    accruedRevenue: serializeCryptoMoney(asset.marketState.accruedRevenue),
    walletCount,
    lastTradeAt: lastSettlement?.executedAt.toISOString() ?? null,
    openCriticalIssues,
    openWarningIssues,
    lastReconciliationAt: lastRun?.completedAt?.toISOString() ?? null,
    lastReconciliationStatus: lastRun?.status ?? null,
    tradingCapabilities: tradingCapabilitiesForStatus(asset.status),
    revenueSweepConfigured: Boolean(resolveRevenueSweepDestinationPortfolioId()),
    activationReadinessAllPassed,
  };
}

export async function getCryptoOpsDeskSummary(): Promise<CryptoOpsDeskSummary> {
  const overviews = await Promise.all(
    LAUNCH_ASSET_SYMBOLS.map((symbol) => getCryptoOpsAssetOverview(symbol)),
  );
  const assets: CryptoOpsAssetOverview[] = overviews.filter(
    (row): row is CryptoOpsAssetOverview => row != null,
  );

  const openCritical = await prisma.terminalCryptoReconciliationIssue.findMany({
    where: { status: "OPEN", severity: "CRITICAL" },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { asset: { select: { symbol: true } } },
  });

  const needsAttention: CryptoOpsDeskSummary["needsAttention"] = openCritical.map((issue) => ({
    kind: "reconciliation_issue",
    symbol: issue.asset?.symbol,
    summary: issue.summary,
    severity: "CRITICAL" as const,
    href: issue.asset?.symbol
      ? `/internal/terminal/crypto/${issue.asset.symbol}`
      : "/internal/terminal/crypto",
  }));

  for (const a of assets) {
    if (a.status === "HALTED") {
      needsAttention.push({
        kind: "status",
        symbol: a.symbol,
        summary: `${a.symbol} trading is halted.`,
        severity: "WARNING",
        href: `/internal/terminal/crypto/${a.symbol}`,
      });
    }
    if (a.status === "REDEMPTION_ONLY") {
      needsAttention.push({
        kind: "status",
        symbol: a.symbol,
        summary: `${a.symbol} is redemption-only — purchases are blocked.`,
        severity: "WARNING",
        href: `/internal/terminal/crypto/${a.symbol}`,
      });
    }
    if (a.openCriticalIssues > 0 && !needsAttention.some((n) => n.symbol === a.symbol && n.kind === "reconciliation_issue")) {
      needsAttention.push({
        kind: "reconciliation_issue",
        symbol: a.symbol,
        summary: `${a.symbol} has unresolved critical reconciliation issues.`,
        severity: "CRITICAL",
        href: `/internal/terminal/crypto/${a.symbol}`,
      });
    }
    if (
      (a.status === "DRAFT" || a.status === "HALTED" || a.status === "REDEMPTION_ONLY") &&
      a.activationReadinessAllPassed === false
    ) {
      needsAttention.push({
        kind: "readiness",
        symbol: a.symbol,
        summary: `${a.symbol} is not ready to activate or resume.`,
        severity: "INFO",
        href: `/internal/terminal/crypto/${a.symbol}`,
      });
    }
  }

  const revenueConfigured = Boolean(resolveRevenueSweepDestinationPortfolioId());
  if (!revenueConfigured) {
    const hasRevenue = assets.some((a) => d(a.accruedRevenue).greaterThan(0));
    if (hasRevenue) {
      needsAttention.push({
        kind: "configuration",
        summary:
          "Accrued crypto revenue cannot be swept until TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID is configured.",
        severity: "WARNING",
        href: "/internal/terminal/crypto",
      });
    }
  }

  const lastSuccess = await prisma.terminalCryptoReconciliationRun.findFirst({
    where: { status: "SUCCEEDED" },
    orderBy: { completedAt: "desc" },
  });

  const lastRun = await prisma.terminalCryptoReconciliationRun.findFirst({
    where: { status: { in: ["SUCCEEDED", "PARTIAL", "FAILED"] } },
    orderBy: { completedAt: "desc" },
  });

  const openWarningIssueCount = await prisma.terminalCryptoReconciliationIssue.count({
    where: { status: "OPEN", severity: "WARNING" },
  });

  const recentActivity = await loadCryptoOpsRecentActivity(12);
  const failedSchedules = await countFailedCryptoSchedules();

  const jobsReadiness: CryptoOpsDeskSummary["jobsReadiness"] = [
    {
      id: "reconciliation",
      label: "Crypto reconciliation",
      status:
        openCritical.length > 0
          ? "attention"
          : lastSuccess
            ? "ready"
            : "not_configured",
      detail:
        openCritical.length > 0
          ? `${openCritical.length} unresolved critical issue${openCritical.length === 1 ? "" : "s"}`
          : lastSuccess?.completedAt
            ? `Last clean run ${lastSuccess.completedAt.toISOString().slice(0, 16).replace("T", " ")}`
            : "No successful reconciliation run recorded yet",
    },
    {
      id: "revenue-sweep",
      label: "Revenue sweep destination",
      status: revenueConfigured ? "ready" : "not_configured",
      detail: revenueConfigured
        ? "Destination portfolio configured"
        : "Set TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID to enable sweeps",
    },
    {
      id: "schedules",
      label: "Scheduled crypto trades",
      status: failedSchedules > 0 ? "attention" : "ready",
      detail:
        failedSchedules > 0
          ? `${failedSchedules} schedule${failedSchedules === 1 ? "" : "s"} with recent failures`
          : "No failed crypto schedules flagged",
    },
  ];

  return {
    assets,
    needsAttention,
    lastSuccessfulReconciliationAt: lastSuccess?.completedAt?.toISOString() ?? null,
    openCriticalIssueCount: openCritical.length,
    revenueSweepConfigured: revenueConfigured,
    recentActivity,
    integrity: {
      openCriticalIssueCount: openCritical.length,
      openWarningIssueCount,
      lastReconciliationAt: lastRun?.completedAt?.toISOString() ?? null,
      lastReconciliationStatus: lastRun?.status ?? null,
      lastReconciliationSummary: lastRun?.summary || null,
    },
    jobsReadiness,
  };
}

async function countFailedCryptoSchedules(): Promise<number> {
  try {
    return await prisma.terminalScheduledTradeInstruction.count({
      where: {
        instrumentKind: "CRYPTO",
        OR: [{ consecutiveFailures: { gt: 0 } }, { status: "PAUSED" }],
      },
    });
  } catch {
    return 0;
  }
}

export async function loadCryptoOpsRecentActivity(limit = 20): Promise<CryptoOpsActivityEvent[]> {
  const events: CryptoOpsActivityEvent[] = [];
  const halfLimit = (limit + 1) >> 1;

  const [statusChanges, sweeps, contributions, settlements, runs] = await Promise.all([
    prisma.terminalCryptoAssetStatusChange.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { symbol: true } } },
    }),
    prisma.terminalCryptoRevenueSweep.findMany({
      take: halfLimit,
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { symbol: true } } },
    }),
    prisma.terminalCryptoExternalContribution.findMany({
      take: halfLimit,
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { symbol: true } } },
    }),
    prisma.terminalCryptoOrderSettlement.findMany({
      take: halfLimit,
      orderBy: { executedAt: "desc" },
      include: { asset: { select: { symbol: true } } },
    }),
    prisma.terminalCryptoReconciliationRun.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
    }),
  ]);

  for (const row of statusChanges) {
    events.push({
      id: `status-${row.id}`,
      kind: "status",
      symbol: row.asset.symbol,
      title: `${row.asset.symbol} status changed`,
      detail: `${plainOpsStatusLabel(row.fromStatus)} → ${plainOpsStatusLabel(row.toStatus)}. ${row.reason}`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of sweeps) {
    events.push({
      id: `sweep-${row.id}`,
      kind: "sweep",
      symbol: row.asset.symbol,
      title: `Revenue swept from ${row.asset.symbol}`,
      detail: `${serializeCryptoMoney(row.amount)} florins moved to corporate revenue portfolio.`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of contributions) {
    events.push({
      id: `contrib-${row.id}`,
      kind: "contribution",
      symbol: row.asset.symbol,
      title: contributionTitle(row.kind, row.asset.symbol),
      detail: `${serializeCryptoMoney(row.amount)} florins. ${row.reason}`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of settlements) {
    events.push({
      id: `settle-${row.id}`,
      kind: "settlement",
      symbol: row.asset.symbol,
      title: `${row.asset.symbol} trade settled`,
      detail: `${serializeCryptoQuantity(row.executedQuantity)} @ ${serializeCryptoPrice(row.averageExecutionPrice)}`,
      createdAt: row.executedAt.toISOString(),
    });
  }
  for (const row of runs) {
    events.push({
      id: `recon-${row.id}`,
      kind: "reconciliation",
      title: "Reconciliation run",
      detail: row.summary || `${row.status}: ${row.criticalCount} critical, ${row.warningCount} warning`,
      createdAt: (row.completedAt ?? row.startedAt).toISOString(),
    });
  }

  return events
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getCryptoOpsAssetWorkspace(
  symbolInput: string,
): Promise<CryptoOpsAssetWorkspace | null> {
  const overview = await getCryptoOpsAssetOverview(symbolInput);
  if (!overview) return null;

  const symbol = overview.symbol;
  const asset = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol },
    include: { marketState: true },
  });
  if (!asset?.marketState) return null;

  const [openIssues, statusChanges, sweeps, contributions, settlements, ledger, volumeAgg, candleCount] =
    await Promise.all([
      prisma.terminalCryptoReconciliationIssue.findMany({
        where: { assetId: asset.id, status: "OPEN" },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.terminalCryptoAssetStatusChange.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.terminalCryptoRevenueSweep.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.terminalCryptoExternalContribution.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.terminalCryptoOrderSettlement.findMany({
        where: { assetId: asset.id },
        orderBy: { executedAt: "desc" },
        take: 25,
      }),
      prisma.terminalCryptoMarketLedgerEntry.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.terminalCryptoOrderSettlement.aggregate({
        where: { assetId: asset.id },
        _sum: { grossValue: true },
      }),
      prisma.terminalCryptoPriceCandle.count({ where: { assetId: asset.id } }),
    ]);

  const activity: CryptoOpsActivityEvent[] = [];
  for (const row of statusChanges) {
    activity.push({
      id: `status-${row.id}`,
      kind: "status",
      symbol,
      title: "Status changed",
      detail: `${plainOpsStatusLabel(row.fromStatus)} → ${plainOpsStatusLabel(row.toStatus)}. ${row.reason}`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of openIssues) {
    activity.push({
      id: `issue-${row.id}`,
      kind: "reconciliation",
      symbol,
      title: `${row.severity === "CRITICAL" ? "Critical" : row.severity === "WARNING" ? "Warning" : "Info"} recon issue`,
      detail: row.summary,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of sweeps) {
    activity.push({
      id: `sweep-${row.id}`,
      kind: "sweep",
      symbol,
      title: "Revenue swept",
      detail: `${serializeCryptoMoney(row.amount)} florins. ${row.reason}`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of contributions) {
    activity.push({
      id: `contrib-${row.id}`,
      kind: "contribution",
      symbol,
      title: contributionTitle(row.kind, symbol),
      detail: `${serializeCryptoMoney(row.amount)} florins. ${row.reason}`,
      createdAt: row.createdAt.toISOString(),
    });
  }
  for (const row of settlements) {
    activity.push({
      id: `settle-${row.id}`,
      kind: "settlement",
      symbol,
      title: "Trade settled",
      detail: `${serializeCryptoQuantity(row.executedQuantity)} @ ${serializeCryptoPrice(row.averageExecutionPrice)}`,
      createdAt: row.executedAt.toISOString(),
    });
  }
  activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    ...overview,
    assetId: asset.id,
    maxSupply: asset.maxSupply ? serializeCryptoQuantity(asset.maxSupply) : null,
    pegOrStartingPrice: serializeCryptoPrice(asset.pegOrStartingPrice),
    curveRate: asset.curveRate?.toString() ?? null,
    totalFeeBps: asset.totalFeeBps,
    revenueFeeBps: asset.revenueFeeBps,
    stabilizationFeeBps: asset.stabilizationFeeBps,
    quantityPrecision: asset.quantityPrecision,
    displayPrecision: asset.displayPrecision,
    openIssues: openIssues.map((issue) => ({
      id: issue.id,
      checkKey: issue.checkKey,
      severity: issue.severity,
      summary: issue.summary,
      createdAt: issue.createdAt.toISOString(),
    })),
    activity: activity.slice(0, 80),
    recentSettlements: settlements.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      executedAt: row.executedAt.toISOString(),
      executedQuantity: serializeCryptoQuantity(row.executedQuantity),
      averageExecutionPrice: serializeCryptoPrice(row.averageExecutionPrice),
      grossValue: serializeCryptoMoney(row.grossValue),
      totalFee: serializeCryptoMoney(row.totalFee),
    })),
    recentLedger: ledger.map((row) => ({
      id: row.id,
      kind: row.kind,
      account: row.account,
      delta: serializeCryptoMoney(row.delta),
      balanceAfter: serializeCryptoMoney(row.balanceAfter),
      createdAt: row.createdAt.toISOString(),
    })),
    volumeFlorins: serializeCryptoMoney(volumeAgg._sum.grossValue ?? "0"),
    candleCount,
  };
}

export function plainOpsStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "HALTED":
      return "Trading halted";
    case "REDEMPTION_ONLY":
      return "Redemption only";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

function contributionTitle(kind: string, symbol: string): string {
  switch (kind) {
    case "PROTECTED_RESERVE":
      return `Protected reserve contribution · ${symbol}`;
    case "STABILIZATION_FUND":
      return `Stabilization contribution · ${symbol}`;
    case "REVENUE_TO_STABILIZATION":
      return `Revenue moved to stabilization · ${symbol}`;
    default:
      return `Contribution · ${symbol}`;
  }
}
