import { createFileRoute } from "@tanstack/react-router";
import { downloadDealRoomDocument, DealRoomDocumentStorageError } from "@/server/document-storage.service";
import { jsonError, requireAuthFromRequest, attachmentContentDisposition, authRequestErrorResponse } from "@/server/bank-request-auth";

export const Route = createFileRoute("/api/deal-rooms/documents/$documentId/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const { getDocumentForDownload } = await import("@/server/deal-room-document.service");
          const doc = await getDocumentForDownload(user.id, params.documentId);

          const payload = await downloadDealRoomDocument(doc.storageKey);
          if (!payload) return jsonError("Document file not found in storage.", 404);

          const headers = new Headers({
            "Content-Type": payload.contentType,
            "Content-Disposition": attachmentContentDisposition(
              request,
              payload.contentType,
              doc.originalFileName,
            ),
            "Cache-Control": "private, no-store",
          });
          if (payload.size > 0) headers.set("Content-Length", String(payload.size));

          return new Response(payload.stream, { status: 200, headers });
        } catch (error) {
          const authError = authRequestErrorResponse(error);
          if (authError) return authError;
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (error instanceof DealRoomDocumentStorageError) {
            return jsonError(error.message, 422);
          }
          if (message === "NOT_FOUND") return jsonError("Document not found.", 404);
          return jsonError("Unable to download document.", 500);
        }
      },
    },
  },
});
