import type {
  PreApprovalReadiness,
  RelationshipIntelligencePanelData,
  RelationshipRecommendationRow,
} from "@/lib/bank/relationship-intelligence-types";

export type RelationshipIntegrationBundle = {
  panel: RelationshipIntelligencePanelData;
  recommendations: RelationshipRecommendationRow[];
  preApprovalReadiness: PreApprovalReadiness | null;
};
