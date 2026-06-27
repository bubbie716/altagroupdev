import type { AltaCardRelationshipRecommendation } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";

/** Maps numeric relationship score (0–100) to a letter grade for display. */
export function formatRelationshipScoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export type RelationshipRecommendationDisplayRow = {
  label: string;
  value: string;
};

export function mapRelationshipRecommendationToDisplayRows(
  recommendation: AltaCardRelationshipRecommendation,
): RelationshipRecommendationDisplayRow[] {
  return [
    {
      label: "Recommended tier",
      value: ALTA_CARD_TIER_LABELS[recommendation.recommendedTier],
    },
    {
      label: "Recommended credit limit",
      value: formatAltaCardCurrency(recommendation.recommendedCreditLimit),
    },
    {
      label: "Recommended interest rate",
      value: formatAltaCardRate(recommendation.recommendedInterestRate),
    },
    {
      label: "Relationship score",
      value: formatRelationshipScoreGrade(recommendation.relationshipScore),
    },
  ];
}
