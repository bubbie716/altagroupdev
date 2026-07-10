import { createFileRoute } from "@tanstack/react-router";
import {
  ProofUploadError,
  ProofValidationError,
  uploadBankProof,
} from "@/lib/storage/proof-upload";
import {
  jsonError,
  authRequestErrorResponse,
  parseFormString,
  parseProofFile,
  requireAuthFromRequest,
} from "@/server/bank-request-auth";
import { enforceRateLimit } from "@/server/rate-limit.service";

export const Route = createFileRoute("/api/bank/deposit-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = await enforceRateLimit(request, "deposit-upload", 20, 60_000);
        if (limited) return limited;

        try {
          const user = await requireAuthFromRequest(request);
          const formData = await request.formData();

          const bankAccountId = parseFormString(formData, "bankAccountId");
          const amountRaw = parseFormString(formData, "amount");
          const memo = parseFormString(formData, "memo");
          const proofFile = parseProofFile(formData);

          if (!bankAccountId) {
            return jsonError("Select a bank account.", 400);
          }

          const amount = Number(amountRaw);
          if (!Number.isFinite(amount) || amount <= 0) {
            return jsonError("Amount must be greater than zero.", 400);
          }

          if (!proofFile) {
            return jsonError("Screenshot proof is required.", 400);
          }

          let proof;
          try {
            proof = await uploadBankProof(proofFile, {
              userId: user.id,
              transactionType: "deposit",
            });
          } catch (error) {
            if (error instanceof ProofValidationError) {
              return jsonError(error.message, 400);
            }
            if (error instanceof ProofUploadError) {
              return jsonError("Proof upload failed. Please try again.", 422);
            }
            throw error;
          }

          const { submitDepositRequest } = await import("@/server/bank.service");
          const result = await submitDepositRequest(
            user.id,
            { bankAccountId, amount, memo: memo || undefined },
            {
              proofImageUrl: proof.url,
              proofFileName: proof.fileName,
              proofMimeType: proof.mimeType,
              proofSizeBytes: proof.sizeBytes,
              proofUploadedAt: proof.uploadedAt,
            },
          );

          return Response.json({
            ok: true,
            transactionId: result.transactionId,
            referenceCode: result.referenceCode,
          });
        } catch (error) {
          const authError = authRequestErrorResponse(error);
          if (authError) return authError;
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (message === "FORBIDDEN") {
            return jsonError("You do not have access to this account.", 403);
          }
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.replace(/^BAD_REQUEST:/, ""), 400);
          }
          return jsonError("Unable to submit deposit request.", 500);
        }
      },
    },
  },
});
