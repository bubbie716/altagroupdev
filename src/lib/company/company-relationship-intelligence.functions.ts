import { createServerFn } from "@tanstack/react-start";

export const fetchCustomerCompanyRelationshipView = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCustomerCompanyRelationshipView } = await import(
      "@/server/company-relationship-intelligence.service"
    );
    const user = await requireAuth();
    return getCustomerCompanyRelationshipView(companyId, user.id);
  });

export const fetchCustomerCompanyRelationshipTimeline = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { prisma } = await import("@/server/db");
    const { ensureCompanyRelationshipTimelineBackfilled, getCustomerCompanyRelationshipTimeline } =
      await import("@/server/company-relationship-timeline.service");
    const user = await requireAuth();
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!membership) {
      const { requireOperator } = await import("@/server/permissions.service");
      await requireOperator();
    }
    try {
      await ensureCompanyRelationshipTimelineBackfilled(companyId);
    } catch {
      // Timeline backfill is best-effort on company relationship page load.
    }
    return getCustomerCompanyRelationshipTimeline(companyId);
  });
