/**
 * UI Lab ONLY — demonstration crypto operations desk fixtures.
 * Read-only. Never writes PostgreSQL. Mutations remain blocked by assertNotUiLabMutation.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { CRYPTO_ASSET_CONFIGS, LAUNCH_ASSET_SYMBOLS } from "@/lib/terminal/crypto/crypto-constants";
import type {
  CryptoOpsActivityEvent,
  CryptoOpsAssetOverview,
  CryptoOpsAssetWorkspace,
  CryptoOpsDeskSummary,
} from "@/lib/terminal/crypto/crypto-ops-read.service";

export type UiLabCryptoOpsScenario =
  | "ready_to_activate"
  | "active_healthy"
  | "halted"
  | "redemption_only"
  | "undercollateralized"
  | "supply_mismatch"
  | "wallet_ledger_mismatch"
  | "revenue_missing_destination"
  | "recon_success"
  | "recon_failed";

const DEMONSTRATION = "Demonstration data";

function assertUiLab() {
  if (!isUiLabMode()) {
    throw new Error("UI Lab crypto ops fixtures require UI Lab mode");
  }
}

function baseAsset(
  symbol: "NPFC" | "NVA" | "VLT",
  status: string,
  extras?: Partial<CryptoOpsAssetOverview>,
): CryptoOpsAssetOverview {
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  return {
    symbol,
    displayName: cfg.displayName,
    kind: cfg.kind,
    status,
    version: 0,
    marketStateVersion: 1,
    currentPrice: symbol === "NPFC" ? "1.000000000000" : symbol === "NVA" ? "5.000000000000" : "0.100000000000",
    circulatingSupply: "0.00000000",
    treasuryInventory: cfg.maxSupply?.toFixed(8) ?? "0.00000000",
    protectedReserve: "0.000000000000",
    requiredLiability: "0.000000000000",
    reserveCoverageAmount: "0.000000000000",
    reserveCoveragePercent: "100.00",
    stabilizationFund: "0.000000000000",
    accruedRevenue: extras?.accruedRevenue ?? "0.000000000000",
    walletCount: 0,
    lastTradeAt: null,
    openCriticalIssues: 0,
    openWarningIssues: 0,
    lastReconciliationAt: null,
    lastReconciliationStatus: null,
    tradingCapabilities: {
      canBuy: status === "ACTIVE",
      canSell: status === "ACTIVE" || status === "REDEMPTION_ONLY",
    },
    revenueSweepConfigured: extras?.revenueSweepConfigured ?? false,
    activationReadinessAllPassed: status === "DRAFT" ? true : null,
    ...extras,
  };
}

export function getUiLabCryptoOpsDeskSummary(
  scenario: UiLabCryptoOpsScenario = "ready_to_activate",
): CryptoOpsDeskSummary {
  assertUiLab();

  let assets = LAUNCH_ASSET_SYMBOLS.map((s) => baseAsset(s, "DRAFT", { activationReadinessAllPassed: true }));
  const needsAttention: CryptoOpsDeskSummary["needsAttention"] = [];
  let openCritical = 0;

  switch (scenario) {
    case "active_healthy":
    case "recon_success":
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "ACTIVE", {
          accruedRevenue: s === "NVA" ? "12.50" : "0",
          revenueSweepConfigured: true,
          lastReconciliationAt: new Date().toISOString(),
          lastReconciliationStatus: "SUCCEEDED",
          walletCount: s === "NPFC" ? 1 : 0,
          circulatingSupply: s === "NPFC" ? "25.00000000" : "0.00000000",
          protectedReserve: s === "NPFC" ? "25.000000000000" : "0.000000000000",
          requiredLiability: s === "NPFC" ? "25.000000000000" : "0.000000000000",
        }),
      );
      break;
    case "halted":
      assets = [
        baseAsset("NPFC", "ACTIVE"),
        baseAsset("NVA", "HALTED", { openCriticalIssues: 0 }),
        baseAsset("VLT", "ACTIVE"),
      ];
      needsAttention.push({
        kind: "lifecycle",
        symbol: "NVA",
        summary: `${DEMONSTRATION}: NVA is halted — new trades blocked.`,
        severity: "WARNING",
        href: "/internal/terminal/crypto/NVA",
      });
      break;
    case "redemption_only":
      assets = [
        baseAsset("NPFC", "ACTIVE"),
        baseAsset("NVA", "ACTIVE"),
        baseAsset("VLT", "REDEMPTION_ONLY"),
      ];
      needsAttention.push({
        kind: "lifecycle",
        symbol: "VLT",
        summary: `${DEMONSTRATION}: VLT is redemption-only — buys disabled.`,
        severity: "WARNING",
        href: "/internal/terminal/crypto/VLT",
      });
      break;
    case "undercollateralized":
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "ACTIVE", {
          openCriticalIssues: s === "NVA" ? 1 : 0,
          protectedReserve: s === "NVA" ? "1.00" : "0",
          requiredLiability: s === "NVA" ? "50.00" : "0",
          reserveCoveragePercent: s === "NVA" ? "2.00" : "100.00",
        }),
      );
      openCritical = 1;
      needsAttention.push({
        kind: "reconciliation",
        symbol: "NVA",
        summary: `${DEMONSTRATION}: Protected reserve below required curve liability.`,
        severity: "CRITICAL",
        href: "/internal/terminal/crypto/NVA",
      });
      break;
    case "supply_mismatch":
    case "wallet_ledger_mismatch":
    case "recon_failed":
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "ACTIVE", { openCriticalIssues: s === "VLT" ? 1 : 0 }),
      );
      openCritical = 1;
      needsAttention.push({
        kind: "reconciliation",
        symbol: "VLT",
        summary:
          scenario === "supply_mismatch"
            ? `${DEMONSTRATION}: Treasury + circulation does not equal max supply.`
            : scenario === "wallet_ledger_mismatch"
              ? `${DEMONSTRATION}: Wallet ledger does not match wallet balances.`
              : `${DEMONSTRATION}: Last reconciliation failed.`,
        severity: "CRITICAL",
        href: "/internal/terminal/crypto/VLT",
      });
      break;
    case "revenue_missing_destination":
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "ACTIVE", {
          accruedRevenue: s === "NVA" ? "42.00" : "0",
          revenueSweepConfigured: false,
        }),
      );
      needsAttention.push({
        kind: "configuration",
        summary: `${DEMONSTRATION}: Accrued revenue visible — Sweep disabled until TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID is configured.`,
        severity: "WARNING",
        href: "/internal/terminal/crypto",
      });
      break;
    case "ready_to_activate":
    default:
      // Demonstration context is a banner, not an attention incident.
      break;
  }

  const recentActivity: CryptoOpsActivityEvent[] = [
    {
      id: "demo-1",
      kind: "operator",
      title: "Demonstration desk loaded",
      detail: `${DEMONSTRATION} — scenario ${scenario}. Mutations are blocked.`,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    assets,
    needsAttention,
    lastSuccessfulReconciliationAt:
      scenario === "recon_success" || scenario === "active_healthy"
        ? new Date().toISOString()
        : null,
    openCriticalIssueCount: openCritical,
    revenueSweepConfigured: scenario !== "revenue_missing_destination" && scenario !== "ready_to_activate",
    recentActivity,
    integrity: {
      openCriticalIssueCount: openCritical,
      openWarningIssueCount: needsAttention.filter((n) => n.severity === "WARNING").length,
      lastReconciliationAt:
        scenario === "recon_success" || scenario === "active_healthy"
          ? new Date().toISOString()
          : null,
      lastReconciliationStatus:
        scenario === "recon_failed"
          ? "FAILED"
          : scenario === "recon_success" || scenario === "active_healthy"
            ? "SUCCEEDED"
            : null,
      lastReconciliationSummary:
        scenario === "recon_failed"
          ? `${DEMONSTRATION}: Reconciliation failed.`
          : scenario === "recon_success"
            ? `${DEMONSTRATION}: All checks passed.`
            : null,
    },
    jobsReadiness: [
      {
        id: "recon",
        label: "Crypto reconciliation",
        status: openCritical > 0 ? "attention" : "ready",
        detail: `${DEMONSTRATION} — manual run blocked in UI Lab.`,
      },
      {
        id: "candles",
        label: "Candle rollup",
        status: "ready",
        detail: `${DEMONSTRATION} — aggregates real M1 candles only.`,
      },
      {
        id: "quote-secret",
        label: "Quote secret",
        status: "not_configured",
        detail: `${DEMONSTRATION} — production requires TERMINAL_CRYPTO_QUOTE_SECRET.`,
      },
    ],
  };
}

export function getUiLabCryptoOpsAssetWorkspace(
  symbolInput: string,
  scenario: UiLabCryptoOpsScenario = "ready_to_activate",
): CryptoOpsAssetWorkspace | null {
  assertUiLab();
  const symbol = symbolInput.trim().toUpperCase();
  if (!LAUNCH_ASSET_SYMBOLS.includes(symbol as never)) return null;
  const desk = getUiLabCryptoOpsDeskSummary(scenario);
  const overview = desk.assets.find((a) => a.symbol === symbol);
  if (!overview) return null;
  const cfg = CRYPTO_ASSET_CONFIGS[symbol as keyof typeof CRYPTO_ASSET_CONFIGS];

  return {
    ...overview,
    assetId: `uilab_${symbol}`,
    maxSupply: cfg.maxSupply?.toFixed(8) ?? null,
    pegOrStartingPrice: cfg.pegOrStartingPrice.toFixed(12),
    curveRate: cfg.curveRate?.toFixed(18) ?? null,
    totalFeeBps: cfg.totalFeeBps,
    revenueFeeBps: cfg.revenueFeeBps,
    stabilizationFeeBps: cfg.stabilizationFeeBps,
    quantityPrecision: cfg.quantityPrecision,
    displayPrecision: cfg.displayPrecision,
    openIssues:
      overview.openCriticalIssues > 0
        ? [
            {
              id: "demo-issue",
              checkKey: "DEMO_CRITICAL",
              severity: "CRITICAL" as const,
              summary:
                desk.needsAttention.find((n) => n.symbol === symbol)?.summary ?? "Critical issue",
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    activity: desk.recentActivity,
    recentSettlements: [],
    recentLedger: [],
    volumeFlorins: "0.00",
    candleCount: 0,
  };
}

/** @deprecated Prefer getUiLabCryptoOpsAssetWorkspace */
export const getUiLabCryptoOpsWorkspace = getUiLabCryptoOpsAssetWorkspace;

