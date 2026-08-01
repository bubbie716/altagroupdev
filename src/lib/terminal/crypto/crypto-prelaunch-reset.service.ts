/**
 * Guarded prelaunch reset for Alta Terminal fictional crypto markets (NPFC / NVA / VLT).
 *
 * Clears crypto-derived trade/ledger/candle/ops residue and restores launch market state
 * from CRYPTO_ASSET_CONFIGS. Refuses production. Never touches stock orders, bank accounts,
 * users, portfolios, or legal consent.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CRYPTO_ASSET_CONFIGS,
  LAUNCH_ASSET_SYMBOLS,
  curveRateSeedString,
  type CryptoAssetSymbol,
} from "./crypto-constants";

export const CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV = "CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET";
export const CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE = "YES";

/** Go-live activation rows from migration 20260731210000 — preserve when clearing status history. */
const GO_LIVE_STATUS_CHANGE_IDS = [
  "tcas_npfc_go_live",
  "tcas_nva_go_live",
  "tcas_vlt_go_live",
] as const;

const GO_LIVE_IDEMPOTENCY_KEYS = [
  "go_live_activate_npfc",
  "go_live_activate_nva",
  "go_live_activate_vlt",
] as const;

const GO_LIVE_ACTOR_USER_ID = "system-crypto-go-live";

export type CryptoPrelaunchResetEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  ALTA_ENV?: string;
  CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET?: string;
};

export type CryptoPrelaunchResetPlanAsset = {
  symbol: CryptoAssetSymbol;
  assetId: string;
  status: string;
  walletLedgerEntries: number;
  marketLedgerEntries: number;
  settlements: number;
  orders: number;
  priceCandles: number;
  reconciliationIssues: number;
  walletBalances: number;
  revenueSweeps: number;
  externalContributions: number;
  statusChangesToDelete: number;
  statusChangesPreserved: number;
  launchTreasury: string;
  launchMarginalPrice: string;
};

export type CryptoPrelaunchResetPlan = {
  symbols: readonly CryptoAssetSymbol[];
  assets: CryptoPrelaunchResetPlanAsset[];
  orderIds: string[];
  settlementIds: string[];
  reconciliationRunIdsToDelete: string[];
  totals: {
    walletLedgerEntries: number;
    marketLedgerEntries: number;
    settlements: number;
    orderFills: number;
    portfolioActivities: number;
    cashLedgerEntries: number;
    orders: number;
    priceCandles: number;
    reconciliationIssues: number;
    reconciliationRuns: number;
    walletBalances: number;
    revenueSweeps: number;
    externalContributions: number;
    statusChangesToDelete: number;
  };
};

export type ResetTerminalCryptoPrelaunchOptions = {
  /** When false (default), only compute the plan — no mutations. */
  apply?: boolean;
  env?: CryptoPrelaunchResetEnv;
};

export type CryptoPrelaunchResetResult = {
  applied: boolean;
  plan: CryptoPrelaunchResetPlan;
};

export class CryptoPrelaunchResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoPrelaunchResetError";
  }
}

type ResetDb = PrismaClient | Prisma.TransactionClient;

