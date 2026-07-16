import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest } from "@/server/ncc/ncc-api-http";
import { apiGetSettlement } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/settlements/$reference/")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/settlements/:reference",
          method: "GET",
          requiredScope: "settlements:read",
          rateLimitClass: "read",
          params: { reference: params.reference },
          handler: async (ctx, _req, p) => apiGetSettlement(ctx, p.reference!),
        }),
    },
  },
});
