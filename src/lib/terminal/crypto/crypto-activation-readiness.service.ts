/**
 * Activation / resume readiness checklist for Alta Terminal fictional crypto (Phase 4).
 * Read-only evaluation — never mutates balances or activates assets.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  CRYPTO_ASSET_CONFIGS,
  LAUNCH_ASSET_SYMBOLS,
  type CryptoAssetSymbol,
} from "./crypto-constants";
import { d, roundPrice, serializeCryptoPrice } from "./crypto-decimal";
import { marginalPrice, reserveLiability } from "./crypto-curve-math";
import { isCryptoQuoteSecretConfigured } from "./crypto-quote-token";

export type ActivationReadinessItem = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
};

export type ActivationReadinessResult = {
  symbol: string;
  allPassed: boolean;
  items: ActivationReadinessItem[];
};

type DbClient = Prisma.TransactionClient | typeof prisma;

const PHASE4_MIGRATION =
  "prisma/migrations/20260731200000_terminal_crypto_operations_phase4/migration.sql";
const PHASE1_MIGRATION =
  "prisma/migrations/20260731140000_terminal_crypto_market_foundation/migration.sql";
const PHASE2_MIGRATION =
  "prisma/migrations/20260731160000_terminal_crypto_execution_hardening/migration.sql";
const PHASE3_MIGRATION =
  "prisma/migrations/20260731180000_terminal_crypto_customer_phase3/migration.sql";

function isLaunchSymbol(symbol: string): symbol is CryptoAssetSymbol {
  return (LAUNCH_ASSET_SYMBOLS as string[]).includes(symbol);
}

function repoRoot(): string {
  return process.cwd();
}

function migrationPresent(relativePath: string): boolean {
  return existsSync(join(repoRoot(), relativePath));
}

export function finalizeReadiness(
  result: Omit<ActivationReadinessResult, "allPassed"> & { allPassed?: boolean },
): ActivationReadinessResult {
  const allPassed = result.items
    .filter((i) => i.severity === "CRITICAL" || i.severity === "WARNING")
    .every((i) => i.passed);
  return { symbol: result.symbol, items: result.items, allPassed };
}

/**
 * Evaluate whether an asset may move to ACTIVE.
 * When `skipDb` is true (unit tests), only static/config checks run.
 */
