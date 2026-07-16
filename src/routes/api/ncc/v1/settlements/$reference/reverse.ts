import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest, readJsonBody } from "@/server/ncc/ncc-api-http";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import { apiRequestReversal } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/settlements/$reference/reverse")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/settlements/:reference/reverse",
          method: "POST",
          requiredScope: "settlements:reverse",
          rateLimitClass: "settlement_reverse",
          requireLive: true,
          params: { reference: params.reference },
          handler: async (ctx, req, p) => {
            const body = await readJsonBody<{ reason?: string }>(req, ["reason"]);
            if (typeof body.reason !== "string" || !body.reason.trim()) {
              throw new NccApiError("REVERSAL_REASON_REQUIRED", "A non-empty reversal reason is required.", 400);
            }
            return apiRequestReversal(ctx, p.reference!, body.reason);
          },
        }),
    },
  },
});
