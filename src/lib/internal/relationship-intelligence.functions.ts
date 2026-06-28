import { createServerFn } from "@tanstack/react-start";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchRelationshipIntelligenceDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRelationshipIntelligenceDashboard } = await import(
      "@/server/relationship-intelligence.service"
    );
    return getRelationshipIntelligenceDashboard();
  },
);

export const fetchAdminRelationshipDetail = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getAdminRelationshipDetail } = await import("@/server/relationship-intelligence.service");
    return getAdminRelationshipDetail(userId);
  });

export const refreshRelationshipProfileRecord = createServerFn({ method: "POST" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { refreshRelationshipProfile } = await import("@/server/relationship-intelligence.service");
    await requireOperator();
    const actor = await actorId();
    return refreshRelationshipProfile(userId, actor);
  });

export const refreshAllRelationshipProfilesRecord = createServerFn({ method: "POST" }).handler(
  async () => {
    const { refreshAllRelationshipProfilesAdmin } = await import(
      "@/server/relationship-intelligence.service"
    );
    const actor = await actorId();
    return refreshAllRelationshipProfilesAdmin(actor);
  },
);

export const fetchRelationshipIntegrationBundle = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string; context: string }) => input)
  .handler(async ({ data }) => {
    const { getRelationshipIntegrationBundle } = await import(
      "@/server/relationship-intelligence-integration.service"
    );
    return getRelationshipIntegrationBundle(
      data.userId,
      data.context as import("@/lib/bank/relationship-intelligence-types").RelationshipIntegrationContext,
    );
  });

export const fetchResolvedRelationshipIntegration = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string; companyId?: string | null; context: string }) => input)
  .handler(async ({ data }) => {
    const { getResolvedRelationshipIntegration } = await import(
      "@/server/company-relationship-intelligence-integration.service"
    );
    return getResolvedRelationshipIntegration({
      userId: data.userId,
      companyId: data.companyId ?? null,
      context: data.context as import("@/lib/bank/relationship-integration-config").RelationshipIntegrationContext,
    });
  });

/** Loads relationship integration without failing the parent page when unavailable. */
export async function fetchResolvedRelationshipIntegrationBestEffort(input: {
  userId: string;
  companyId?: string | null;
  context: string;
}) {
  try {
    return await fetchResolvedRelationshipIntegration({ data: input });
  } catch {
    return null;
  }
}

export const fetchApplicationRelationshipSummaries = createServerFn({ method: "GET" })
  .inputValidator(
    (items: Array<{ companyId: string | null; applicantUserId: string }>) => items,
  )
  .handler(async ({ data: items }) => {
    const personalUserIds = [
      ...new Set(items.filter((item) => !item.companyId).map((item) => item.applicantUserId)),
    ];
    const companyIds = [
      ...new Set(
        items
          .map((item) => item.companyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [{ getRelationshipProfileSummariesForUsers }, { getCompanyRelationshipProfileSummariesForCompanies }] =
      await Promise.all([
        import("@/server/relationship-intelligence.service"),
        import("@/server/company-relationship-intelligence.service"),
      ]);

    const [personal, company] = await Promise.all([
      getRelationshipProfileSummariesForUsers(personalUserIds),
      getCompanyRelationshipProfileSummariesForCompanies(companyIds),
    ]);

    return { personal, company };
  });

export const fetchLoanBorrowerRelationshipSummary = createServerFn({ method: "GET" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { prisma } = await import("@/server/db");
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { borrowerUserId: true, companyId: true },
    });
    if (!loan?.borrowerUserId) {
      return { userId: null as string | null, companyId: null as string | null };
    }
    return { userId: loan.borrowerUserId, companyId: loan.companyId };
  });

export const fetchRelationshipRecommendations = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getRelationshipRecommendations } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    return getRelationshipRecommendations(userId, { status: "ALL" });
  });

export const generateRelationshipRecommendationsRecord = createServerFn({ method: "POST" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { generateRelationshipRecommendations } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    await requireOperator();
    const actor = await actorId();
    return generateRelationshipRecommendations(userId, actor);
  });

export const dismissRelationshipRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { dismissRelationshipRecommendation } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    await requireOperator();
    const actor = await actorId();
    return dismissRelationshipRecommendation(data.id, actor);
  });

export const markRelationshipRecommendationReviewedRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { markRecommendationReviewed } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    await requireOperator();
    const actor = await actorId();
    return markRecommendationReviewed(data.id, actor);
  });

export const acceptRelationshipRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { acceptRelationshipRecommendation } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    await requireOperator();
    const actor = await actorId();
    return acceptRelationshipRecommendation(data.id, actor);
  });

export const refreshAllRelationshipRecommendationsRecord = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { refreshRecommendationsForAllProfiles } = await import(
      "@/server/relationship-intelligence-recommendation.service"
    );
    await requireOperator();
    const actor = await actorId();
    return refreshRecommendationsForAllProfiles(actor);
  },
);

export const fetchRelationshipTimeline = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getRelationshipTimeline } = await import("@/server/relationship-timeline.service");
    return getRelationshipTimeline(userId);
  });

export const backfillRelationshipTimelineRecord = createServerFn({ method: "POST" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { backfillRelationshipTimeline } = await import("@/server/relationship-timeline.service");
    await requireOperator();
    const actor = await actorId();
    return backfillRelationshipTimeline(userId, actor);
  });

export const createManualRelationshipNoteRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; title: string; body: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { createManualRelationshipNote } = await import("@/server/relationship-timeline.service");
    await requireOperator();
    const actor = await actorId();
    return createManualRelationshipNote(data.userId, { title: data.title, body: data.body }, actor);
  });

export const useRelationshipRecommendationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { recommendationId: string; context: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { useRelationshipRecommendation } = await import(
      "@/server/relationship-intelligence-integration.service"
    );
    await requireOperator();
    const actor = await actorId();
    return useRelationshipRecommendation(
      data.recommendationId,
      actor,
      data.context as import("@/lib/bank/relationship-intelligence-types").RelationshipIntegrationContext,
    );
  });

export const recordPreApprovalReadinessViewedRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; context: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { recordPreApprovalReadinessViewed } = await import(
      "@/server/relationship-intelligence-integration.service"
    );
    await requireOperator();
    const actor = await actorId();
    return recordPreApprovalReadinessViewed(
      data.userId,
      actor,
      data.context as import("@/lib/bank/relationship-intelligence-types").RelationshipIntegrationContext,
    );
  });

export const fetchRelationshipOperatorPanel = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getRelationshipIntegrationBundle } = await import(
      "@/server/relationship-intelligence-integration.service"
    );
    const { getRelationshipTimeline } = await import("@/server/relationship-timeline.service");
    const { prisma } = await import("@/server/db");
    const [bundle, timeline] = await Promise.all([
      getRelationshipIntegrationBundle(userId, "CUSTOMER_PROFILE"),
      getRelationshipTimeline(userId),
    ]);
    const card = await prisma.altaCard.findFirst({
      where: { ownerUserId: userId, status: { notIn: ["CLOSED", "EXPIRED"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return { ...bundle, timelinePreview: timeline.slice(0, 8), altaCardId: card?.id ?? null };
  });

export const fetchRelationshipProfileSummariesForUsers = createServerFn({ method: "GET" })
  .inputValidator((userIds: string[]) => userIds)
  .handler(async ({ data: userIds }) => {
    const { getRelationshipProfileSummariesForUsers } = await import(
      "@/server/relationship-intelligence.service"
    );
    return getRelationshipProfileSummariesForUsers(userIds);
  });
