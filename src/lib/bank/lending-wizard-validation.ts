import type { LoanProductTypeCode } from "@/lib/bank/lending-types";
import { loanTermMonthsForProduct } from "@/lib/bank/lending-types";

export const LENDING_WIZARD_STEPS = [
  { id: "product", label: "Product", shortLabel: "Product" },
  { id: "amount", label: "Amount & account", shortLabel: "Amount" },
  { id: "purpose", label: "Purpose & repayment", shortLabel: "Purpose" },
  { id: "review", label: "Review", shortLabel: "Review" },
] as const;

export type LendingWizardStepId = (typeof LENDING_WIZARD_STEPS)[number]["id"];

export type LendingWizardFormValues = {
  productType: LoanProductTypeCode;
  companyId: string;
  linkedBankAccountId: string;
  requestedAmount: string;
  termMonths: string;
  purpose: string;
  repaymentPlan: string;
  collateralDescription: string;
  notes: string;
};

export type LendingWizardValidationContext = {
  companiesCount: number;
  filteredAccountsCount: number;
};

export type LendingWizardValidationResult =
  | { valid: true }
  | { valid: false; field: string; message: string };

export function validateLendingWizardStep(
  step: LendingWizardStepId,
  values: LendingWizardFormValues,
  context: LendingWizardValidationContext,
): LendingWizardValidationResult {
  if (step === "product") {
    if (values.productType === "business_credit_line") {
      if (context.companiesCount === 0) {
        return {
          valid: false,
          field: "companyId",
          message: "A verified company with Owner, Executive, or Finance Manager access is required.",
        };
      }
      if (!values.companyId.trim()) {
        return { valid: false, field: "companyId", message: "Select a company." };
      }
    }
    return { valid: true };
  }

  if (step === "amount") {
    const principal = Number(values.requestedAmount);
    if (!Number.isFinite(principal) || principal <= 0) {
      return {
        valid: false,
        field: "requestedAmount",
        message: "Enter a requested amount greater than zero.",
      };
    }
    const { min, max } = loanTermMonthsForProduct(values.productType);
    const months = Number(values.termMonths);
    if (!Number.isInteger(months) || months < min || months > max) {
      return {
        valid: false,
        field: "termMonths",
        message: `Term must be between ${min} and ${max} months.`,
      };
    }
    if (context.filteredAccountsCount === 0) {
      return {
        valid: false,
        field: "linkedBankAccountId",
        message: "Open an active Alta Bank account to link disbursement and servicing.",
      };
    }
    return { valid: true };
  }

  if (step === "purpose") {
    if (!values.purpose.trim()) {
      return { valid: false, field: "purpose", message: "Purpose is required." };
    }
    if (!values.repaymentPlan.trim()) {
      return { valid: false, field: "repaymentPlan", message: "Repayment plan is required." };
    }
    return { valid: true };
  }

  return { valid: true };
}

export type LendingApplyFormDirtyInput = {
  values: LendingWizardFormValues;
  initial: LendingWizardFormValues;
};

export function isLendingApplyFormDirty(input: LendingApplyFormDirtyInput): boolean {
  const { values, initial } = input;
  if (values.productType !== initial.productType) return true;
  if (values.companyId !== initial.companyId) return true;
  if (values.linkedBankAccountId !== initial.linkedBankAccountId) return true;
  if (values.requestedAmount.trim() !== initial.requestedAmount.trim()) return true;
  if (values.termMonths.trim() !== initial.termMonths.trim()) return true;
  if (values.purpose.trim() !== initial.purpose.trim()) return true;
  if (values.repaymentPlan.trim() !== initial.repaymentPlan.trim()) return true;
  if (values.collateralDescription.trim() !== initial.collateralDescription.trim()) return true;
  if (values.notes.trim() !== initial.notes.trim()) return true;
  return false;
}

export function lendingProductNameToCode(name: string): LoanProductTypeCode | undefined {
  if (name === "Personal Credit Line") return "personal_credit_line";
  if (name === "Business Credit Line") return "business_credit_line";
  return undefined;
}
