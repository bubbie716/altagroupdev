import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDepositFormDirty,
  isOpenAccountFormDirty,
  isPayFormDirty,
  isTransferFormDirty,
  isWithdrawFormDirty,
} from "./bank-action-dirty.ts";
import {
  closeAllBankWorkflows,
  countOpenBankWorkflows,
  registerBankWorkflow,
} from "../ui/bank-workflow-registry.ts";

describe("isPayFormDirty", () => {
  const clean = {
    amount: "",
    memo: "",
    hasSelectedRecipient: false,
    fundingKey: "bank_account:a1",
    initialFundingKey: "bank_account:a1",
  };

  it("is clean at initial values", () => {
    assert.equal(isPayFormDirty(clean), false);
  });

  it("is dirty with only an amount", () => {
    assert.equal(isPayFormDirty({ ...clean, amount: "12" }), true);
  });

  it("is dirty with only a recipient", () => {
    assert.equal(isPayFormDirty({ ...clean, hasSelectedRecipient: true }), true);
  });

  it("is dirty with only a note", () => {
    assert.equal(isPayFormDirty({ ...clean, memo: "rent" }), true);
  });

  it("is dirty when source account changes", () => {
    assert.equal(
      isPayFormDirty({ ...clean, fundingKey: "bank_account:a2" }),
      true,
    );
  });

  it("returns clean when fields are restored to initial", () => {
    assert.equal(
      isPayFormDirty({
        amount: "  ",
        memo: "",
        hasSelectedRecipient: false,
        fundingKey: "bank_account:a1",
        initialFundingKey: "bank_account:a1",
      }),
      false,
    );
  });
});

describe("isTransferFormDirty", () => {
  const initial = {
    amount: "",
    memo: "",
    timing: "now" as const,
    fromAccountId: "p1",
    toAccountId: "p2",
    scheduledDate: "",
    scheduledTime: "09:00",
    frequency: "monthly",
  };

  it("is dirty with only an amount and clean when restored", () => {
    assert.equal(
      isTransferFormDirty({ ...initial, amount: "50", initial }),
      true,
    );
    assert.equal(isTransferFormDirty({ ...initial, amount: "", initial }), false);
  });

  it("is dirty when accounts change", () => {
    assert.equal(
      isTransferFormDirty({ ...initial, fromAccountId: "p2", toAccountId: "p1", initial }),
      true,
    );
  });
});

describe("isDepositFormDirty / isWithdrawFormDirty / isOpenAccountFormDirty", () => {
  it("deposit amount alone is dirty", () => {
    assert.equal(
      isDepositFormDirty({
        amount: "10",
        hasProofFile: false,
        bankAccountId: "a1",
        initialBankAccountId: "a1",
      }),
      true,
    );
  });

  it("withdraw destination alone is dirty", () => {
    assert.equal(
      isWithdrawFormDirty({
        amount: "",
        destination: "External bank notes",
        bankAccountId: "a1",
        initialBankAccountId: "a1",
      }),
      true,
    );
  });

  it("open account product change is dirty even without a name", () => {
    assert.equal(
      isOpenAccountFormDirty({
        accountName: "",
        ownership: "personal",
        accountType: "checking",
        companyId: "",
        initial: {
          accountName: "",
          ownership: "personal",
          accountType: "alta_access",
          companyId: "",
        },
      }),
      true,
    );
  });
});

describe("bank workflow registry single-active invariant", () => {
  it("closes an existing workflow when closeAllBankWorkflows runs", () => {
    let paymentOpen = true;
    let freezeOpen = false;
    const unsubPayment = registerBankWorkflow(() => {
      paymentOpen = false;
    });
    assert.equal(countOpenBankWorkflows(), 1);

    // Simulate Freeze launch: close all Bank workflows, then open Freeze.
    closeAllBankWorkflows();
    assert.equal(paymentOpen, false);
    assert.equal(countOpenBankWorkflows(), 0);

    freezeOpen = true;
    const unsubFreeze = registerBankWorkflow(() => {
      freezeOpen = false;
    });
    assert.equal(countOpenBankWorkflows(), 1);
    assert.equal(freezeOpen, true);

    unsubPayment();
    unsubFreeze();
    closeAllBankWorkflows();
  });

  it("keeps at most one registered closer after sequential opens", () => {
    const closed: string[] = [];
    const unsubA = registerBankWorkflow(() => closed.push("a"));
    closeAllBankWorkflows();
    assert.equal(countOpenBankWorkflows(), 0);
    unsubA();
    const unsubB = registerBankWorkflow(() => closed.push("b"));
    assert.equal(countOpenBankWorkflows(), 1);
    closeAllBankWorkflows();
    assert.deepEqual(closed, ["a", "b"]);
    assert.equal(countOpenBankWorkflows(), 0);
    unsubB();
  });
});
