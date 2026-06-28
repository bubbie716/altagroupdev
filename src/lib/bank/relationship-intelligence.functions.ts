import { createServerFn } from "@tanstack/react-start";

export const fetchCustomerRelationshipView = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/server/auth.service");
  const { getCustomerRelationshipView } = await import("@/server/relationship-intelligence.service");
  const user = await requireAuth();
  return getCustomerRelationshipView(user.id);
});

export const fetchRelationshipProfileSummary = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getRelationshipProfileSummary } = await import("@/server/relationship-intelligence.service");
    return getRelationshipProfileSummary(userId);
  });
