import { createFileRoute } from "@tanstack/react-router";
import { downloadBankProof, ProofUploadError } from "@/lib/storage/proof-upload";
import {
  attachmentContentDisposition,
  authRequestErrorResponse,
  jsonError,
  requireAuthFromRequest,
} from "@/server/bank-request-auth";
import { getBankProofForDownload } from "@/server/bank-proof-access.service";
import { enforceRateLimit } from "@/server/rate-limit.service";

export const Route = createFileRoute("/api/bank/transactions/$transactionId/proof")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const limited = await enforceRateLimit(request, "proof-download", 60, 60_000);
        if (limited) return limited;

        try {
          const user = await requireAuthFromRequest(request);
          const proof = await getBankProofForDownload(user.id, params.transactionId);
          const payload = await downloadBankProof(proof.storageKey);
          if (!payload) return jsonError("Proof file not found in storage.", 404);

          const headers = new Headers({
            "Content-Type": proof.mimeType || payload.contentType,
            "Content-Disposition": attachmentContentDisposition(
              request,
              proof.mimeType || payload.contentType,
              proof.fileName,
            ),
            "Cache-Control": "private, no-store",
          });
          if (payload.size > 0) headers.set("Content-Length", String(payload.size));

          return new Response(payload.stream, { status: 200, headers });
        } catch (error) {
          const authError = authRequestErrorResponse(error);
          if (authError) return authError;
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (error instanceof ProofUploadError) {
            return jsonError(error.message, 422);
          }
          if (message === "NOT_FOUND") return jsonError("Proof not found.", 404);
          if (message === "FORBIDDEN") {
            return jsonError("You do not have access to this proof.", 403);
          }
          return jsonError("Unable to download proof.", 500);
        }
      },
    },
  },
});
