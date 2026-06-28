import type { CompanyRelationshipRecommendationRow } from "@/lib/bank/company-relationship-intelligence-types";
import type { CompanyRelationshipIntelligencePanelData } from "@/lib/bank/company-relationship-intelligence-types";
import type { PreApprovalReadiness } from "@/lib/bank/relationship-intelligence-types";

export type CompanyRelationshipIntegrationBundle = {
  panel: CompanyRelationshipIntelligencePanelData;
  recommendations: CompanyRelationshipRecommendationRow[];
  preApprovalReadiness: PreApprovalReadiness | null;
};
