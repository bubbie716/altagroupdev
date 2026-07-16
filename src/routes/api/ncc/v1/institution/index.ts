import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest } from "@/server/ncc/ncc-api-http";
import { apiGetInstitution } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/institution/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/institution",
          method: "GET",
          requiredScope: "institution:read",
          rateLimitClass: "read",
          handler: async (ctx) => apiGetInstitution(ctx),
        }),
    },
  },
});
