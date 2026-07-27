import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_HOME_PRIMARY_LINKS,
  BANK_MOBILE_NAV_ITEMS,
  buildBankAccountMenuItems,
  buildBankDesktopPrimaryLinks,
  buildBankMobileMoreItems,
} from "./bank-primary-nav.ts";
import {
  buildBankHomeContextOptions,
  companiesFromAccounts,
  filterAccountsForContext,
  filterTransactionsForContext,
  resolveInitialBankHomeContext,
  sumAvailableBalance,
  type BankHomeContextId,
} from "./bank-home-context.ts";
import type { UserBankAccount, UserBankTransaction } from "./backend-types.ts";

function account(partial: Partial<UserBankAccount> & Pick<UserBankAccount, "id">): UserBankAccount {
  return {
    accountName: "Account",
    accountType: "checking",
    accountTypeLabel: "Checking",
    accountNumber: "1234567890",
    routingNumber: "000000000",
    balance: 100,
    availableBalance: 100,
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
    name: "Account",
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

describe("bank home navigation", () => {
  it("includes Alta Card, Lending, Statements, and Settings when credit desk permits", () => {
    const links = buildBankDesktopPrimaryLinks({
      showLendingNav: true,
      showAltaCardNav: true,
      creditDeskClosed: false,
      showApplyEntryPoints: true,
    });
    assert.deepEqual(
      links.map((l) => l.label),
      ["Home", "Accounts", "Activity", "Alta Card", "Lending", "Statements", "Settings"],
    );
  });

  it("hides Alta Card and Lending when credit desk gates them off", () => {
    const closed = buildBankDesktopPrimaryLinks({
      showLendingNav: false,
      showAltaCardNav: false,
      creditDeskClosed: true,
      showApplyEntryPoints: false,
    });
    assert.deepEqual(
      closed.map((l) => l.label),
      ["Home", "Accounts", "Activity", "Statements", "Settings"],
    );
  });

  it("labels Loans and routes to loans when credit desk is closed but loans exist", () => {
    const links = buildBankDesktopPrimaryLinks({
      showLendingNav: true,
      showAltaCardNav: false,
      creditDeskClosed: true,
      showApplyEntryPoints: false,
    });
    const lending = links.find((l) => l.label === "Loans");
    assert.ok(lending);
    assert.equal(lending?.to, "/bank/lending/loans");
  });

  it("keeps core Home Accounts Activity as the ungated baseline", () => {
    assert.deepEqual(
      BANK_HOME_PRIMARY_LINKS.map((l) => l.label),
      ["Home", "Accounts", "Activity"],
    );
  });

  it("keeps account menu focused on products and account links", () => {
    const items = buildBankAccountMenuItems({ showInternal: true });
    const tos = items.map((i) => i.to);
    assert.ok(tos.includes("/bank/products"));
    assert.equal(items.find((i) => i.label === "Profile")?.to, "/profile");
    assert.equal(items.find((i) => i.label === "Companies")?.to, "/companies");
    assert.equal(items.find((i) => i.label === "Support")?.to, "/support");
    assert.ok(tos.includes("/internal"));
    assert.equal(tos.includes("/bank/alta-card"), false);
    assert.equal(tos.includes("/bank/lending"), false);
    assert.equal(tos.includes("/bank/statements"), false);
    assert.equal(tos.includes("/bank/settings"), false);
  });

  it("keeps mobile More menu for products, statements, and settings", () => {
    const items = buildBankMobileMoreItems();
    const tos = items.map((i) => i.to);
    assert.deepEqual(tos, ["/bank/products", "/bank/statements", "/bank/settings"]);
  });

  it("keeps mobile nav to four slots including More", () => {
    assert.equal(BANK_MOBILE_NAV_ITEMS.length, 4);
    assert.ok(BANK_MOBILE_NAV_ITEMS.some((i) => i.kind === "more"));
    assert.deepEqual(
      BANK_MOBILE_NAV_ITEMS.filter((i) => i.kind === "link").map((i) => i.label),
      ["Home", "Accounts", "Activity"],
    );
  });
});

describe("bank home context", () => {
  const accounts = [
    account({ id: "a1", availableBalance: 50, balance: 50 }),
    account({
      id: "a2",
      availableBalance: 200,
      balance: 200,
      companyId: "CO-ALTG",
      companyName: "Alta Group N.V.",
      isCompanyAccount: true,
    }),
    account({
      id: "a3",
      availableBalance: 75,
      balance: 75,
      companyId: "CO-NPC",
      companyName: "Newport Petroleum Corp.",
      isCompanyAccount: true,
    }),
  ];

  it("derives company options from authorized accounts only", () => {
    const companies = companiesFromAccounts(accounts);
    assert.deepEqual(
      companies.map((c) => c.id).sort(),
      ["CO-ALTG", "CO-NPC"],
    );
  });

  it("defaults to personal when stored context is missing", () => {
    const options = buildBankHomeContextOptions(companiesFromAccounts(accounts));
    assert.equal(resolveInitialBankHomeContext(null, options), "personal");
  });

  it("filters personal context without company accounts", () => {
    const scoped = filterAccountsForContext(accounts, "personal");
    assert.deepEqual(
      scoped.map((a) => a.id),
      ["a1"],
    );
    assert.equal(sumAvailableBalance(scoped), 50);
  });

  it("filters company context to one authorized company", () => {
    const scoped = filterAccountsForContext(accounts, "company:CO-NPC" as BankHomeContextId);
    assert.deepEqual(
      scoped.map((a) => a.id),
      ["a3"],
    );
    assert.equal(sumAvailableBalance(scoped), 75);
  });

  it("limits recent activity to five items for the selected context", () => {
    const txs = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      referenceCode: `R${i}`,
      bankAccountId: i < 6 ? "a1" : "a2",
      accountName: "Account",
      accountNumber: "1234",
      type: "deposit" as const,
      typeLabel: "Deposit",
      amount: 10,
      status: "approved" as const,
      statusLabel: "Approved",
      description: `Tx ${i}`,
      memo: null,
      proofImageUrl: null,
      proofFileName: null,
      proofUploadedAt: null,
      hasProof: false,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNote: null,
    })) satisfies UserBankTransaction[];

    const personalAccounts = filterAccountsForContext(accounts, "personal");
    const scoped = filterTransactionsForContext(txs, personalAccounts).slice(0, 5);
    assert.equal(scoped.length, 5);
    assert.ok(scoped.every((tx) => tx.bankAccountId === "a1"));
  });

  it("reconciles all-accounts balance from active accounts only", () => {
    const withFrozen = [
      ...accounts,
      account({ id: "frozen", availableBalance: 999, balance: 999, status: "frozen" }),
    ];
    assert.equal(sumAvailableBalance(filterAccountsForContext(withFrozen, "all")), 325);
  });
});