export async function evaluateActivationReadiness(
  symbolInput: string,
  opts?: { tx?: DbClient; skipDb?: boolean },
): Promise<ActivationReadinessResult> {
  const symbol = symbolInput.trim().toUpperCase();
  const items: ActivationReadinessItem[] = [];
  const db = opts?.tx ?? prisma;

  items.push({
    key: "migrations_present",
    label: "Required crypto migrations present",
    passed:
      migrationPresent(PHASE1_MIGRATION) &&
      migrationPresent(PHASE2_MIGRATION) &&
      migrationPresent(PHASE3_MIGRATION) &&
      migrationPresent(PHASE4_MIGRATION),
    detail: "Phase 1–4 crypto migration SQL files must exist in the repository.",
    severity: "CRITICAL",
  });

  items.push({
    key: "quote_secret",
    label: "Production quote secret configured",
    passed: isCryptoQuoteSecretConfigured(),
    detail:
      process.env.NODE_ENV === "production"
        ? "TERMINAL_CRYPTO_QUOTE_SECRET must be set (min 32 characters) in production."
        : "Quote secret is configured or local/dev fallback is available.",
    severity: "CRITICAL",
  });

  let consentOk = false;
  let consentDetail = "CRYPTO consent / AT-LEGAL-006 not found.";
  try {
    const { getConsentBundleDefinition } = await import("@/lib/legal/legal-consent-bundle");
    const { getLegalDocument } = await import("@/lib/legal/legal-document-registry");
    const bundle = getConsentBundleDefinition("CRYPTO");
    const doc = getLegalDocument("AT-LEGAL-006");
    consentOk = Boolean(
      bundle && doc && bundle.documents.some((d) => d.documentId === "AT-LEGAL-006"),
    );
    consentDetail = consentOk
      ? "CRYPTO consent bundle includes AT-LEGAL-006."
      : "CRYPTO consent bundle or AT-LEGAL-006 is missing.";
  } catch {
    consentOk = false;
  }
  items.push({
    key: "crypto_consent",
    label: "CRYPTO consent and AT-LEGAL-006 registered",
    passed: consentOk,
    detail: consentDetail,
    severity: "CRITICAL",
  });

  let scheduledOk = false;
  try {
    const catalog = readFileSync(join(repoRoot(), "src/lib/internal/ops-jobs-catalog.ts"), "utf8");
    const executorPath = join(
      repoRoot(),
      "src/server/terminal-scheduled-trade-executor.service.ts",
    );
    const executor = existsSync(executorPath) ? readFileSync(executorPath, "utf8") : "";
    scheduledOk =
      catalog.includes("terminal_scheduled_trades") &&
      (executor.includes("submitTerminalCryptoOrder") || executor.includes("ALTA_CRYPTO"));
  } catch {
    scheduledOk = false;
  }
  items.push({
    key: "scheduled_crypto_config",
    label: "Scheduled crypto execution configured",
    passed: scheduledOk,
    detail: scheduledOk
      ? "Scheduled trades catalog and crypto executor path are present."
      : "Scheduled crypto job wiring is incomplete.",
    severity: "WARNING",
  });

  if (opts?.skipDb) {
    if (isLaunchSymbol(symbol)) {
      const cfg = CRYPTO_ASSET_CONFIGS[symbol];
      items.push({
        key: "asset_config",
        label: "Asset configuration validates",
        passed:
          cfg.totalFeeBps === cfg.revenueFeeBps + cfg.stabilizationFeeBps &&
          cfg.pegOrStartingPrice.greaterThan(0),
        detail: `${symbol} fee split and peg/starting price validated against seed config.`,
        severity: "CRITICAL",
      });
    }
    return finalizeReadiness({ symbol, items });
  }

  let modelsOk = false;
  try {
    await db.terminalCryptoAsset.findFirst({ select: { id: true } });
    await db.terminalCryptoMarketState.findFirst({ select: { id: true } });
    await db.terminalCryptoAssetStatusChange.findFirst({ select: { id: true } });
    await db.terminalCryptoReconciliationRun.findFirst({ select: { id: true } });
    modelsOk = true;
  } catch {
    modelsOk = false;
  }
  items.push({
    key: "models_present",
    label: "Required crypto models available",
    passed: modelsOk,
    detail: modelsOk
      ? "Crypto asset, market state, status-change, and reconciliation models are queryable."
      : "Phase 4 crypto operations tables are not available — apply migrations first.",
    severity: "CRITICAL",
  });

  const asset = modelsOk
    ? await db.terminalCryptoAsset.findUnique({
        where: { symbol },
        include: { marketState: true },
      })
    : null;

  items.push({
    key: "asset_exists",
    label: "Asset and market state exist",
    passed: Boolean(asset?.marketState),
    detail: asset?.marketState
      ? `${symbol} asset and market state rows are present.`
      : `${symbol} asset or market state is missing.`,
    severity: "CRITICAL",
  });

  if (!asset?.marketState) {
    return finalizeReadiness({ symbol, items });
  }

  const cfg = isLaunchSymbol(symbol) ? CRYPTO_ASSET_CONFIGS[symbol] : null;
  const feeSplitOk =
    asset.totalFeeBps === asset.revenueFeeBps + asset.stabilizationFeeBps &&
    asset.totalFeeBps >= 0 &&
    asset.revenueFeeBps >= 0 &&
    asset.stabilizationFeeBps >= 0;
  items.push({
    key: "asset_config",
    label: "Asset configuration validates",
    passed: feeSplitOk && d(asset.pegOrStartingPrice.toString()).greaterThan(0),
    detail: feeSplitOk
      ? "Fee basis points and peg/starting price are valid."
      : "Fee split or peg/starting price is invalid.",
    severity: "CRITICAL",
  });

  let priceOk = false;
  let priceDetail = "Could not recompute marginal price.";
  try {
    if (asset.kind === "STABLE") {
      const expected = roundPrice(asset.pegOrStartingPrice);
      priceOk = roundPrice(asset.marketState.currentMarginalPrice).equals(expected);
      priceDetail = priceOk
        ? `Cached price equals peg ${serializeCryptoPrice(expected)}.`
        : `Cached price ${serializeCryptoPrice(asset.marketState.currentMarginalPrice)} ≠ peg ${serializeCryptoPrice(expected)}.`;
    } else if (asset.curveRate) {
      const recomputed = roundPrice(
        marginalPrice({
          startingPrice: asset.pegOrStartingPrice,
          curveRate: asset.curveRate,
          circulatingSupply: asset.marketState.circulatingSupply,
        }),
      );
      priceOk = roundPrice(asset.marketState.currentMarginalPrice).equals(recomputed);
      priceDetail = priceOk
        ? `Cached marginal price matches recomputed ${serializeCryptoPrice(recomputed)}.`
        : `Cached ${serializeCryptoPrice(asset.marketState.currentMarginalPrice)} ≠ recomputed ${serializeCryptoPrice(recomputed)}.`;
    }
  } catch {
    priceOk = false;
  }
  items.push({
    key: "price_recompute",
    label: "Current price recomputes correctly",
    passed: priceOk,
    detail: priceDetail,
    severity: "CRITICAL",
  });

  let criticalCount = 0;
  try {
    criticalCount = await db.terminalCryptoReconciliationIssue.count({
      where: { assetId: asset.id, status: "OPEN", severity: "CRITICAL" },
    });
  } catch {
    criticalCount = 0;
  }
  items.push({
    key: "no_critical_recon",
    label: "No unresolved critical reconciliation issues",
    passed: criticalCount === 0,
    detail:
      criticalCount === 0
        ? "No open critical reconciliation issues."
        : `${criticalCount} open critical issue(s) must be resolved first.`,
    severity: "CRITICAL",
  });

  const treasury = d(asset.marketState.treasuryInventory.toString());
  const circulating = d(asset.marketState.circulatingSupply.toString());
  const reserve = d(asset.marketState.protectedReserve.toString());
  const stab = d(asset.marketState.stabilizationFund.toString());
  const revenue = d(asset.marketState.accruedRevenue.toString());

  const noNegatives =
    treasury.greaterThanOrEqualTo(0) &&
    circulating.greaterThanOrEqualTo(0) &&
    reserve.greaterThanOrEqualTo(0) &&
    stab.greaterThanOrEqualTo(0) &&
    revenue.greaterThanOrEqualTo(0);
  items.push({
    key: "no_negatives",
    label: "No impossible negative market state",
    passed: noNegatives,
    detail: noNegatives
      ? "Treasury, circulation, reserves, and revenue are non-negative."
      : "One or more market balances are negative.",
    severity: "CRITICAL",
  });

  if (asset.kind === "BONDING_CURVE" && asset.maxSupply) {
    const maxSupply = d(asset.maxSupply.toString());
    const conserved = treasury.plus(circulating).equals(maxSupply);
    items.push({
      key: "supply_conservation",
      label: "Fixed-supply conservation",
      passed: conserved,
      detail: conserved
        ? "Treasury + circulating equals max supply."
        : `Treasury (${treasury.toFixed()}) + circulating (${circulating.toFixed()}) ≠ max (${maxSupply.toFixed()}).`,
      severity: "CRITICAL",
    });

    const liability = reserveLiability({
      startingPrice: asset.pegOrStartingPrice,
      curveRate: asset.curveRate ?? "0",
      circulatingSupply: circulating,
    });
    const covered = reserve.greaterThanOrEqualTo(liability);
    items.push({
      key: "reserve_coverage",
      label: "Protected reserve covers curve liability",
      passed: covered,
      detail: covered
        ? "Protected reserve covers recomputed curve liability."
        : `Reserve ${reserve.toFixed()} < liability ${liability.toFixed()}.`,
      severity: "CRITICAL",
    });

    if (circulating.equals(0) && cfg?.maxSupply) {
      const initialOk =
        treasury.equals(cfg.maxSupply) &&
        reserve.equals(0) &&
        stab.equals(0) &&
        roundPrice(asset.marketState.currentMarginalPrice).equals(
          roundPrice(cfg.pegOrStartingPrice),
        );
      items.push({
        key: "initial_state",
        label: "Initial bonding-curve state expectations",
        passed: initialOk,
        detail: initialOk
          ? "Treasury at max supply, zero circulation/reserves, price at start."
          : "Launch initial-state expectations are not met.",
        severity: "WARNING",
      });
    }
  } else if (asset.kind === "STABLE") {
    const covered = reserve.greaterThanOrEqualTo(circulating);
    items.push({
      key: "reserve_coverage",
      label: "NPFC protected reserve covers circulating supply",
      passed: covered,
      detail: covered
        ? "Protected reserve ≥ circulating NPFC at ƒ1."
        : `Reserve ${reserve.toFixed()} < circulating ${circulating.toFixed()}.`,
      severity: "CRITICAL",
    });
    items.push({
      key: "supply_conservation",
      label: "Stable supply checks",
      passed: true,
      detail: "NPFC is variable-supply; fixed-supply conservation does not apply.",
      severity: "INFO",
    });
    if (circulating.equals(0)) {
      const initialOk =
        reserve.equals(0) &&
        roundPrice(asset.marketState.currentMarginalPrice).equals(roundPrice("1"));
      items.push({
        key: "initial_state",
        label: "Initial NPFC state expectations",
        passed: initialOk,
        detail: initialOk
          ? "Zero circulation, zero reserve, price ƒ1."
          : "NPFC initial-state expectations are not met.",
        severity: "WARNING",
      });
    }
  }

  const walletAgg = await db.terminalCryptoWalletBalance.aggregate({
    where: { assetId: asset.id },
    _sum: { availableQuantity: true, reservedQuantity: true },
  });
  const walletSum = d(walletAgg._sum.availableQuantity?.toString() ?? "0").plus(
    d(walletAgg._sum.reservedQuantity?.toString() ?? "0"),
  );
  const walletOk = walletSum.equals(circulating);
  items.push({
    key: "wallet_aggregates",
    label: "Wallet aggregates match circulating supply",
    passed: walletOk,
    detail: walletOk
      ? "Sum of wallet holdings equals circulating supply."
      : `Wallet sum ${walletSum.toFixed()} ≠ circulating ${circulating.toFixed()}.`,
    severity: "CRITICAL",
  });

  // Ledger reconcile (latest balanceAfter per account vs market state) — lightweight readiness gate
  const accounts = [
    { account: "TREASURY_INVENTORY" as const, expected: treasury },
    { account: "CIRCULATING_SUPPLY" as const, expected: circulating },
    { account: "PROTECTED_RESERVE" as const, expected: reserve },
    { account: "STABILIZATION_FUND" as const, expected: stab },
    { account: "TERMINAL_REVENUE" as const, expected: revenue },
  ];
  let ledgerOk = true;
  const ledgerNotes: string[] = [];
  for (const row of accounts) {
    const latest = await db.terminalCryptoMarketLedgerEntry.findFirst({
      where: { assetId: asset.id, account: row.account },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      // No ledger yet is OK at launch with zero activity for matching zeros.
      if (!row.expected.equals(0)) {
        ledgerOk = false;
        ledgerNotes.push(`${row.account}: missing ledger with nonzero state`);
      }
      continue;
    }
    if (!d(latest.balanceAfter.toString()).equals(row.expected)) {
      ledgerOk = false;
      ledgerNotes.push(`${row.account}: ledger≠state`);
    }
  }
  items.push({
    key: "market_ledger",
    label: "Market ledger reconciles with market state",
    passed: ledgerOk,
    detail: ledgerOk
      ? "Latest market ledger balances match market state."
      : ledgerNotes.join("; "),
    severity: "CRITICAL",
  });

  return finalizeReadiness({ symbol, items });
}