function envFlag(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isCryptoPrelaunchResetProductionEnv(env: CryptoPrelaunchResetEnv): boolean {
  return (
    envFlag(env.NODE_ENV) === "production" ||
    envFlag(env.VERCEL_ENV) === "production" ||
    envFlag(env.ALTA_ENV) === "production"
  );
}

/**
 * Hard gate for destructive prelaunch reset.
 * Refuses NODE_ENV / VERCEL_ENV / ALTA_ENV = production.
 * Requires CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET === "YES" (exact).
 */
export function assertCryptoPrelaunchResetAllowed(env: CryptoPrelaunchResetEnv): void {
  if (isCryptoPrelaunchResetProductionEnv(env)) {
    throw new CryptoPrelaunchResetError(
      "Refusing terminal crypto prelaunch reset: production environment " +
        "(NODE_ENV, VERCEL_ENV, or ALTA_ENV is production).",
    );
  }
  if (env.CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET !== CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE) {
    throw new CryptoPrelaunchResetError(
      `Refusing terminal crypto prelaunch reset: set ${CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV}=${CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE} to confirm.`,
    );
  }
}

function launchTreasuryInventory(symbol: CryptoAssetSymbol): string {
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  if (cfg.maxSupply == null) return "0";
  return cfg.maxSupply.toFixed(8);
}

function goLiveStatusChangePreserveWhere(assetIds: string[]): Prisma.TerminalCryptoAssetStatusChangeWhereInput {
  return {
    assetId: { in: assetIds },
    OR: [
      { id: { in: [...GO_LIVE_STATUS_CHANGE_IDS] } },
      { idempotencyKey: { in: [...GO_LIVE_IDEMPOTENCY_KEYS] } },
      { actorUserId: GO_LIVE_ACTOR_USER_ID },
    ],
  };
}

function statusChangeDeleteWhere(assetIds: string[]): Prisma.TerminalCryptoAssetStatusChangeWhereInput {
  return {
    assetId: { in: assetIds },
    NOT: {
      OR: [
        { id: { in: [...GO_LIVE_STATUS_CHANGE_IDS] } },
        { idempotencyKey: { in: [...GO_LIVE_IDEMPOTENCY_KEYS] } },
        { actorUserId: GO_LIVE_ACTOR_USER_ID },
      ],
    },
  };
}

async function loadLaunchAssets(db: ResetDb) {
  const assets = await db.terminalCryptoAsset.findMany({
    where: { symbol: { in: [...LAUNCH_ASSET_SYMBOLS] } },
    select: { id: true, symbol: true, status: true },
  });
  const bySymbol = new Map(assets.map((a) => [a.symbol, a]));
  const missing = LAUNCH_ASSET_SYMBOLS.filter((s) => !bySymbol.has(s));
  if (missing.length > 0) {
    throw new CryptoPrelaunchResetError(
      `Missing launch crypto assets for reset: ${missing.join(", ")}. Seed assets first.`,
    );
  }
  return LAUNCH_ASSET_SYMBOLS.map((symbol) => {
    const row = bySymbol.get(symbol)!;
    return { id: row.id, symbol: symbol as CryptoAssetSymbol, status: row.status };
  });
}

/**
 * Inspect (and optionally apply) a prelaunch reset for NPFC / NVA / VLT only.
 */
export async function planTerminalCryptoPrelaunchReset(db: ResetDb): Promise<CryptoPrelaunchResetPlan> {
  const assets = await loadLaunchAssets(db);
  const assetIds = assets.map((a) => a.id);
  const symbols = assets.map((a) => a.symbol);

  const settlements = await db.terminalCryptoOrderSettlement.findMany({
    where: { assetId: { in: assetIds } },
    select: { id: true, orderId: true, assetId: true },
  });
  const settlementIds = settlements.map((s) => s.id);
  const settlementOrderIds = settlements.map((s) => s.orderId);

  const venueOrders = await db.terminalOrder.findMany({
    where: {
      executionVenue: "ALTA_CRYPTO",
      symbol: { in: [...LAUNCH_ASSET_SYMBOLS] },
    },
    select: { id: true, symbol: true },
  });
  const orderIdSet = new Set<string>([...settlementOrderIds, ...venueOrders.map((o) => o.id)]);
  const orderIds = [...orderIdSet];

  const [
    walletLedgerByAsset,
    marketLedgerByAsset,
    candlesByAsset,
    issuesByAsset,
    balancesByAsset,
    sweepsByAsset,
    contributionsByAsset,
    statusDeleteByAsset,
    statusPreserveByAsset,
    orderFillCount,
    activityCount,
    cashLedgerCount,
  ] = await Promise.all([
    db.terminalCryptoWalletLedgerEntry.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoMarketLedgerEntry.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoPriceCandle.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoReconciliationIssue.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoWalletBalance.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoRevenueSweep.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoExternalContribution.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds } },
      _count: { _all: true },
    }),
    db.terminalCryptoAssetStatusChange.groupBy({
      by: ["assetId"],
      where: statusChangeDeleteWhere(assetIds),
      _count: { _all: true },
    }),
    db.terminalCryptoAssetStatusChange.groupBy({
      by: ["assetId"],
      where: goLiveStatusChangePreserveWhere(assetIds),
      _count: { _all: true },
    }),
    orderIds.length
      ? db.terminalOrderFill.count({ where: { orderId: { in: orderIds } } })
      : Promise.resolve(0),
    orderIds.length
      ? db.terminalPortfolioActivity.count({ where: { orderId: { in: orderIds } } })
      : Promise.resolve(0),
    orderIds.length
      ? db.terminalCashLedgerEntry.count({ where: { relatedOrderId: { in: orderIds } } })
      : Promise.resolve(0),
  ]);

  const countMap = (rows: Array<{ assetId: string | null; _count: { _all: number } }>) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.assetId) map.set(row.assetId, row._count._all);
    }
    return map;
  };

  const walletLedgerMap = countMap(walletLedgerByAsset);
  const marketLedgerMap = countMap(marketLedgerByAsset);
  const candleMap = countMap(candlesByAsset);
  const issueMap = countMap(issuesByAsset);
  const balanceMap = countMap(balancesByAsset);
  const sweepMap = countMap(sweepsByAsset);
  const contributionMap = countMap(contributionsByAsset);
  const statusDeleteMap = countMap(statusDeleteByAsset);
  const statusPreserveMap = countMap(statusPreserveByAsset);

  const settlementsByAsset = new Map<string, number>();
  for (const s of settlements) {
    settlementsByAsset.set(s.assetId, (settlementsByAsset.get(s.assetId) ?? 0) + 1);
  }
  const orderIdsBySymbol = new Map<string, Set<string>>();
  for (const symbol of LAUNCH_ASSET_SYMBOLS) {
    orderIdsBySymbol.set(symbol, new Set());
  }
  for (const o of venueOrders) {
    orderIdsBySymbol.get(o.symbol)?.add(o.id);
  }
  const assetIdToSymbol = new Map(assets.map((a) => [a.id, a.symbol]));
  for (const s of settlements) {
    const symbol = assetIdToSymbol.get(s.assetId);
    if (symbol) orderIdsBySymbol.get(symbol)?.add(s.orderId);
  }

  const issues = await db.terminalCryptoReconciliationIssue.findMany({
    where: { assetId: { in: assetIds } },
    select: { runId: true },
  });
  const candidateRunIds = [...new Set(issues.map((i) => i.runId))];
  const reconciliationRunIdsToDelete: string[] = [];
  if (candidateRunIds.length > 0) {
    const runs = await db.terminalCryptoReconciliationRun.findMany({
      where: { id: { in: candidateRunIds } },
      select: {
        id: true,
        issues: { select: { assetId: true } },
      },
    });
    for (const run of runs) {
      const safe = run.issues.every(
        (issue) => issue.assetId == null || assetIds.includes(issue.assetId),
      );
      if (safe) reconciliationRunIdsToDelete.push(run.id);
    }
  }

  const planAssets: CryptoPrelaunchResetPlanAsset[] = assets.map((asset) => {
    const cfg = CRYPTO_ASSET_CONFIGS[asset.symbol];
    return {
      symbol: asset.symbol,
      assetId: asset.id,
      status: asset.status,
      walletLedgerEntries: walletLedgerMap.get(asset.id) ?? 0,
      marketLedgerEntries: marketLedgerMap.get(asset.id) ?? 0,
      settlements: settlementsByAsset.get(asset.id) ?? 0,
      orders: orderIdsBySymbol.get(asset.symbol)?.size ?? 0,
      priceCandles: candleMap.get(asset.id) ?? 0,
      reconciliationIssues: issueMap.get(asset.id) ?? 0,
      walletBalances: balanceMap.get(asset.id) ?? 0,
      revenueSweeps: sweepMap.get(asset.id) ?? 0,
      externalContributions: contributionMap.get(asset.id) ?? 0,
      statusChangesToDelete: statusDeleteMap.get(asset.id) ?? 0,
      statusChangesPreserved: statusPreserveMap.get(asset.id) ?? 0,
      launchTreasury: launchTreasuryInventory(asset.symbol),
      launchMarginalPrice: cfg.pegOrStartingPrice.toFixed(12),
    };
  });

  const sum = (pick: (a: CryptoPrelaunchResetPlanAsset) => number) =>
    planAssets.reduce((n, a) => n + pick(a), 0);

  return {
    symbols,
    assets: planAssets,
    orderIds,
    settlementIds,
    reconciliationRunIdsToDelete,
    totals: {
      walletLedgerEntries: sum((a) => a.walletLedgerEntries),
      marketLedgerEntries: sum((a) => a.marketLedgerEntries),
      settlements: sum((a) => a.settlements),
      orderFills: orderFillCount,
      portfolioActivities: activityCount,
      cashLedgerEntries: cashLedgerCount,
      orders: orderIds.length,
      priceCandles: sum((a) => a.priceCandles),
      reconciliationIssues: sum((a) => a.reconciliationIssues),
      reconciliationRuns: reconciliationRunIdsToDelete.length,
      walletBalances: sum((a) => a.walletBalances),
      revenueSweeps: sum((a) => a.revenueSweeps),
      externalContributions: sum((a) => a.externalContributions),
      statusChangesToDelete: sum((a) => a.statusChangesToDelete),
    },
  };
}

