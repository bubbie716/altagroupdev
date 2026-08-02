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
import { presentCryptoAssetStatus } from "@/lib/terminal/crypto/crypto-status-presentation";

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
  | "recon_failed"
  | "warning_issue"
  | "permission_denied"
  | "version_conflict"
  | "insufficient_reserve"
  | "server_failure"
  | "idempotent_replay";

export const UI_LAB_CRYPTO_OPS_SCENARIO_SESSION_KEY = "alta.terminal.cryptoOps.uiLabScenario";

const DEMONSTRATION = "Demonstration data";

const OPS_SCENARIOS = new Set<string>([
  "ready_to_activate",
  "active_healthy",
  "halted",
  "redemption_only",
  "undercollateralized",
  "supply_mismatch",
  "wallet_ledger_mismatch",
  "revenue_missing_destination",
  "recon_success",
  "recon_failed",
  "warning_issue",
  "permission_denied",
  "version_conflict",
  "insufficient_reserve",
  "server_failure",
  "idempotent_replay",
]);

function assertUiLab() {
  if (!isUiLabMode()) {
    throw new Error("UI Lab crypto ops fixtures require UI Lab mode");
  }
}

export function parseUiLabCryptoOpsScenario(
  value: unknown,
  fallback: UiLabCryptoOpsScenario = "active_healthy",
): UiLabCryptoOpsScenario {
  if (typeof value === "string" && OPS_SCENARIOS.has(value)) {
    return value as UiLabCryptoOpsScenario;
  }
  return fallback;
}

/** Client-only: persist URL cryptoOpsScenario for subsequent navigations. */
export function resolveUiLabCryptoOpsScenario(
  fallback: UiLabCryptoOpsScenario = "active_healthy",
): UiLabCryptoOpsScenario {
  assertUiLab();
  try {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("cryptoOpsScenario");
      if (fromUrl && OPS_SCENARIOS.has(fromUrl)) {
        window.sessionStorage.setItem(UI_LAB_CRYPTO_OPS_SCENARIO_SESSION_KEY, fromUrl);
        return fromUrl as UiLabCryptoOpsScenario;
      }
      const stored = window.sessionStorage.getItem(UI_LAB_CRYPTO_OPS_SCENARIO_SESSION_KEY);
      if (stored && OPS_SCENARIOS.has(stored)) return stored as UiLabCryptoOpsScenario;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function baseAsset(
  symbol: "NPFC" | "NVA" | "VLT",
  status: string,
  extras?: Partial<CryptoOpsAssetOverview>,
): CryptoOpsAssetOverview {
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  const presented = presentCryptoAssetStatus({ status, surface: "ops", uiLab: true });
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
      canBuy: presented.canBuy,
      canSell: presented.canSell,
    },
    revenueSweepConfigured: extras?.revenueSweepConfigured ?? false,
    activationReadinessAllPassed: status === "DRAFT" ? true : null,
    ...extras,
  };
}

