/**
 * Guarded CLI to reset Alta Terminal fictional crypto markets (NPFC / NVA / VLT)
 * back to launch state in disposable prelaunch environments.
 *
 * Dry-run by default. Does NOT run automatically.
 *
 * Usage:
 *   npx tsx scripts/reset-terminal-crypto-prelaunch.ts
 *   npm run db:reset-terminal-crypto-prelaunch
 *   CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET=YES npx tsx scripts/reset-terminal-crypto-prelaunch.ts --apply
 *
 * Refuses when NODE_ENV, VERCEL_ENV, or ALTA_ENV is production.
 */
import { PrismaClient } from "@prisma/client";
import {
  CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV,
  CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
  CryptoPrelaunchResetError,
  isCryptoPrelaunchResetProductionEnv,
  resetTerminalCryptoPrelaunchMarket,
  type CryptoPrelaunchResetPlan,
} from "../src/lib/terminal/crypto/crypto-prelaunch-reset.service";

const APPLY = process.argv.includes("--apply");

function printPlan(plan: CryptoPrelaunchResetPlan): void {
  console.log("");
  console.log("Targets: NPFC, NVA, VLT only");
  console.log("Preserves: TerminalCryptoWallet identity, go-live status-change rows,");
  console.log("           stock orders, bank, users, portfolios, legal consent");
  console.log("");
  console.log("Per-asset counts:");
  for (const asset of plan.assets) {
    console.log(`  ${asset.symbol} (${asset.assetId}) status=${asset.status}`);
    console.log(
      `    ledger wallet=${asset.walletLedgerEntries} market=${asset.marketLedgerEntries}` +
        ` settlements=${asset.settlements} orders=${asset.orders}` +
        ` candles=${asset.priceCandles} balances=${asset.walletBalances}`,
    );
    console.log(
      `    sweeps=${asset.revenueSweeps} contributions=${asset.externalContributions}` +
        ` reconIssues=${asset.reconciliationIssues}` +
        ` statusChanges delete=${asset.statusChangesToDelete} preserve=${asset.statusChangesPreserved}`,
    );
    console.log(
      `    launch restore: treasury=${asset.launchTreasury} price=${asset.launchMarginalPrice}`,
    );
  }
  console.log("");
  console.log("Totals:");
  const t = plan.totals;
  console.log(`  wallet ledger entries:     ${t.walletLedgerEntries}`);
  console.log(`  market ledger entries:     ${t.marketLedgerEntries}`);
  console.log(`  settlements:               ${t.settlements}`);
  console.log(`  order fills:               ${t.orderFills}`);
  console.log(`  portfolio activities:      ${t.portfolioActivities}`);
  console.log(`  cash ledger (relatedOrder):${t.cashLedgerEntries}`);
  console.log(`  orders:                    ${t.orders}`);
  console.log(`  price candles:             ${t.priceCandles}`);
  console.log(`  reconciliation issues:     ${t.reconciliationIssues}`);
  console.log(`  reconciliation runs:       ${t.reconciliationRuns}`);
  console.log(`  wallet balances:           ${t.walletBalances}`);
  console.log(`  revenue sweeps:            ${t.revenueSweeps}`);
  console.log(`  external contributions:    ${t.externalContributions}`);
  console.log(`  status changes to delete:  ${t.statusChangesToDelete}`);
  console.log("");
}

async function main(): Promise<void> {
  console.log("[reset-terminal-crypto-prelaunch] Alta Terminal crypto prelaunch market reset");
  console.log(APPLY ? "Mode: APPLY" : "Mode: DRY-RUN (pass --apply to execute)");

  if (isCryptoPrelaunchResetProductionEnv(process.env)) {
    throw new CryptoPrelaunchResetError(
      "Refusing: production environment (NODE_ENV, VERCEL_ENV, or ALTA_ENV is production).",
    );
  }

  if (APPLY) {
    if (process.env.CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET !== CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE) {
      throw new CryptoPrelaunchResetError(
        `Refusing apply: set ${CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV}=${CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE} to confirm.`,
      );
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await resetTerminalCryptoPrelaunchMarket(prisma, {
      apply: APPLY,
      env: process.env,
    });
    printPlan(result.plan);

    if (!APPLY) {
      console.log("Dry run only — no rows were modified.");
      console.log(
        `Re-run with ${CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV}=${CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE} ... --apply to execute.`,
      );
      return;
    }

    console.log("Apply complete. Markets restored to launch state; assets left ACTIVE.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[reset-terminal-crypto-prelaunch] ${message}`);
  process.exitCode = 1;
});
