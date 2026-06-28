export type RelationshipIntegrationScope = "personal" | "company";

export function resolveRelationshipIntegrationScope(input: {
  companyId?: string | null;
}): RelationshipIntegrationScope {
  return input.companyId ? "company" : "personal";
}