export function getUiLabCryptoOpsDeskSummary(
  scenarioInput: UiLabCryptoOpsScenario = "active_healthy",
): CryptoOpsDeskSummary {
  assertUiLab();
  const scenario = scenarioInput;

  let assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
    baseAsset(s, "ACTIVE", {
      accruedRevenue: s === "NVA" ? "12.50" : "0",
      revenueSweepConfigured: true,
      lastReconciliationAt: new Date().toISOString(),
      lastReconciliationStatus: "SUCCEEDED",
      walletCount: s === "NPFC" ? 2 : 1,
      circulatingSupply:
        s === "NPFC" ? "25.00000000" : s === "NVA" ? "4.00000000" : "50.00000000",
      protectedReserve:
        s === "NPFC" ? "25.000000000000" : s === "NVA" ? "20.000000000000" : "5.000000000000",
      requiredLiability:
        s === "NPFC" ? "25.000000000000" : s === "NVA" ? "20.000000000000" : "5.000000000000",
    }),
  );
  const needsAttention: CryptoOpsDeskSummary["needsAttention"] = [];
  let openCritical = 0;

  switch (scenario) {
    case "active_healthy":
    case "recon_success":
      // Default healthy demonstration — matches customer ACTIVE markets.
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
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "DRAFT", { activationReadinessAllPassed: true, walletCount: 0 }),
      );
      // Demonstration context is a banner, not an attention incident.
      break;
    case "warning_issue":
      assets = LAUNCH_ASSET_SYMBOLS.map((s) =>
        baseAsset(s, "ACTIVE", { openWarningIssues: s === "NVA" ? 1 : 0 }),
      );
      needsAttention.push({
        kind: "reconciliation",
        symbol: "NVA",
        summary: `${DEMONSTRATION}: Fee allocation warning on NVA.`,
        severity: "WARNING",
        href: "/internal/terminal/crypto/NVA",
      });
      break;
    case "permission_denied":
    case "version_conflict":
    case "insufficient_reserve":
    case "server_failure":
    case "idempotent_replay":
      // Process-state demonstration scenarios — healthy markets; UI shows disabled receipts.
      break;
    default:
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
  scenarioInput: UiLabCryptoOpsScenario = "active_healthy",
): CryptoOpsAssetWorkspace | null {
  assertUiLab();
  const scenario = scenarioInput;
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
    sensitivityLabel: cfg.sensitivityLabel,
    matchesAuthoritativeConfig: true,
    openIssues: [
      ...(overview.openCriticalIssues > 0
        ? [
            {
              id: "demo-issue-critical",
              checkKey: "DEMO_CRITICAL",
              severity: "CRITICAL" as const,
              status: "OPEN" as const,
              summary:
                desk.needsAttention.find((n) => n.symbol === symbol)?.summary ??
                `${DEMONSTRATION}: Critical reconciliation issue`,
              fingerprint: `demo_fp_critical_${symbol}`,
              firstSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
              lastSeenAt: new Date().toISOString(),
              technicalDetails: `${DEMONSTRATION} technical detail — not production.`,
              href: `/internal/terminal/crypto/${symbol}`,
            },
          ]
        : []),
      ...(overview.openWarningIssues > 0
        ? [
            {
              id: "demo-issue-warning",
              checkKey: "DEMO_WARNING",
              severity: "WARNING" as const,
              status: "OPEN" as const,
              summary: `${DEMONSTRATION}: Warning issue on ${symbol}`,
              fingerprint: `demo_fp_warning_${symbol}`,
              firstSeenAt: new Date(Date.now() - 43_200_000).toISOString(),
              lastSeenAt: new Date().toISOString(),
              technicalDetails: null,
              href: `/internal/terminal/crypto/${symbol}`,
            },
          ]
        : []),
    ],
    recentlyResolvedIssues:
      scenario === "idempotent_replay"
        ? [
            {
              id: "demo-resolved",
              checkKey: "DEMO_RESOLVED",
              severity: "WARNING" as const,
              status: "RESOLVED" as const,
              summary: `${DEMONSTRATION}: Previously resolved warning`,
              fingerprint: `demo_fp_resolved_${symbol}`,
              firstSeenAt: new Date(Date.now() - 172_800_000).toISOString(),
              lastSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
              resolvedAt: new Date(Date.now() - 86_400_000).toISOString(),
              resolutionSource: "operator",
              resolutionNote: "Demonstration resolve",
            },
          ]
        : [],
    configHistory: [
      {
        id: "demo-cfg-1",
        configVersion: 1,
        changeSummary: `${DEMONSTRATION}: Initial fee configuration`,
        reason: "Launch baseline",
        actorUserId: "uilab_actor",
        previousTotalFeeBps: cfg.totalFeeBps,
        nextTotalFeeBps: cfg.totalFeeBps,
        previousRevenueFeeBps: cfg.revenueFeeBps,
        nextRevenueFeeBps: cfg.revenueFeeBps,
        previousStabilizationFeeBps: cfg.stabilizationFeeBps,
        nextStabilizationFeeBps: cfg.stabilizationFeeBps,
        effectiveAt: new Date(Date.now() - 604_800_000).toISOString(),
        createdAt: new Date(Date.now() - 604_800_000).toISOString(),
      },
    ],
    activity: desk.recentActivity,
    recentSettlements: [],
    recentLedger: [],
    volumeFlorins: "0.00",
    candleCount: 0,
  };
}

