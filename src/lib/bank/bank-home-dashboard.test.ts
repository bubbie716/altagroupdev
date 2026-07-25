import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_HOME_PRIMARY_LINKS,
  BANK_MOBILE_NAV_ITEMS,
  buildBankSecondaryNavItems,
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
  it("limits primary nav to Home, Accounts, and Activity", () => {
    assert.deepEqual(
      BANK_HOME_PRIMARY_LINKS.map((l) => l.label),
      ["Home", "Accounts", "Activity"],
    );
  });

  it("keeps secondary destinations reachable from the account menu", () => {
    const items = buildBankSecondaryNavItems({
      creditDesk: {
        showLendingNav: true,
        showAltaCardNav: true,
        creditDeskClosed: false,
        showApplyEntryPoints: true,
      },
      showInternal: true,
    });
    const tos = items.map((i) => i.to);
    assert.ok(tos.includes("/bank/alta-card"));
    assert.ok(tos.includes("/bank/lending"));
    assert.ok(tos.includes("/bank/products"));
    assert.ok(tos.includes("/bank/statements"));
    assert.ok(tos.includes("/bank/settings"));
    assert.ok(tos.includes("/internal"));
  });

  it("keeps mobile nav to four slots including More", () => {
    assert.equal(BANK_MOBILE_NAV_ITEMS.length, 4);
    assert.ok(BANK_MOBILE_NAV_ITEMS.some((i) => i.kind === "more"));
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
