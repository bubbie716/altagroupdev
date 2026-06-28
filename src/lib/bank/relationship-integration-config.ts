import type { RelationshipRecommendationTypeCode } from "@/lib/bank/relationship-intelligence-types";

export type RelationshipIntegrationContext =
  | "ALTA_CARD"
  | "LENDING"
  | "PRIVATE_BANKING"
  | "CUSTOMER_PROFILE";

export const CONTEXT_RECOMMENDATION_TYPES: Record<
  RelationshipIntegrationContext,
  RelationshipRecommendationTypeCode[]
> = {
  ALTA_CARD: ["ALTA_CARD_TIER", "ALTA_CARD_LIMIT", "ALTA_CARD_RATE", "PRODUCT_OPPORTUNITY"],
  LENDING: ["LOAN_PRE_APPROVAL", "PRODUCT_OPPORTUNITY"],
  PRIVATE_BANKING: ["PRIVATE_BANKING_INVITE"],
  CUSTOMER_PROFILE: [
    "ALTA_CARD_TIER",
    "ALTA_CARD_LIMIT",
    "ALTA_CARD_RATE",
    "LOAN_PRE_APPROVAL",
    "PRIVATE_BANKING_INVITE",
    "PRODUCT_OPPORTUNITY",
  ],
};

export const CONTEXT_LABELS: Record<RelationshipIntegrationContext, string> = {
  ALTA_CARD: "Alta Card review",
  LENDING: "Lending review",
  PRIVATE_BANKING: "Private banking review",
  CUSTOMER_PROFILE: "Customer profile",
};
