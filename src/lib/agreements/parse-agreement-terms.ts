import type { LoanProductType as DbLoanProductType } from "@prisma/client";
import type { AgreementFieldData } from "@/lib/agreements/agreement-types";
import { getAgreementTemplate } from "@/lib/agreements/templates";

export type ParsedAgreementLoanTerms = {
  loanReferenceId: string;
  principalAmount: number;
  interestRate: number;
  interestType: string;
  termMonths: number;
  paymentFrequency: string;
  repaymentTerms: string;
  collateralDescription: string;
  latePaymentInterestRate: number;
  firstPaymentDueDate: Date;
  maturityDate: Date;
  minimumPayment: number;
  productType: DbLoanProductType;
};

function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseInterestRate(line: string): number {
  const match = line.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : 0;
}

function parseTermMonths(line: string): number {
  const match = line.match(/([0-9]+)\s*months?/i);
  if (match) return Number(match[1]);
  const years = line.match(/([0-9]+)\s*years?/i);
  if (years) return Number(years[1]) * 12;
  return 0;
}

function parseDateField(raw: string, fallback: Date): Date {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function inferPaymentFrequency(repaymentTerms: string): string {
  const lower = repaymentTerms.toLowerCase();
  if (lower.includes("weekly")) return "Weekly";
  if (lower.includes("quarter")) return "Quarterly";
  if (lower.includes("annual") || lower.includes("annually")) return "Annual";
  return "Monthly";
}

/** Parse executable loan terms from officer-approved agreement field data only. */
export function parseAgreementLoanTerms(
  fieldData: AgreementFieldData,
  templateSlug: string,
): ParsedAgreementLoanTerms {
  const template = getAgreementTemplate(templateSlug);
  const productType = template.productTypes[0];
  if (!productType) {
    throw new Error("BAD_REQUEST:Agreement template has no product type mapping.");
  }

  const principalAmount = parseAmount(fieldData.principalAmount);
  const interestRate = parseInterestRate(fieldData.interestRateLine);
  const termMonths = parseTermMonths(fieldData.loanDurationLine);
  const now = new Date();
  const firstPaymentDueDate = parseDateField(fieldData.firstPaymentDate, addMonths(now, 1));
  const maturityDate = parseDateField(fieldData.maturityDate, addMonths(now, termMonths));
  const latePaymentInterestRate = parseInterestRate(fieldData.latePaymentInterest);
  const minimumPayment =
    termMonths > 0 ? Math.round((principalAmount / termMonths) * 100) / 100 : principalAmount;

  return {
    loanReferenceId: fieldData.loanId.trim(),
    principalAmount,
    interestRate,
    interestType: fieldData.interestType.trim() || "Simple",
    termMonths,
    paymentFrequency: inferPaymentFrequency(fieldData.repaymentTerms),
    repaymentTerms: fieldData.repaymentTerms.trim(),
    collateralDescription: fieldData.collateral.trim(),
    latePaymentInterestRate,
    firstPaymentDueDate,
    maturityDate,
    minimumPayment,
    productType,
  };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function validateParsedAgreementTerms(terms: ParsedAgreementLoanTerms): void {
  if (terms.principalAmount <= 0) {
    throw new Error("BAD_REQUEST:Agreement principal amount must be greater than zero.");
  }
  if (terms.interestRate <= 0) {
    throw new Error("BAD_REQUEST:Agreement interest rate must be greater than zero.");
  }
  if (terms.termMonths <= 0) {
    throw new Error("BAD_REQUEST:Agreement loan term must be greater than zero.");
  }
  if (!terms.loanReferenceId) {
    throw new Error("BAD_REQUEST:Agreement loan reference ID is required.");
  }
}
