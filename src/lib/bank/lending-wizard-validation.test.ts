import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLendingApplyFormDirty,
  validateLendingWizardStep,
  type LendingWizardFormValues,
} from "./lending-wizard-validation.ts";

const baseValues: LendingWizardFormValues = {
  productType: "personal_credit_line",
  companyId: "",
  linkedBankAccountId: "",
  requestedAmount: "",
  termMonths: "6",
  purpose: "",
  repaymentPlan: "",
  collateralDescription: "",
  notes: "",
};

describe("validateLendingWizardStep", () => {
  it("requires a company for business credit lines", () => {
    const result = validateLendingWizardStep(
      "product",
      { ...baseValues, productType: "business_credit_line", companyId: "" },
      { companiesCount: 1, filteredAccountsCount: 1 },
    );
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.field, "companyId");
    }
  });

  it("requires a positive amount", () => {
    const result = validateLendingWizardStep(
      "amount",
      { ...baseValues, requestedAmount: "0", termMonths: "6" },
      { companiesCount: 0, filteredAccountsCount: 1 },
    );
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.field, "requestedAmount");
  });

  it("rejects term above product maximum", () => {
    const result = validateLendingWizardStep(
      "amount",
      { ...baseValues, requestedAmount: "50000", termMonths: "12" },
      { companiesCount: 0, filteredAccountsCount: 1 },
    );
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.field, "termMonths");
      assert.match(result.message, /between 1 and 6 months/);
    }
  });

  it("rejects term above business product maximum", () => {
    const result = validateLendingWizardStep(
      "amount",
      {
        ...baseValues,
        productType: "business_credit_line",
        requestedAmount: "50000",
        termMonths: "12",
      },
      { companiesCount: 1, filteredAccountsCount: 1 },
    );
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.field, "termMonths");
      assert.match(result.message, /between 1 and 8 months/);
    }
  });

  it("requires purpose and repayment plan", () => {
    assert.equal(
      validateLendingWizardStep(
        "purpose",
        { ...baseValues, purpose: "  ", repaymentPlan: "Monthly" },
        { companiesCount: 0, filteredAccountsCount: 1 },
      ).valid,
      false,
    );
    assert.equal(
      validateLendingWizardStep(
        "purpose",
        { ...baseValues, purpose: "Inventory", repaymentPlan: "  " },
        { companiesCount: 0, filteredAccountsCount: 1 },
      ).valid,
      false,
    );
  });

  it("passes valid amount step", () => {
    assert.equal(
      validateLendingWizardStep(
        "amount",
        { ...baseValues, requestedAmount: "50000", termMonths: "6" },
        { companiesCount: 0, filteredAccountsCount: 1 },
      ).valid,
      true,
    );
  });
});

describe("isLendingApplyFormDirty", () => {
  it("is clean at initial snapshot", () => {
    assert.equal(isLendingApplyFormDirty({ values: baseValues, initial: baseValues }), false);
  });

  it("is dirty when any field changes", () => {
    assert.equal(
      isLendingApplyFormDirty({
        values: { ...baseValues, requestedAmount: "1000" },
        initial: baseValues,
      }),
      true,
    );
  });
});