export function getUiLabCryptoActivationReadiness(symbolInput: string) {
  assertUiLab();
  const symbol = symbolInput.trim().toUpperCase();
  const items = [
    {
      key: "demo",
      label: "Demonstration readiness",
      passed: true,
      detail: `${DEMONSTRATION} — Activate remains Corporate-admin only and is disabled in UI Lab.`,
      severity: "INFO" as const,
    },
    {
      key: "ui_lab_mutations",
      label: "Mutations available",
      passed: false,
      detail: "UI Lab blocks all crypto market mutations.",
      severity: "WARNING" as const,
    },
  ];
  return {
    symbol,
    allPassed: false,
    items,
  };
}

export function searchUiLabCryptoMarkets(
  query: string,
  limit = 10,
): import("@/lib/internal/ops-types").GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const matchAll = q.includes("crypto") || q.includes("market");
  const results: import("@/lib/internal/ops-types").GlobalSearchResult[] = [];
  for (const symbol of LAUNCH_ASSET_SYMBOLS) {
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    const hay = `${symbol} ${cfg.displayName} crypto market`.toLowerCase();
    if (!matchAll && !hay.includes(q)) continue;
    results.push({
      id: symbol,
      type: "terminal_crypto_market",
      label: symbol,
      sublabel: `${cfg.displayName} · Crypto market · Draft`,
      href: `/internal/terminal/crypto/${symbol}?tab=overview&site=terminal`,
      status: "draft",
    });
    if (results.length >= limit) break;
  }
  return results;
}
