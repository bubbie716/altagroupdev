import type { CompanyRelationshipRecommendationTypeCode } from "@/lib/bank/company-relationship-intelligence-types";
import type { RelationshipIntegrationContext } from "@/lib/bank/relationship-integration-config";

export const COMPANY_CONTEXT_RECOMMENDATION_TYPES: Record<
  RelationshipIntegrationContext,
  CompanyRelationshipRecommendationTypeCode[]
> = {
  ALTA_CARD: ["BUSINESS_ALTA_CARD_LIMIT", "BUSINESS_ALTA_CARD_RATE"],
  LENDING: ["BUSINESS_LOAN_OPPORTUNITY", "COMMERCIAL_BANKING_ELIGIBILITY"],
  PRIVATE_BANKING: [],
  CUSTOMER_PROFILE: [
    "BUSINESS_ALTA_CARD_LIMIT",
    "BUSINESS_ALTA_CARD_RATE",
    "BUSINESS_LOAN_OPPORTUNITY",
    "TREASURY_PRODUCT_OPPORTUNITY",
    "COMMERCIAL_BANKING_ELIGIBILITY",
  ],
};
