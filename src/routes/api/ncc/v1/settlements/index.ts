import { createFileRoute } from "@tanstack/react-router";
import { handleNccApiRequest, readJsonBody } from "@/server/ncc/ncc-api-http";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import { apiListSettlements, apiSubmitSettlement } from "@/server/ncc/ncc-api-settlement.service";

export const Route = createFileRoute("/api/ncc/v1/settlements/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/settlements",
          method: "GET",
          requiredScope: "settlements:read",
          rateLimitClass: "read",
          handler: async (ctx, req) => {
            const url = new URL(req.url);
            return apiListSettlements(ctx, {
              status: url.searchParams.get("status") ?? undefined,
              executionStatus: url.searchParams.get("executionStatus") ?? undefined,
              direction: url.searchParams.get("direction") ?? undefined,
              cursor: url.searchParams.get("cursor") ?? undefined,
              limit: url.searchParams.get("limit") ?? undefined,
            });
          },
        }),
      POST: async ({ request }) =>
        handleNccApiRequest({
          request,
          route: "/api/ncc/v1/settlements",
          method: "POST",
          requiredScope: "settlements:create",
          rateLimitClass: "settlement_submit",
          requireLive: true,
          handler: async (ctx, req) => {
            const idempotencyKey = req.headers.get("idempotency-key")?.trim();
            if (!idempotencyKey) {
              throw new NccApiError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required.", 400);
            }
            const body = await readJsonBody<{
              receivingRoutingNumber?: unknown;
              amount?: unknown;
              currency?: unknown;
              purpose?: unknown;
              externalReference?: unknown;
              sourceAccountReference?: unknown;
              destinationAccountReference?: unknown;
            }>(req, [
              "receivingRoutingNumber",
              "amount",
              "currency",
              "purpose",
              "externalReference",
              "sourceAccountReference",
              "destinationAccountReference",
            ]);
            if (typeof body.receivingRoutingNumber !== "string" || !body.receivingRoutingNumber.trim()) {
              throw new NccApiError("VALIDATION_ERROR", "receivingRoutingNumber is required.", 400);
            }
            if (typeof body.amount !== "string") {
              throw new NccApiError("VALIDATION_ERROR", "amount must be a decimal string.", 400);
            }
            for (const field of [
              "currency",
              "purpose",
              "externalReference",
              "sourceAccountReference",
              "destinationAccountReference",
            ] as const) {
              if (field in body && body[field] !== undefined && typeof body[field] !== "string") {
                throw new NccApiError("VALIDATION_ERROR", `${field} must be a string.`, 400);
              }
            }
            return apiSubmitSettlement(ctx, {
              receivingRoutingNumber: body.receivingRoutingNumber,
              amount: body.amount,
              currency: typeof body.currency === "string" ? body.currency : undefined,
              purpose: typeof body.purpose === "string" ? body.purpose : undefined,
              externalReference:
                typeof body.externalReference === "string" ? body.externalReference : undefined,
              sourceAccountReference:
                typeof body.sourceAccountReference === "string"
                  ? body.sourceAccountReference
                  : undefined,
              destinationAccountReference:
                typeof body.destinationAccountReference === "string"
                  ? body.destinationAccountReference
                  : undefined,
              idempotencyKey,
            });
          },
        }),
    },
  },
});
