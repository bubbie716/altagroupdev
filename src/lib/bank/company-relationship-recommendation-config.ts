import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { CalculatedCompanyRelationshipProfile } from "@/lib/bank/company-relationship-intelligence-types";
import {
  COMPANY_RELATIONSHIP_TIER_THRESHOLDS,
  computeCommercialBankingEligible,
} from "@/lib/bank/company-relationship-intelligence-config";

export type CompanyRecommendationReasonPayload = {
  bullets: string[];
  actionPath?: { label: string; href: string };
};

export const COMPANY_RECOMMENDATION_TYPE_LABELS = {
  BUSINESS_ALTA_CARD_LIMIT: "Business card limit",
  BUSINESS_ALTA_CARD_RATE: "Business card rate",
  BUSINESS_LOAN_OPPORTUNITY: "Business lending",
  TREASURY_PRODUCT_OPPORTUNITY: "Treasury products",
  COMMERCIAL_BANKING_ELIGIBILITY: "Commercial banking",
} as const;

export const BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME = 50_000;

export function computeRecommendedBusinessCreditLimit(
  profile: CalculatedCompanyRelationshipProfile,
  currentLimit: number,
): number {
  const assetBoost = Math.floor(profile.totalBusinessAssets / 25_000) * 2_500;
  const scoreBoost = Math.floor(profile.relationshipScore / 100) * 1_000;
  const suggested = Math.max(currentLimit, 10_000 + assetBoost + scoreBoost);
  return Math.min(suggested, 500_000);
}

export function computeRecommendedBusinessInterestRate(profile: CalculatedCompanyRelationshipProfile): number {
  if (profile.relationshipScore >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return 16.99;
  if (profile.relationshipScore >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREFERRED) return 18.99;
  return 21.99;
}

export function qualifiesForBusinessLoanOpportunity(profile: CalculatedCompanyRelationshipProfile): boolean {
  return (
    profile.relationshipScore >= 400 &&
    profile.productHoldings.activeBusinessAccounts > 0 &&
    profile.lifetimeDeposits >= 10_000
  );
}

export function qualifiesForCommercialBankingInvite(profile: CalculatedCompanyRelationshipProfile): boolean {
  return computeCommercialBankingEligible(profile.relationshipScore, profile.totalBusinessAssets);
}

export function computeBusinessLoanOpportunityConfidence(profile: CalculatedCompanyRelationshipProfile): number {
  let score = 40;
  if (profile.relationshipScore >= 500) score += 20;
  if (profile.productHoldings.paidOffBusinessLoans > 0) score += 15;
  if (profile.lifetimeAltaPayVolume >= BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME) score += 15;
  if (profile.currentCreditExposure < profile.totalBusinessAssets * 0.5) score += 10;
  return Math.min(score, 95);
}

export function computeCommercialBankingInviteConfidence(profile: CalculatedCompanyRelationshipProfile): number {
  let score = 50;
  if (profile.totalBusinessAssets >= 500_000) score += 20;
  if (profile.lifetimeAltaPayVolume >= 100_000) score += 15;
  if (profile.productHoldings.activeBusinessCards > 0) score += 10;
  return Math.min(score, 98);
}

export function recommendedBusinessCardTierFromRelationship(
  profile: CalculatedCompanyRelationshipProfile,
): AltaCardTierCode {
  if (profile.relationshipScore >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.COMMERCIAL_ELIGIBLE) return "black";
  if (profile.relationshipScore >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return "navy";
  return "standard";
}

export const COMPANY_CUSTOMER_OPPORTUNITY_COPY = {
  commercialReview: "Your company may be eligible for Alta Commercial Banking review.",
  businessLending: "Your company relationship may support a business lending review.",
  altaPayGrowth: "Strong Alta Pay activity — treasury products may be available in the future.",
} as const;
