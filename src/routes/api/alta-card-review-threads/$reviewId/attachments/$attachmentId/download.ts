import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest, jsonError, attachmentContentDisposition } from "@/server/bank-request-auth";
import { downloadAltaCardReviewThreadAttachment } from "@/server/alta-card-review-thread-upload.service";
import { AltaCardThreadStorageError } from "@/server/alta-card-thread-storage.service";

export const Route = createFileRoute(
  "/api/alta-card-review-threads/$reviewId/attachments/$attachmentId/download",
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const payload = await downloadAltaCardReviewThreadAttachment(
            user.id,
            params.reviewId,
            params.attachmentId,
          );

          const headers = new Headers({
            "Content-Type": payload.contentType,
            "Content-Disposition": attachmentContentDisposition(
              request,
              payload.contentType,
              payload.fileName,
            ),
            "Cache-Control": "private, no-store, max-age=0",
          });
          if (payload.size > 0) headers.set("Content-Length", String(payload.size));

          return new Response(payload.stream, { status: 200, headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (error instanceof AltaCardThreadStorageError) {
            return jsonError(error.message, 422);
          }
          if (message === "UNAUTHORIZED") return jsonError("Authentication required.", 401);
          if (message === "FORBIDDEN") return jsonError("You do not have access to this attachment.", 403);
          if (message === "NOT_FOUND") return jsonError("Attachment not found.", 404);
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.slice("BAD_REQUEST:".length), 400);
          }
          return jsonError("Unable to download attachment.", 500);
        }
      },
    },
  },
});