export function getUiLabCryptoConfigSurface(symbolInput: string) {
  assertUiLab();
  const symbol = symbolInput.trim().toUpperCase();
  if (!LAUNCH_ASSET_SYMBOLS.includes(symbol as never)) return null;
  const cfg = CRYPTO_ASSET_CONFIGS[symbol as keyof typeof CRYPTO_ASSET_CONFIGS];
  return {
    symbol,
    assetVersion: 0,
    currentConfigVersion: 1,
    fees: {
      totalFeeBps: cfg.totalFeeBps,
      revenueFeeBps: cfg.revenueFeeBps,
      stabilizationFeeBps: cfg.stabilizationFeeBps,
      mutable: true as const,
      readiness: `${DEMONSTRATION} — fee edits disabled in UI Lab.`,
    },
    pegOrStartingPrice: {
      value: cfg.pegOrStartingPrice.toFixed(12),
      mutable: false as const,
      readiness: "Peg / launch price changes require a reviewed migration.",
    },
    curveRate: {
      value: cfg.curveRate?.toFixed(18) ?? null,
      mutable: false as const,
      readiness: "Bonding-curve rate is migration-only.",
    },
    marketImpactThreshold: {
      value: cfg.sensitivityLabel,
      mutable: false as const,
      readiness: "Launch impact targets are application constants.",
    },
    stablecoinPeg: {
      value: cfg.kind === "STABLE" ? cfg.pegOrStartingPrice.toFixed(12) : null,
      mutable: false as const,
      readiness:
        cfg.kind === "STABLE"
          ? "NPFC peg is foundational — migration only."
          : "Not a stablecoin asset.",
    },
    recentChanges: [],
  };
}

/** Demonstration process-state copy for UI Lab action receipts. */
export function getUiLabCryptoOpsProcessDemo(
  scenario: UiLabCryptoOpsScenario,
): { title: string; detail: string } | null {
  switch (scenario) {
    case "permission_denied":
      return {
        title: "Permission denied",
        detail: `${DEMONSTRATION}: Corporate admin required for this control.`,
      };
    case "version_conflict":
      return {
        title: "Version conflict",
        detail: `${DEMONSTRATION}: Market state changed. Refresh and try again.`,
      };
    case "insufficient_reserve":
      return {
        title: "Insufficient reserve",
        detail: `${DEMONSTRATION}: Protected reserve would fall below required liability.`,
      };
    case "server_failure":
      return {
        title: "Server failure",
        detail: `${DEMONSTRATION}: Something went wrong. Try again later.`,
      };
    case "idempotent_replay":
      return {
        title: "Idempotent replay",
        detail: `${DEMONSTRATION}: This request already completed — safe replay, no double effect.`,
      };
    default:
      return null;
  }
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
    const deskAsset = getUiLabCryptoOpsDeskSummary().assets.find((a) => a.symbol === symbol);
    const presented = presentCryptoAssetStatus({
      status: deskAsset?.status ?? "ACTIVE",
      surface: "ops",
      uiLab: true,
    });
    results.push({
      id: symbol,
      type: "terminal_crypto_market",
      label: symbol,
      sublabel: `${cfg.displayName} · ${presented.statusLabel}`,
      href: `/internal/terminal/crypto/${symbol}?tab=overview&site=terminal`,
      status: presented.lifecycleStatus === "ACTIVE" ? "active" : "draft",
    });
    if (results.length >= limit) break;
  }
  return results;
}
