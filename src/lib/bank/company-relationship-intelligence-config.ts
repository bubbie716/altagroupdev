import type { CompanyRelationshipTierCode } from "@/lib/bank/company-relationship-intelligence-types";

export const COMPANY_RELATIONSHIP_SCORE_MAX = 1000;
export const COMPANY_RELATIONSHIP_SCORE_BASE = 100;

export const COMPANY_RELATIONSHIP_TIER_THRESHOLDS: Record<CompanyRelationshipTierCode, number> = {
  NEW: 0,
  STANDARD: 250,
  PREFERRED: 500,
  PREMIER: 700,
  COMMERCIAL_ELIGIBLE: 850,
};

export const COMMERCIAL_BANKING_ELIGIBILITY_MIN_ASSETS = 250_000;

export const COMPANY_RELATIONSHIP_SCORE_WEIGHTS = {
  assetsPer10k: 2,
  assetsCap: 250,
  lifetimeDepositsPer10k: 1.5,
  lifetimeDepositsCap: 150,
  altaPayPer5k: 2,
  altaPayCap: 120,
  productHeld: 20,
  productsCap: 100,
  paidLoan: 30,
  paidLoansCap: 90,
  activeLoanBonus: 25,
  relationshipYear: 25,
  relationshipYearsCap: 100,
  verifiedCompany: 30,
  delinquentCard: -150,
  defaultedLoan: -200,
  overdueInstallment: -30,
  overdueInstallmentsCap: -120,
  failedAutopay: -40,
  suspendedCompany: -100,
} as const;

export function companyRelationshipTierFromScore(score: number): CompanyRelationshipTierCode {
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.COMMERCIAL_ELIGIBLE) return "COMMERCIAL_ELIGIBLE";
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return "PREMIER";
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREFERRED) return "PREFERRED";
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.STANDARD) return "STANDARD";
  return "NEW";
}

export function computeCommercialBankingEligible(
  score: number,
  totalBusinessAssets: number,
): boolean {
  return (
    score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.COMMERCIAL_ELIGIBLE &&
    totalBusinessAssets >= COMMERCIAL_BANKING_ELIGIBILITY_MIN_ASSETS
  );
}

export const COMPANY_RELATIONSHIP_TIER_LABELS: Record<CompanyRelationshipTierCode, string> = {
  NEW: "Standard",
  STANDARD: "Standard",
  PREFERRED: "Preferred",
  PREMIER: "Premier",
  /** Internal score band — not a customer relationship tier. */
  COMMERCIAL_ELIGIBLE: "Eligible for commercial banking",
};

export const COMPANY_RELATIONSHIP_INTELLIGENCE_JOB_KEY = "company_relationship_intelligence";
