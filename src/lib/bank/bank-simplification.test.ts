import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  BANK_MOBILE_NAV_ITEMS,
  buildBankDesktopPrimaryLinks,
} from "./bank-primary-nav.ts";
import { LENDING_WIZARD_STEPS } from "./lending-wizard-validation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("bank simplification contracts", () => {
  it("keeps mobile nav as Home / Accounts / Activity / More", () => {
    assert.deepEqual(
      BANK_MOBILE_NAV_ITEMS.filter((i) => i.kind === "link").map((i) => i.label),
      ["Home", "Accounts", "Activity"],
    );
    assert.equal(BANK_MOBILE_NAV_ITEMS.at(-1)?.kind, "more");
  });

  it("gates desktop Alta Card and Lending and keeps Statements / Settings", () => {
    const open = buildBankDesktopPrimaryLinks({
      showLendingNav: true,
      showAltaCardNav: true,
      creditDeskClosed: false,
      showApplyEntryPoints: true,
    });
    assert.deepEqual(
      open.map((l) => l.label),
      ["Home", "Accounts", "Activity", "Alta Card", "Lending", "Statements", "Settings"],
    );

    const gated = buildBankDesktopPrimaryLinks({
      showLendingNav: false,
      showAltaCardNav: false,
      creditDeskClosed: false,
      showApplyEntryPoints: false,
    });
    assert.deepEqual(
      gated.map((l) => l.label),
      ["Home", "Accounts", "Activity", "Statements", "Settings"],
    );
  });

  it("uses a four-step lending wizard with one step body at a time", () => {
    assert.deepEqual(
      LENDING_WIZARD_STEPS.map((s) => s.id),
      ["product", "amount", "purpose", "review"],
    );
    const workflow = read("components/bank/lending-apply-workflow.tsx");
    assert.match(workflow, /currentStepId === "product"/);
    assert.match(workflow, /currentStepId === "amount"/);
    assert.match(workflow, /currentStepId === "purpose"/);
    assert.match(workflow, /currentStepId === "review"/);
    assert.match(workflow, /Submit application/);
    assert.doesNotMatch(workflow, /fixed.*application-summary|mobile-summary-bar/i);
    assert.match(workflow, /shortLabel/);
  });

  it("preserves lending apply deep link and modal open via search", () => {
    const applyRoute = read("routes/bank/lending/apply.tsx");
    const overview = read("routes/bank/lending/index.tsx");
    assert.match(applyRoute, /redirect/);
    assert.match(applyRoute, /apply: "1"/);
    assert.match(overview, /apply === "1"/);
    assert.match(overview, /LendingApplyWorkflow/);
    assert.doesNotMatch(overview, /lending-apply-form|LendingApplyForm|LendingApplyExperience/);
  });

  it("keeps lending section nav as Lending / Applications / Loans", () => {
    const subNav = read("components/bank/bank-sub-nav.tsx");
    assert.match(subNav, /to: "\/bank\/lending"/);
    assert.match(subNav, /label: "Lending"/);
    assert.match(subNav, /Applications/);
    assert.match(subNav, /Loans/);
    assert.doesNotMatch(subNav, /to: "\/bank\/lending\/apply"/);
    assert.doesNotMatch(subNav, /label: "Apply"/);
    const layout = read("components/bank/bank-page-layout.tsx");
    assert.doesNotMatch(layout, /=== "\/bank\/lending"\) return false/);
  });

  it("keeps Manage Card as one controlled sheet with close-before-nav", () => {
    const manage = read("components/bank/alta-card/alta-card-manage-sheet.tsx");
    assert.match(manage, /ResponsiveBankAction/);
    assert.match(manage, /closeThenRun/);
    assert.match(manage, /AltaCardAutopayPanel/);
    assert.match(manage, /openAction\("card-freeze"/);

    const personal = read("components/bank/alta-card/alta-card-personal-panel.tsx");
    assert.match(personal, /AltaCardManageSheet/);
    assert.match(personal, /AltaCardAutopayStatusRow/);
    assert.match(personal, /limit=\{5\}/);
    assert.doesNotMatch(personal, /AltaCardAutopayPanel/);
  });

  it("uses simplified Alta Card acknowledgement copy", () => {
    const apply = read("components/bank/alta-card/alta-card-apply-workflow.tsx");
    assert.match(
      apply,
      /I understand that Alta Card is a revolving credit product subject to approval/,
    );
    assert.doesNotMatch(apply, /separate from term lending.*manual underwriting.*Alta relationship/);
  });

  it("does not repeat Current/Available in account balance breakdown", () => {
    const breakdown = read("components/bank/account-balance-breakdown.tsx");
    assert.match(breakdown, /Why balances differ/);
    assert.doesNotMatch(breakdown, />Current [Bb]alance</);
    assert.doesNotMatch(breakdown, />Available [Bb]alance</);
    assert.match(breakdown, /Held funds|Pending withdrawals|Unavailable/);
  });

  it("provides scoped Bank and Internal not-found states", () => {
    const bank = read("routes/bank/route.tsx");
    const internal = read("routes/internal/route.tsx");
    assert.match(bank, /This Bank page could not be found/);
    assert.match(bank, /Return to Bank/);
    assert.match(bank, /notFoundComponent/);
    assert.match(internal, /This internal page could not be found/);
    assert.match(internal, /Return to Internal Console/);
    assert.match(internal, /notFoundComponent/);
    assert.doesNotMatch(bank, /<p>Not Found<\/p>/);
  });

  it("does not restore private banking customer surfaces", () => {
    const primaryNav = read("lib/bank/bank-primary-nav.ts");
    assert.doesNotMatch(primaryNav, /Private Banking|\/bank\/private/);
    const openFlow = read("components/bank/actions/flows/open-account-action-flow.tsx");
    assert.doesNotMatch(openFlow, /Alta Gold is not a deposit account/);
  });
});
