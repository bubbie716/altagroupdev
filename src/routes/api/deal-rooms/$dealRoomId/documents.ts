import { createFileRoute } from "@tanstack/react-router";
import {
  DealRoomDocumentStorageError,
  DealRoomDocumentValidationError,
} from "@/server/document-storage.service";
import {
  jsonError,
  parseFormString,
  requireAuthFromRequest,
} from "@/server/bank-request-auth";
import type { DealRoomDocumentTypeCode } from "@/lib/bank/deal-room-types";
import { DOC_TYPE_TO_DB } from "@/server/deal-room-document-mapper";

const VALID_TYPES = new Set(Object.keys(DOC_TYPE_TO_DB));

function parseDocumentFile(formData: FormData): File | null {
  const value = formData.get("file");
  if (!value || !(value instanceof File) || value.size <= 0) return null;
  return value;
}

export const Route = createFileRoute("/api/deal-rooms/$dealRoomId/documents")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const formData = await request.formData();
          const file = parseDocumentFile(formData);
          const documentType = parseFormString(formData, "documentType") as DealRoomDocumentTypeCode;
          const visibility = parseFormString(formData, "visibility") as "shared" | "internal_only" | "";
          const description = parseFormString(formData, "description");
          const replaceDocumentId = parseFormString(formData, "replaceDocumentId");

          if (!file) return jsonError("Document file is required.", 400);
          if (!documentType || !VALID_TYPES.has(documentType)) {
            return jsonError("Select a valid document type.", 400);
          }

          const { replaceDocument, uploadDocument } = await import("@/server/deal-room-document.service");

          const row = replaceDocumentId
            ? await replaceDocument(user.id, replaceDocumentId, file, description || undefined)
            : await uploadDocument(
                user.id,
                {
                  dealRoomId: params.dealRoomId,
                  documentType,
                  visibility: visibility === "internal_only" ? "internal_only" : "shared",
                  description: description || undefined,
                },
                file,
              );

          return Response.json({ ok: true, document: row });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (error instanceof DealRoomDocumentValidationError) {
            return jsonError(error.message, 400);
          }
          if (error instanceof DealRoomDocumentStorageError) {
            return jsonError(error.message, 422);
          }
          if (message === "UNAUTHORIZED") return jsonError("Authentication required.", 401);
          if (message === "FORBIDDEN") return jsonError("You do not have access to this deal room.", 403);
          if (message === "NOT_FOUND") return jsonError("Deal room or document not found.", 404);
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.replace(/^BAD_REQUEST:/, ""), 400);
          }
          return jsonError("Unable to upload document.", 500);
        }
      },
    },
  },
});
