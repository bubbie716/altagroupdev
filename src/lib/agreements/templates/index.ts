import path from "node:path";
import type { AgreementFieldData, AgreementTemplateDefinition } from "@/lib/agreements/agreement-types";

function formatAmount(raw: string): string {
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildPersonalLoanReplacements(fields: AgreementFieldData): Record<string, string> {
  const borrowerDisplay = fields.companyName.trim()
    ? `${fields.borrowerName} (${fields.companyName.trim()})`
    : fields.borrowerName;

  return {
    "[BORROWER NAME]": borrowerDisplay,
    "[DATE]": fields.loanDate || fields.maturityDate,
    "[LOAN ID/REFERENCE NUMBER]": fields.loanId,
    "$[AMOUNT]": `$${formatAmount(fields.principalAmount)}`,
    "[AMOUNT]": formatAmount(fields.principalAmount),
    "[X.XX]% per [annum/week/month/quarter]": fields.interestRateLine,
    "[Simple/Compound]": fields.interestType,
    "[If compound: Daily/Weekly/Monthly/Quarterly]": fields.compoundingPeriod,
    "[Fixed/Variable - if variable, specify adjustment mechanism]": fields.interestRateVariability,
    "[X] [days/weeks/months/years] from [DATE]": fields.loanDurationLine,
    "[Describe payment schedule, e.g., \"Monthly interest payments with principal due at maturity\" or \"Amortised monthly payments of principal and interest\"]":
      fields.repaymentTerms,
    "[List all collateral items in format: \"item_id (current/future, holder)\"]": fields.collateral,
    "[X.XX]% per day per payment, calculated on the overdue payment amount": `${fields.latePaymentInterest}% per day per payment, calculated on the overdue payment amount`,
    "[Specify any restrictions, e.g., \"Loan proceeds must be used solely for [purpose]\" or \"No restrictions\"]":
      fields.useRestrictions,
    "[BOND ID] OR [N/A - Not Securitised]": fields.bondId,
    "[Any additional negotiated terms]": fields.additionalTerms,
  };
}

export const PERSONAL_LOAN_AGREEMENT_TEMPLATE: AgreementTemplateDefinition = {
  slug: "personal_loan_agreement",
  label: "Personal Loan Agreement",
  templatePath: path.join(process.cwd(), "docs/templates/loan-agreement-template.pdf"),
  productTypes: ["PERSONAL_CREDIT_LINE", "PRIVATE_LIQUIDITY_LINE"],
  requiredFields: [
    "borrowerName",
    "loanId",
    "loanDate",
    "principalAmount",
    "interestRateLine",
    "interestType",
    "loanDurationLine",
    "maturityDate",
    "repaymentTerms",
    "firstPaymentDate",
    "collateral",
    "latePaymentInterest",
    "lenderOfficerName",
    "lenderOfficerTitle",
  ],
  buildReplacements: buildPersonalLoanReplacements,
};

const TEMPLATES: AgreementTemplateDefinition[] = [PERSONAL_LOAN_AGREEMENT_TEMPLATE];

export function getAgreementTemplate(slug: string): AgreementTemplateDefinition {
  const template = TEMPLATES.find((t) => t.slug === slug);
  if (!template) throw new Error(`BAD_REQUEST:Unknown agreement template: ${slug}`);
  return template;
}

export function resolveAgreementTemplateForProduct(
  productType: string,
): AgreementTemplateDefinition {
  const template = TEMPLATES.find((t) => t.productTypes.includes(productType as never));
  if (!template) {
    throw new Error(`BAD_REQUEST:No agreement template configured for product ${productType}`);
  }
  return template;
}

export function listAgreementTemplates(): AgreementTemplateDefinition[] {
  return TEMPLATES;
}
