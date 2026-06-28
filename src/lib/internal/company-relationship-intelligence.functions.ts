import { createServerFn } from "@tanstack/react-start";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchAdminCompanyRelationshipDetail = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getAdminCompanyRelationshipDetail } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    return getAdminCompanyRelationshipDetail(companyId);
  });

export const refreshCompanyRelationshipProfileRecord = createServerFn({ method: "POST" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { refreshCompanyRelationshipProfile } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    const actor = await actorId();
    return refreshCompanyRelationshipProfile(companyId, actor);
  });

export const fetchCompanyRelationshipRecommendations = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyRelationshipRecommendations } = await import(
      "@/server/company-relationship-recommendation.service"
    );
    return getCompanyRelationshipRecommendations(companyId, { status: "ALL" });
  });

export const generateCompanyRelationshipRecommendationsRecord = createServerFn({ method: "POST" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { generateCompanyRelationshipRecommendations } = await import(
      "@/server/company-relationship-recommendation.service"
    );
    const actor = await actorId();
    return generateCompanyRelationshipRecommendations(companyId, actor);
  });

export const fetchCompanyRelationshipTimeline = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyRelationshipTimeline } = await import(
      "@/server/company-relationship-timeline.service"
    );
    return getCompanyRelationshipTimeline(companyId);
  });

export const backfillCompanyRelationshipTimelineRecord = createServerFn({ method: "POST" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { backfillCompanyRelationshipTimeline } = await import(
      "@/server/company-relationship-timeline.service"
    );
    return backfillCompanyRelationshipTimeline(companyId);
  });

export const dismissCompanyRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((recommendationId: string) => recommendationId)
  .handler(async ({ data: recommendationId }) => {
    const { dismissCompanyRelationshipRecommendation } = await import(
      "@/server/company-relationship-recommendation.service"
    );
    const actor = await actorId();
    return dismissCompanyRelationshipRecommendation(recommendationId, actor);
  });

export const markCompanyRecommendationReviewedRecord = createServerFn({ method: "POST" })
  .inputValidator((recommendationId: string) => recommendationId)
  .handler(async ({ data: recommendationId }) => {
    const { markCompanyRecommendationReviewed } = await import(
      "@/server/company-relationship-recommendation.service"
    );
    const actor = await actorId();
    return markCompanyRecommendationReviewed(recommendationId, actor);
  });

export const acceptCompanyRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((recommendationId: string) => recommendationId)
  .handler(async ({ data: recommendationId }) => {
    const { acceptCompanyRelationshipRecommendation } = await import(
      "@/server/company-relationship-recommendation.service"
    );
    const actor = await actorId();
    return acceptCompanyRelationshipRecommendation(recommendationId, actor);
  });

export const fetchCompanyRelationshipProfileSummariesForCompanies = createServerFn({ method: "GET" })
  .inputValidator((companyIds: string[]) => companyIds)
  .handler(async ({ data: companyIds }) => {
    const { getCompanyRelationshipProfileSummariesForCompanies } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    return getCompanyRelationshipProfileSummariesForCompanies(companyIds);
  });

export const useCompanyRelationshipRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { recommendationId: string; context: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { useCompanyRelationshipRecommendation } = await import(
      "@/server/company-relationship-intelligence-integration.service"
    );
    await requireOperator();
    const actor = await actorId();
    return useCompanyRelationshipRecommendation(
      data.recommendationId,
      actor,
      data.context as import("@/lib/bank/relationship-integration-config").RelationshipIntegrationContext,
    );
  });

export const recordCompanyPreApprovalReadinessViewedRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; context: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { recordCompanyPreApprovalReadinessViewed } = await import(
      "@/server/company-relationship-intelligence-integration.service"
    );
    await requireOperator();
    const actor = await actorId();
    return recordCompanyPreApprovalReadinessViewed(
      data.companyId,
      actor,
      data.context as import("@/lib/bank/relationship-integration-config").RelationshipIntegrationContext,
    );
  });

export const fetchCompanyRelationshipIntelligenceDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getCompanyRelationshipIntelligenceDashboard } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    return getCompanyRelationshipIntelligenceDashboard();
  },
);
