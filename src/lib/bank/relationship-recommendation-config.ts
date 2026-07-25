import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_CONFIG, getTierDefaultLimit, getTierDefaultRate } from "@/lib/bank/alta-card-tier-config";
import type { RelationshipTierCode } from "@/lib/bank/relationship-intelligence-types";
import { RELATIONSHIP_SCORE_MAX } from "@/lib/bank/relationship-intelligence-config";

export const RELATIONSHIP_RECOMMENDATIONS_JOB_KEY = "relationship_recommendations";

export const ALTA_CARD_TIER_RANK: Record<AltaCardTierCode, number> = {
  white: 1,
  navy: 2,
  black: 3,
  gold: 4,
};

export const LOAN_PRE_APPROVAL_MIN_SCORE = 500;
export const LOAN_PRE_APPROVAL_MIN_ASSETS = 50_000;
export const LOAN_PRE_APPROVAL_MIN_DEPOSITS = 10_000;

export const BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME = 50_000;

export type RecommendationActionPath = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean | undefined>;
};

export type RecommendationReasonPayload = {
  bullets: string[];
  actionPath?: RecommendationActionPath;
};

export function recommendedAltaCardTierFromRelationship(
  relationshipTier: RelationshipTierCode,
): AltaCardTierCode {
  if (relationshipTier === "PRIVATE_CLIENT" || relationshipTier === "PRIVATE_ELIGIBLE") {
    return "gold";
  }
  if (relationshipTier === "PREMIER") return "black";
  if (relationshipTier === "PREFERRED") return "navy";
  return "white";
}

export function computeRecommendedCreditLimit(input: {
  recommendedTier: AltaCardTierCode;
  totalBankAssets: number;
  relationshipScore: number;
  currentCreditExposure: number;
}): number {
  const tierBase = getTierDefaultLimit(input.recommendedTier) ?? 100_000;
  const assetBoost = Math.min(input.totalBankAssets * 0.08, 35_000);
  const scoreBoost = Math.min((input.relationshipScore / RELATIONSHIP_SCORE_MAX) * 15_000, 15_000);
  const exposurePenalty = Math.min(input.currentCreditExposure * 0.15, 20_000);
  const raw = tierBase + assetBoost + scoreBoost - exposurePenalty;
  return Math.max(tierBase, Math.round(raw / 100) * 100);
}

export function computeRecommendedInterestRate(input: {
  recommendedTier: AltaCardTierCode;
  relationshipScore: number;
}): number {
  const baseRate = getTierDefaultRate(input.recommendedTier) ?? 14.99;
  if (input.recommendedTier === "gold") {
    return Math.max(9.99, baseRate * 0.85);
  }
  const discount = Math.min(input.relationshipScore / RELATIONSHIP_SCORE_MAX, 0.18);
  return Math.round(baseRate * (1 - discount) * 100) / 100;
}

export function computeLoanPreApprovalConfidence(input: {
  relationshipScore: number;
  totalAltaAssets: number;
  lifetimeDeposits: number;
  delinquentCards: number;
  defaultedLoans: number;
  overdueInstallments: number;
  paidOffLoans: number;
}): number {
  let confidence = 40 + Math.floor(input.relationshipScore / 15);
  if (input.totalAltaAssets >= LOAN_PRE_APPROVAL_MIN_ASSETS) confidence += 15;
  if (input.lifetimeDeposits >= LOAN_PRE_APPROVAL_MIN_DEPOSITS) confidence += 10;
  if (input.paidOffLoans > 0) confidence += 10;
  if (input.delinquentCards > 0) confidence -= 30;
  if (input.defaultedLoans > 0) confidence -= 40;
  if (input.overdueInstallments > 0) confidence -= 15;
  return Math.max(0, Math.min(100, confidence));
}

export function qualifiesForLoanPreApproval(input: {
  relationshipScore: number;
  totalAltaAssets: number;
  lifetimeDeposits: number;
  delinquentCards: number;
  defaultedLoans: number;
}): boolean {
  if (input.relationshipScore < LOAN_PRE_APPROVAL_MIN_SCORE) return false;
  if (input.delinquentCards > 0 || input.defaultedLoans > 0) return false;
  return (
    input.totalAltaAssets >= LOAN_PRE_APPROVAL_MIN_ASSETS ||
    input.lifetimeDeposits >= LOAN_PRE_APPROVAL_MIN_DEPOSITS
  );
}

export function tierLabel(tier: AltaCardTierCode): string {
  return ALTA_CARD_TIER_CONFIG[tier].label;
}

export const RECOMMENDATION_TYPE_LABELS = {
  ALTA_CARD_TIER: "Alta Card tier",
  ALTA_CARD_LIMIT: "Alta Card limit",
  ALTA_CARD_RATE: "Alta Card rate",
  LOAN_PRE_APPROVAL: "Loan pre-approval",
  PRODUCT_OPPORTUNITY: "Product opportunity",
} as const;

export const CUSTOMER_OPPORTUNITY_COPY: Record<string, string> = {
  ALTA_CARD_TIER: "You may be eligible to request an Alta Card account review.",
  ALTA_CARD_LIMIT: "You may be eligible to request an Alta Card limit review.",
  ALTA_CARD_RATE: "You may be eligible to request improved Alta Card pricing.",
  LOAN_PRE_APPROVAL: "You may qualify for preferred lending review.",
  PRODUCT_OPPORTUNITY: "Additional Alta products may be available for your relationship.",
};
