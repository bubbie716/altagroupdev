import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  formatAccountOptionPrimary,
  resolvePreferredAccountId,
  resolveTransferPair,
} from "./bank-action-account-context.ts";
import {
  getUiLabPayableRecipients,
} from "./bank-action-ui-lab.ts";
import {
  hasOpenNestedOverlay,
  isNestedOverlayElement,
  OVERLAY_LAYER,
  overlayZClass,
} from "../ui/overlay-layers.ts";
import type { UserBankAccount } from "./backend-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function account(
  partial: Partial<UserBankAccount> & Pick<UserBankAccount, "id" | "accountName">,
): UserBankAccount {
  return {
    accountType: "checking",
    accountTypeLabel: "Checking",
    accountNumber: "AB-5000-000001",
    routingNumber: "000000000",
    balance: 1000,
    availableBalance: 1000,
    status: "active",
    statusLabel: "Active",
    currency: "FLR",
    companyId: null,
    companyName: null,
    isCompanyAccount: false,
    openingNotes: null,
    restrictDeposits: false,
    restrictWithdrawals: false,
    restrictTransfers: false,
    createdAt: new Date().toISOString(),
    recentActivity: "",
    name: partial.accountName,
    product: "Checking",
    type: "checking",
    interestAccrualEnabled: false,
    interestRateLabel: null,
    accountStatusInfo: {
      accountStatus: "active",
      headline: "Active",
      notices: [],
      inGoodStanding: true,
      hasIssues: false,
      restrictDeposits: false,
      restrictWithdrawals: false,
      restrictTransfers: false,
      heldFunds: 0,
      pendingWithdrawals: 0,
    },
    ...partial,
  };
}

describe("overlay layering", () => {
  it("keeps nested portals above bank action dialogs", () => {
    assert.ok(OVERLAY_LAYER.nestedPortal > OVERLAY_LAYER.bankAction);
    assert.ok(OVERLAY_LAYER.critical > OVERLAY_LAYER.nestedPortal);
    assert.equal(overlayZClass("nestedPortal"), "z-[140]");
  });

  it("marks select/dropdown/popover content as nested overlays", () => {
    assert.match(read("components/ui/select.tsx"), /data-alta-overlay="nested"/);
    assert.match(read("components/ui/select.tsx"), /overlayZClass\("nestedPortal"\)/);
    assert.match(read("components/ui/dropdown-menu.tsx"), /data-alta-overlay="nested"/);
    assert.match(read("components/ui/popover.tsx"), /data-alta-overlay="nested"/);
  });

  it("ignores nested overlay outside interactions on bank actions", () => {
    const shell = read("components/bank/actions/responsive-bank-action.tsx");
    assert.match(shell, /isNestedOverlayElement/);
    assert.match(shell, /hasOpenNestedOverlay/);
  });

  it("detects nested overlay elements", () => {
    assert.equal(isNestedOverlayElement(null), false);
    assert.equal(hasOpenNestedOverlay(), false);
  });
});

describe("account context resolution", () => {
  const personalA = account({
    id: "p1",
    accountName: "Personal Checking",
    availableBalance: 500,
  });
  const personalB = account({
    id: "p2",
    accountName: "Personal Savings",
    availableBalance: 2000,
    accountNumber: "AB-5000-000002",
  });
  const companyA = account({
    id: "c1",
    accountName: "Treasury",
    companyId: "CO-1",
    companyName: "Acme",
    isCompanyAccount: true,
    availableBalance: 50_000,
    accountNumber: "AB-3500-000001",
  });
  const companyB = account({
    id: "c2",
    accountName: "Ops",
    companyId: "CO-2",
    companyName: "Beta",
    isCompanyAccount: true,
    availableBalance: 12_000,
    accountNumber: "AB-3500-000002",
  });
  const closed = account({
    id: "closed",
    accountName: "Closed",
    status: "closed",
    statusLabel: "Closed",
  });

  const all = [companyA, personalA, personalB, companyB, closed];

  it("prefers explicit accountId", () => {
    assert.equal(
      resolvePreferredAccountId(all, { accountId: "p2", workspace: "personal" }),
      "p2",
    );
  });

  it("does not silently pick a company treasury from personal workspace", () => {
    assert.equal(resolvePreferredAccountId(all, { workspace: "personal" }), "p1");
  });

  it("scopes company workspace to that company only", () => {
    assert.equal(
      resolvePreferredAccountId(all, { workspace: "company:CO-2" }),
      "c2",
    );
    assert.equal(
      resolvePreferredAccountId(all, { companyId: "CO-1" }),
      "c1",
    );
  });

  it("ignores closed accounts", () => {
    assert.equal(
      resolvePreferredAccountId([closed, personalA], { workspace: "personal" }),
      "p1",
    );
  });

  it("builds transfer pairs without same-account from/to", () => {
    const pair = resolveTransferPair([personalA, personalB], { workspace: "personal" });
    assert.equal(pair.fromAccountId, "p1");
    assert.equal(pair.toAccountId, "p2");
    assert.notEqual(pair.fromAccountId, pair.toAccountId);
  });

  it("keeps transfer destinations in the same ownership scope when possible", () => {
    const companyA2 = account({
      id: "c1b",
      accountName: "Operating",
      companyId: "CO-1",
      companyName: "Acme",
      isCompanyAccount: true,
      availableBalance: 8_000,
      accountNumber: "AB-3500-000099",
    });
    const pair = resolveTransferPair([companyA, personalA, companyB, companyA2], {
      accountId: "c1",
    });
    assert.equal(pair.fromAccountId, "c1");
    assert.equal(pair.toAccountId, "c1b");
    assert.notEqual(pair.toAccountId, "p1");
    assert.notEqual(pair.toAccountId, "c2");
  });

  it("formats concise primary account labels", () => {
    assert.equal(formatAccountOptionPrimary(personalA), "Personal Checking");
  });
});

