import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency, formatAltaCardRate } from "@/lib/bank/alta-card-types";
import type {
  RelationshipRecommendationRow,
  RelationshipRecommendationTypeCode,
} from "@/lib/bank/relationship-intelligence-types";
import { RECOMMENDATION_TYPE_LABELS, tierLabel } from "@/lib/bank/relationship-recommendation-config";

export function recommendationTypeLabel(type: RelationshipRecommendationTypeCode): string {
  return RECOMMENDATION_TYPE_LABELS[type];
}

export function formatRecommendedAction(rec: RelationshipRecommendationRow): string {
  const parts: string[] = [];
  if (rec.recommendedTier) parts.push(tierLabel(rec.recommendedTier as AltaCardTierCode));
  if (rec.recommendedLimit != null) parts.push(formatAltaCardCurrency(rec.recommendedLimit));
  if (rec.recommendedRate != null) parts.push(formatAltaCardRate(rec.recommendedRate));
  if (rec.recommendedProduct && parts.length === 0) parts.push(rec.recommendedProduct);
  return parts.join(" · ") || rec.summary;
}
