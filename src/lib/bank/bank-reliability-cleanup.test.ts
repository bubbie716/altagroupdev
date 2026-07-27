import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  loanTermMonthsForProduct,
  LOAN_PRODUCT_REPAYMENT_GUIDANCE,
} from "./lending-types.ts";
import { validateLendingWizardStep } from "./lending-wizard-validation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("bank reliability cleanup contracts", () => {
  it("removes standalone Pay from Bank home while Move money keeps Pay someone", () => {
    const home = read("components/bank/bank-home-dashboard.tsx");
    assert.doesNotMatch(home, /action="pay"/);
    assert.match(home, /MoveMoneyChooser/);
    const moveMoney = read("components/bank/actions/flows/move-money-action-flow.tsx");
    assert.match(moveMoney, /Pay someone/);
    const accountActions = read("components/bank/account-quick-actions.tsx");
    assert.match(accountActions, /Transfer/);
    assert.match(accountActions, /Deposit/);
    assert.match(accountActions, /Withdraw/);
    assert.doesNotMatch(accountActions, /action: "pay"/);
  });

  it("simplifies Lending navigation across Lending / Applications / Loans", () => {
    const overview = read("routes/bank/lending/index.tsx");
    assert.match(overview, /HeaderApplyButton|Apply for credit/);
    assert.match(overview, /\/bank\/lending/);
    assert.match(overview, /LendingApplyWorkflow/);
    assert.doesNotMatch(overview, /My Loans/);
    assert.doesNotMatch(overview, /My Applications/);
    assert.doesNotMatch(overview, /ApplyAction/);

    const subNav = read("components/bank/bank-sub-nav.tsx");
    assert.match(subNav, /label: "Lending"/);
    assert.match(subNav, /Applications/);
    assert.match(subNav, /Loans/);
    assert.doesNotMatch(subNav, /path === "\/bank\/lending"/);

    const layout = read("components/bank/bank-page-layout.tsx");
    assert.doesNotMatch(layout, /=== "\/bank\/lending"\) return false/);
  });

  it("exposes Details and Apply on mobile Lending product cards with correct product preselect", () => {
    const overview = read("routes/bank/lending/index.tsx");
    assert.match(overview, /aria-label=\{`Details for \$\{productItem\.name\}`\}/);
    assert.match(overview, /ariaLabel=\{`Apply for \$\{productItem\.name\}`\}/);
    assert.match(overview, /min-h-11/);
    assert.match(overview, /flex w-full shrink-0 gap-2 sm:w-auto/);
    assert.match(overview, /withApplySearch\(prev, productCode \? \{ product: productCode \}/);
    assert.match(overview, /Apply for Personal Credit Line/);
    assert.match(overview, /Apply for Business Credit Line/);
    assert.match(overview, /ApplyFromProductDetails/);
  });

  it("routes Alta Card mutations through shared process-state after confirmation", () => {
    const payment = read("components/bank/alta-card/alta-card-payment-panel.tsx");
    const advance = read("components/bank/alta-card/alta-card-cash-advance-panel.tsx");
    const autopay = read("components/bank/alta-card/alta-card-autopay-panel.tsx");
    const freeze = read("components/bank/actions/flows/card-freeze-action-flow.tsx");
    const processUi = read("components/bank/actions/bank-process-ui.tsx");

    for (const source of [payment, advance, autopay, freeze]) {
      assert.match(source, /BankActionProcessing/);
      assert.match(source, /submittingLockRef/);
      assert.match(source, /BankProcessError/);
    }

    assert.match(payment, /Processing payment…/);
    assert.match(advance, /Processing cash advance…/);
    assert.match(autopay, /Saving Autopay…/);
    assert.match(freeze, /Freezing card…/);
    assert.match(freeze, /Unfreezing card…/);

    // After confirm, review buttons must not drive the inline spinner presentation.
    assert.match(payment, /view === "submitting"/);
    assert.match(advance, /view === "submitting"/);
    assert.match(autopay, /view === "submitting"/);
    assert.doesNotMatch(payment, /submitting=\{true\}/);
    assert.doesNotMatch(advance, /submitting=\{true\}/);
    assert.doesNotMatch(autopay, /SUBMITTING_COPY\.saving/);

    assert.match(payment, /setView\("review"\)/);
    assert.match(advance, /setView\("review"\)/);
    assert.match(autopay, /setView\("form"\)/);
    assert.match(payment, /retryLabel="Try again"/);
    assert.match(advance, /retryLabel="Try again"/);
    assert.match(autopay, /retryLabel="Try again"/);

    assert.match(processUi, /prefers-reduced-motion|motion-reduce:animate-none/);
    assert.doesNotMatch(processUi, /M36 10l8 6-8 6/);
  });

  it("uses product-specific lending terms without duplicated repayment copy", () => {
    const personal = loanTermMonthsForProduct("personal_credit_line");
    assert.equal(personal.defaultMonths, 6);
    assert.equal(personal.max, 6);
    const business = loanTermMonthsForProduct("business_credit_line");
    assert.equal(business.defaultMonths, 8);
    assert.equal(business.max, 8);

    assert.match(
      LOAN_PRODUCT_REPAYMENT_GUIDANCE.personal_credit_line,
      /Typical repayment term: up to 6 months/,
    );
    assert.doesNotMatch(
      LOAN_PRODUCT_REPAYMENT_GUIDANCE.personal_credit_line,
      /^Repayment Typical/,
    );

    assert.equal(
      validateLendingWizardStep(
        "amount",
        {
          productType: "personal_credit_line",
          companyId: "",
          linkedBankAccountId: "a1",
          requestedAmount: "1000",
          termMonths: "12",
          purpose: "",
          repaymentPlan: "",
          collateralDescription: "",
          notes: "",
        },
        { companiesCount: 0, filteredAccountsCount: 1 },
      ).valid,
      false,
    );

    const workflow = read("components/bank/lending-apply-workflow.tsx");
    assert.doesNotMatch(workflow, /Repayment \{LOAN_PRODUCT_REPAYMENT_GUIDANCE/);
    assert.match(workflow, /setStepError\(null\)/);
  });

  it("uses a single progress-ring process presentation without arrow transfer graphic", () => {
    const processUi = read("components/bank/actions/bank-process-ui.tsx");
    assert.match(processUi, /BankProcessGraphic/);
    assert.match(processUi, /spin_1\.1s_linear_infinite/);
    assert.doesNotMatch(processUi, /M36 10l8 6-8 6/);
    assert.match(processUi, /prefers-reduced-motion|motion-reduce:animate-none/);
    assert.match(processUi, /Clock3/);
    assert.match(processUi, /AlertCircle/);
    assert.match(processUi, /Check/);
  });

  it("formats APR once and protects Autopay dirty close", () => {
    const summary = read("components/bank/alta-card/alta-card-statement-summary.tsx");
    assert.match(summary, /formatAltaCardRate\(card\.interestRate\)/);
    assert.doesNotMatch(summary, /formatAltaCardRate\(card\.interestRate\) APR/);

    const manage = read("components/bank/alta-card/alta-card-manage-sheet.tsx");
    assert.match(manage, /dirty=\{view === "autopay" && autopayDirty/);
    assert.match(manage, /onPhaseChange=\{setAutopayPhase\}/);
    assert.match(manage, /phase=\{sheetPhase\}/);
    const autopay = read("components/bank/alta-card/alta-card-autopay-panel.tsx");
    assert.match(autopay, /onDirtyChange/);
    assert.match(autopay, /onPhaseChange/);
  });

  it("persists UI Lab card overlays and isolates Discord delivery", () => {
    const state = read("lib/bank/ui-lab-alta-card-state.ts");
    assert.match(state, /applyUiLabAltaCardFreeze/);
    assert.match(state, /applyUiLabAltaCardPayment/);
    assert.match(state, /applyUiLabAltaCardCashAdvance/);
    assert.match(state, /mergeUiLabAltaCardRow/);

    const bridge = read("lib/staff-audit/audit-log-discord-bridge.ts");
    assert.match(bridge, /isUiLabMode\(\)/);
    assert.match(bridge, /VITE_UI_LAB_MODE/);
  });

  it("uses business Alta Card modal workflow and resolves company names", () => {
    const workflow = read("components/bank/alta-card/alta-card-apply-workflow.tsx");
    assert.match(workflow, /ResponsiveBankAction/);
    assert.match(workflow, /Review/);
    const companyRoute = read("routes/bank/alta-card/business/$companyId/index.tsx");
    assert.match(companyRoute, /resolveCompanyDisplayName|resolveUiLabCompanyName/);
    const goldHero = read("components/bank/alta-card/alta-card-landing-hero.tsx");
    assert.doesNotMatch(goldHero, /Private Banking|separate project|dedicated private/i);
  });
});