async function applyTerminalCryptoPrelaunchReset(db: ResetDb, plan: CryptoPrelaunchResetPlan): Promise<void> {
  const assetIds = plan.assets.map((a) => a.assetId);
  const { orderIds, reconciliationRunIdsToDelete } = plan;

  // 1) Crypto ledgers tied to these assets (before settlements / balances).
  await db.terminalCryptoWalletLedgerEntry.deleteMany({ where: { assetId: { in: assetIds } } });
  await db.terminalCryptoMarketLedgerEntry.deleteMany({ where: { assetId: { in: assetIds } } });

  // 2) Settlements + related shared TerminalOrder residue (ALTA_CRYPTO / these symbols only).
  if (orderIds.length > 0) {
    await db.terminalCryptoOrderSettlement.deleteMany({
      where: { OR: [{ assetId: { in: assetIds } }, { orderId: { in: orderIds } }] },
    });
    await db.terminalOrderFill.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.terminalPortfolioActivity.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.terminalCashLedgerEntry.deleteMany({
      where: { relatedOrderId: { in: orderIds } },
    });
    await db.terminalOrder.deleteMany({ where: { id: { in: orderIds } } });
  } else {
    await db.terminalCryptoOrderSettlement.deleteMany({ where: { assetId: { in: assetIds } } });
  }

  // 3) Market history / ops residue for these assets.
  await db.terminalCryptoPriceCandle.deleteMany({ where: { assetId: { in: assetIds } } });
  await db.terminalCryptoReconciliationIssue.deleteMany({ where: { assetId: { in: assetIds } } });
  if (reconciliationRunIdsToDelete.length > 0) {
    await db.terminalCryptoReconciliationRun.deleteMany({
      where: { id: { in: reconciliationRunIdsToDelete } },
    });
  }
  await db.terminalCryptoRevenueSweep.deleteMany({ where: { assetId: { in: assetIds } } });
  await db.terminalCryptoExternalContribution.deleteMany({ where: { assetId: { in: assetIds } } });
  await db.terminalCryptoAssetStatusChange.deleteMany({
    where: statusChangeDeleteWhere(assetIds),
  });

  // 4) Clear balances; preserve TerminalCryptoWallet identity rows.
  await db.terminalCryptoWalletBalance.deleteMany({ where: { assetId: { in: assetIds } } });

  // 5) Restore asset config + launch market state from authoritative CRYPTO_ASSET_CONFIGS.
  for (const row of plan.assets) {
    const cfg = CRYPTO_ASSET_CONFIGS[row.symbol];
    await db.terminalCryptoAsset.update({
      where: { id: row.assetId },
      data: {
        displayName: cfg.displayName,
        kind: cfg.kind,
        status: "ACTIVE",
        maxSupply: cfg.maxSupply,
        pegOrStartingPrice: cfg.pegOrStartingPrice,
        curveRate: cfg.curveRate ? curveRateSeedString(cfg.curveRate) : null,
        quantityPrecision: cfg.quantityPrecision,
        displayPrecision: cfg.displayPrecision,
        totalFeeBps: cfg.totalFeeBps,
        revenueFeeBps: cfg.revenueFeeBps,
        stabilizationFeeBps: cfg.stabilizationFeeBps,
        version: 0,
      },
    });
    await db.terminalCryptoMarketState.update({
      where: { assetId: row.assetId },
      data: {
        treasuryInventory: launchTreasuryInventory(row.symbol),
        circulatingSupply: 0,
        protectedReserve: 0,
        stabilizationFund: 0,
        accruedRevenue: 0,
        currentMarginalPrice: cfg.pegOrStartingPrice,
        version: 0,
      },
    });
  }
}

/**
 * Plan or apply a guarded prelaunch reset for NPFC / NVA / VLT.
 * When `apply` is true, requires assertCryptoPrelaunchResetAllowed(env).
 */
export async function resetTerminalCryptoPrelaunchMarket(
  prisma: PrismaClient,
  options: ResetTerminalCryptoPrelaunchOptions = {},
): Promise<CryptoPrelaunchResetResult> {
  const apply = options.apply === true;
  const env = options.env ?? process.env;

  if (apply) {
    assertCryptoPrelaunchResetAllowed(env);
  } else if (isCryptoPrelaunchResetProductionEnv(env)) {
    throw new CryptoPrelaunchResetError(
      "Refusing terminal crypto prelaunch reset plan: production environment " +
        "(NODE_ENV, VERCEL_ENV, or ALTA_ENV is production).",
    );
  }

  const plan = await planTerminalCryptoPrelaunchReset(prisma);
  if (!apply) {
    return { applied: false, plan };
  }

  await prisma.$transaction(async (tx) => {
    await applyTerminalCryptoPrelaunchReset(tx, plan);
  });

  return { applied: true, plan };
}
