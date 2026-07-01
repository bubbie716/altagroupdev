import { createServerFn } from "@tanstack/react-start";

export const fetchRelationshipProfileSummary = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getRelationshipProfileSummary } = await import("@/server/relationship-intelligence.service");
    return getRelationshipProfileSummary(userId);
  });
