import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest } from "@/server/ncc/ncc-api-http";
import { apiListRoutingNumbers } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/institution/routing-numbers")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/institution/routing-numbers",
          method: "GET",
          requiredScope: "routing:read",
          rateLimitClass: "read",
          handler: async (ctx) => apiListRoutingNumbers(ctx),
        }),
    },
  },
});
