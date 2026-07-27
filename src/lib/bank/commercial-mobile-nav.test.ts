import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  accountCommercialPath,
  accountCommercialRoutes,
} from "./account-commercial-path.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("commercial mobile overlay and navigation structure", () => {
  it("upgrade and downgrade panels use ResponsiveBankAction with safe-area sheet classes", () => {
    const upgrade = read("components/bank/commercial/commercial-pro-upgrade-panel.tsx");
    const downgrade = read("components/bank/commercial/commercial-pro-downgrade-panel.tsx");
    assert.match(upgrade, /ResponsiveBankAction/);
    assert.match(downgrade, /ResponsiveBankAction/);
    assert.doesNotMatch(upgrade, /upgradeDialogClass/);
    assert.match(downgrade, /period_end|period end|periodEnd/i);
  });

  it("shared ResponsiveBankAction keeps scroll body and sticky footer for mobile sheets", () => {
    const shell = read("components/bank/actions/responsive-bank-action.tsx");
    const styles = read("styles.css");
    assert.match(shell, /--bank-mobile-nav-offset/);
    assert.match(shell, /--bank-mobile-sheet-max-height/);
    assert.match(shell, /data-bank-action-scroll/);
    assert.match(shell, /data-bank-action-footer/);
    assert.match(shell, /max-md:bottom-\[var\(--bank-mobile-nav-offset\)\]/);
    // Unscoped max-h replaces DialogContent's default so mobile sheets cannot overflow the nav.
    assert.match(shell, /max-h-\[var\(--bank-mobile-sheet-max-height\)\]/);
    assert.match(shell, /overflow-hidden/);
    assert.match(shell, /min-h-0/);
    assert.match(shell, /scrollResetKey/);
    assert.match(shell, /scrollTop = 0/);
    assert.match(styles, /--bank-mobile-sheet-max-height/);
    assert.match(styles, /safe-area-inset-bottom/);
  });

  it("invoice and payment-link workflows reset scroll between steps", () => {
    const invoice = read("components/bank/merchant-invoices/merchant-invoice-workflow.tsx");
    const links = read("components/bank/payment-links/payment-link-workflow.tsx");
    assert.match(invoice, /scrollResetKey=\{`\$\{step\}:\$\{phase\}`\}/);
    assert.match(links, /scrollResetKey=\{`\$\{step\}:\$\{phase\}`\}/);
  });

  it("business account nav is a single flat system without nested Commercial group", () => {
    const nav = read("components/bank/account-sub-nav.tsx");
    assert.match(nav, /Payments/);
    assert.match(nav, /Team/);
    assert.match(nav, /More/);
    assert.doesNotMatch(nav, /AccountCommercialNavGroup/);
  });

  it("payments route is distinct from commercial overview", () => {
    assert.equal(accountCommercialRoutes.payments, "/bank/account/$accountId/commercial/payments");
    assert.notEqual(
      accountCommercialPath("acc-1", "payments"),
      accountCommercialPath("acc-1"),
    );
  });

  it("invoice and payment-link workflows use ResponsiveBankAction", () => {
    const invoice = read("components/bank/merchant-invoices/merchant-invoice-workflow.tsx");
    const links = read("components/bank/payment-links/payment-link-workflow.tsx");
    assert.match(invoice, /ResponsiveBankAction/);
    assert.match(links, /ResponsiveBankAction/);
  });
});
