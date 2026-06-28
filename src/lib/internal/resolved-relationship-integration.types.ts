import type { RelationshipIntegrationBundle } from "@/lib/internal/relationship-integration.types";
import type { CompanyRelationshipIntegrationBundle } from "@/lib/internal/company-relationship-integration.types";

export type ResolvedRelationshipIntegration =
  | { scope: "personal"; bundle: RelationshipIntegrationBundle }
  | { scope: "company"; bundle: CompanyRelationshipIntegrationBundle };