describe("pay and transfer workflow reliability", () => {
  it("move-money chooser promotes nested flows to details phase", () => {
    const move = read("components/bank/actions/flows/move-money-action-flow.tsx");
    assert.match(move, /setPhase\("details"\)/);
    assert.match(move, /openBranch/);
    assert.match(move, /Nested Transfer\/Pay footers only mount on phase === "details"/);
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    assert.match(transfer, /Continue/);
    assert.match(transfer, /phase === "details"/);
  });

  it("transfer scopes account lists to workspace context", () => {
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    assert.match(transfer, /listAccountsForActionContext/);
    assert.match(transfer, /listTransferDestinations/);
    assert.match(transfer, /BankActionProcessing/);
    assert.match(transfer, /phase === "submitting"/);
    assert.match(transfer, /submittingLockRef/);
    const processingIdx = transfer.indexOf('if (phase === "submitting")');
    const detailsMarker = transfer.lastIndexOf('return (\n    <div className="space-y-5">');
    assert.ok(processingIdx > 0);
    assert.ok(detailsMarker > processingIdx);
    // Review footer is confirm-only (header owns Back).
    assert.match(transfer, /Confirm transfer/);
    assert.match(transfer, /Header Back only/);
  });

  it("transfer renders an explicit processing state", () => {
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    assert.match(transfer, /phase === "submitting"/);
    assert.match(transfer, /BankActionProcessing/);
    assert.match(transfer, /submittingLockRef/);
  });

  it("pay owns a single authoritative workflow without AltaPayForm", () => {
    const pay = read("components/bank/actions/flows/pay-action-flow.tsx");
    assert.match(pay, /BankActionProcessing/);
    assert.match(pay, /phase === "submitting"/);
    assert.match(pay, /Confirm payment/);
    assert.doesNotMatch(pay, /<AltaPayForm/);
    assert.match(pay, /dirty && phase !== "success"/);
    assert.match(pay, /scopeFundingSources/);
  });

  it("account quick actions launch modal workflows", () => {
    const quick = read("components/bank/account-quick-actions.tsx");
    assert.match(quick, /BankActionLauncher/);
    assert.doesNotMatch(quick, /\/bank\/transfers/);
    assert.doesNotMatch(quick, /to: "\/bank\/deposit"/);
  });

  it("hides header Move money on Bank Home", () => {
    const nav = read("components/bank/bank-top-nav.tsx");
    assert.match(nav, /pathname !== "\/bank"/);
  });

  it("provides deterministic UI Lab recipients", () => {
    const hits = getUiLabPayableRecipients("ava");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.name, "Ava Chen");
    assert.deepEqual(getUiLabPayableRecipients("zzz"), []);
    assert.ok(getUiLabPayableRecipients("alta").some((r) => r.kind === "company"));
  });
});

describe("listAccountsForActionContext ownership", () => {
  it("personal workspace excludes company accounts from transfer lists", async () => {
    const { listAccountsForActionContext, listTransferDestinations } = await import(
      "./bank-action-account-context.ts"
    );
    const personalA = account({ id: "p1", accountName: "Personal Checking" });
    const personalB = account({
      id: "p2",
      accountName: "Money Market",
      accountType: "money_market",
    });
    const companyA = account({
      id: "c1",
      accountName: "Treasury",
      companyId: "CO-1",
      companyName: "Alta Group",
      isCompanyAccount: true,
    });
    const all = [personalA, personalB, companyA];
    const sources = listAccountsForActionContext(all, { workspace: "personal" }, "transfer_source");
    assert.deepEqual(
      sources.map((a) => a.id),
      ["p1", "p2"],
    );
    const destinations = listTransferDestinations(all, { workspace: "personal" }, "p1");
    assert.deepEqual(
      destinations.map((a) => a.id),
      ["p2"],
    );
  });

  it("account-detail context locks ownership to that account's scope", async () => {
    const { listAccountsForActionContext, resolvePreferredAccountId } = await import(
      "./bank-action-account-context.ts"
    );
    const personalA = account({ id: "p1", accountName: "Everyday Checking" });
    const personalB = account({ id: "p2", accountName: "Money Market" });
    const companyA = account({
      id: "c1",
      accountName: "Treasury",
      companyId: "CO-1",
      companyName: "Alta Group",
      isCompanyAccount: true,
    });
    const preferred = resolvePreferredAccountId(
      [personalA, personalB, companyA],
      { accountId: "p1" },
      "transfer_source",
    );
    assert.equal(preferred, "p1");
    const listed = listAccountsForActionContext(
      [personalA, personalB, companyA],
      { accountId: "p1" },
      "transfer_source",
    );
    assert.ok(listed.every((a) => !a.companyId));
    assert.ok(listed.some((a) => a.id === "p1"));
  });
});
