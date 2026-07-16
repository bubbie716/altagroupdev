import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest } from "@/server/ncc/ncc-api-http";
import { apiListSettlementAccounts } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/institution/settlement-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/institution/settlement-accounts",
          method: "GET",
          requiredScope: "accounts:read",
          rateLimitClass: "read",
          handler: async (ctx) => apiListSettlementAccounts(ctx),
        }),
    },
  },
});
