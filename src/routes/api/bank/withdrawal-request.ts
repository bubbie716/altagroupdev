import { createFileRoute } from "@tanstack/react-router";
import {
  jsonError,
  parseFormString,
  requireAuthFromRequest,
} from "@/server/bank-request-auth";

export const Route = createFileRoute("/api/bank/withdrawal-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const formData = await request.formData();

          const bankAccountId = parseFormString(formData, "bankAccountId");
          const amountRaw = parseFormString(formData, "amount");
          const memo = parseFormString(formData, "memo");

          if (!bankAccountId) {
            return jsonError("Select a bank account.", 400);
          }

          const amount = Number(amountRaw);
          if (!Number.isFinite(amount) || amount <= 0) {
            return jsonError("Amount must be greater than zero.", 400);
          }

          const { submitWithdrawalRequest } = await import("@/server/bank.service");
          const result = await submitWithdrawalRequest(user.id, {
            bankAccountId,
            amount,
            memo: memo || undefined,
          });

          return Response.json({
            ok: true,
            transactionId: result.transactionId,
            referenceCode: result.referenceCode,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (message === "UNAUTHORIZED") {
            return jsonError("Authentication required.", 401);
          }
          if (message === "FORBIDDEN") {
            return jsonError("You do not have access to this account.", 403);
          }
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.replace(/^BAD_REQUEST:/, ""), 400);
          }
          return jsonError("Unable to submit withdrawal request.", 500);
        }
      },
    },
  },
});
