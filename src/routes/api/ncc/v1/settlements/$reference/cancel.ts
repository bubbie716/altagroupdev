import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest, readJsonBody } from "@/server/ncc/ncc-api-http";
import { apiCancelSettlement } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/settlements/$reference/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/settlements/:reference/cancel",
          method: "POST",
          requiredScope: "settlements:cancel",
          rateLimitClass: "settlement_cancel",
          requireLive: true,
          params: { reference: params.reference },
          handler: async (ctx, req, p) => {
            const body = await readJsonBody<{ reason?: string }>(req, ["reason"]);
            return apiCancelSettlement(
              ctx,
              p.reference!,
              typeof body.reason === "string" ? body.reason : "API cancellation",
            );
          },
        }),
    },
  },
});
