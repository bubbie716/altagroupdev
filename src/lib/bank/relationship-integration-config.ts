import type { RelationshipRecommendationTypeCode } from "@/lib/bank/relationship-intelligence-types";

export type RelationshipIntegrationContext = "ALTA_CARD" | "LENDING" | "CUSTOMER_PROFILE";

export const CONTEXT_RECOMMENDATION_TYPES: Record<
  RelationshipIntegrationContext,
  RelationshipRecommendationTypeCode[]
> = {
  ALTA_CARD: ["ALTA_CARD_TIER", "ALTA_CARD_LIMIT", "ALTA_CARD_RATE", "PRODUCT_OPPORTUNITY"],
  LENDING: ["LOAN_PRE_APPROVAL", "PRODUCT_OPPORTUNITY"],
  CUSTOMER_PROFILE: [
    "ALTA_CARD_TIER",
    "ALTA_CARD_LIMIT",
    "ALTA_CARD_RATE",
    "LOAN_PRE_APPROVAL",
    "PRODUCT_OPPORTUNITY",
  ],
};

export const CONTEXT_LABELS: Record<RelationshipIntegrationContext, string> = {
  ALTA_CARD: "Alta Card review",
  LENDING: "Lending review",
  CUSTOMER_PROFILE: "Customer profile",
};
