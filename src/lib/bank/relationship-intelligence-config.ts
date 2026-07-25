import type { RelationshipTierCode } from "@/lib/bank/relationship-intelligence-types";

/** Maximum relationship score (not a credit score). */
export const RELATIONSHIP_SCORE_MAX = 1000;

export const RELATIONSHIP_SCORE_BASE = 100;

export const RELATIONSHIP_TIER_THRESHOLDS: Record<
  Exclude<RelationshipTierCode, "PRIVATE_CLIENT">,
  number
> = {
  NEW: 0,
  STANDARD: 250,
  PREFERRED: 500,
  PREMIER: 700,
  /** Top score band; no longer assigned as a tier, kept as the Premier progress ceiling. */
  PRIVATE_ELIGIBLE: 850,
};

/** Minimum total Alta assets (USD) for top-band relationship recommendations. */
export const RELATIONSHIP_TOP_BAND_MIN_ASSETS = 250_000;

export const RELATIONSHIP_SCORE_WEIGHTS = {
  assetsPer10k: 2,
  assetsCap: 250,
  lifetimeDepositsPer10k: 1.5,
  lifetimeDepositsCap: 150,
  altaPayPer5k: 2,
  altaPayCap: 100,
  productHeld: 15,
  productsCap: 90,
  paidLoan: 25,
  paidLoansCap: 75,
  activeLoanBonus: 20,
  relationshipYear: 25,
  relationshipYearsCap: 100,
  businessAccountOwnership: 40,
  verifiedCompany: 25,
  delinquentCard: -150,
  defaultedLoan: -200,
  restrictedAccount: -100,
  overdueInstallment: -25,
  overdueInstallmentsCap: -100,
  failedAutopay: -40,
  negativeAccountStatus: -75,
} as const;

export function relationshipTierFromScore(score: number): RelationshipTierCode {
  if (score >= RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return "PREMIER";
  if (score >= RELATIONSHIP_TIER_THRESHOLDS.PREFERRED) return "PREFERRED";
  if (score >= RELATIONSHIP_TIER_THRESHOLDS.STANDARD) return "STANDARD";
  return "NEW";
}

export const RELATIONSHIP_TIER_LABELS: Record<RelationshipTierCode, string> = {
  NEW: "Standard",
  STANDARD: "Standard",
  PREFERRED: "Preferred",
  PREMIER: "Premier",
  /** Legacy stored codes retained for historical rows; both display as Premier. */
  PRIVATE_ELIGIBLE: "Premier",
  PRIVATE_CLIENT: "Premier",
};

export const RELATIONSHIP_INTELLIGENCE_JOB_KEY = "relationship_intelligence";
