#!/usr/bin/env node
/**
 * Smoke acceptance for Bank action overlay architecture (static checks).
 * Does not approve requests or move funds.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, "src", rel), "utf8");

const checks = [
  ["components/bank/actions/responsive-bank-action.tsx", /ResponsiveBankAction/],
  ["components/bank/actions/responsive-bank-action.tsx", /--bank-mobile-nav-offset/],
  ["components/bank/actions/responsive-bank-action.tsx", /onPointerDownOutside/],
  ["components/bank/actions/bank-action-host.tsx", /BankActionHost/],
  ["components/bank/bank-page-layout.tsx", /BankActionHost/],
  ["components/bank/bank-home-dashboard.tsx", /BankActionLauncher/],
  ["components/bank/bank-product-comparison.tsx", /closeThenRun/],
  ["components/bank/bank-product-comparison.tsx", /ApplyFromProductDetails/],
  ["components/bank/move-money-chooser.tsx", /Between my accounts/],
  ["lib/bank/bank-action-url.ts", /query-driven/i],
  ["lib/bank/bank-action-ui-lab.ts", /shouldUseBankActionUiLabMock/],
  ["lib/ui/overlay-layers.ts", /OVERLAY_SCRIM_CLASS/],
  ["lib/ui/bank-workflow-registry.ts", /closeAllBankWorkflows/],
  ["lib/bank/bank-action-dirty.ts", /isPayFormDirty/],
];

for (const [file, pattern] of checks) {
  assert.match(read(file), pattern, `missing ${pattern} in ${file}`);
}

console.log("accept-bank-action-overlays: ok");
