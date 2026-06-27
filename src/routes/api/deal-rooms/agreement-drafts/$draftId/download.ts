import { createFileRoute } from "@tanstack/react-router";
import { downloadDealRoomDocument, DealRoomDocumentStorageError } from "@/server/document-storage.service";
import { jsonError, requireAuthFromRequest, attachmentContentDisposition } from "@/server/bank-request-auth";

export const Route = createFileRoute("/api/deal-rooms/agreement-drafts/$draftId/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const { getAgreementDraftForDownload } = await import("@/server/deal-room-agreement.service");
          const draft = await getAgreementDraftForDownload(user.id, params.draftId);

          const payload = await downloadDealRoomDocument(draft.pdfStorageKey!);
          if (!payload) return jsonError("Agreement PDF not found in storage.", 404);

          const filename = `loan-agreement-v${draft.versionNumber}.pdf`;
          const headers = new Headers({
            "Content-Type": "application/pdf",
            "Content-Disposition": attachmentContentDisposition(request, "application/pdf", filename),
            "Cache-Control": "private, no-store",
          });
          if (payload.size > 0) headers.set("Content-Length", String(payload.size));

          const { writeAuditLog } = await import("@/server/audit.service");
          await writeAuditLog({
            actorUserId: user.id,
            action: "DEAL_ROOM_AGREEMENT_DOWNLOADED",
            entityType: "DEAL_ROOM",
            entityId: draft.agreement.dealRoomId,
            description: `Agreement draft V${draft.versionNumber} downloaded.`,
            metadata: {
              dealRoomId: draft.agreement.dealRoomId,
              draftId: draft.id,
              version: draft.versionNumber,
            },
          });

          return new Response(payload.stream, { status: 200, headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (error instanceof DealRoomDocumentStorageError) {
            return jsonError(error.message, 422);
          }
          if (message === "UNAUTHORIZED") return jsonError("Authentication required.", 401);
          if (message === "FORBIDDEN") return jsonError("You do not have access to this agreement.", 403);
          if (message === "NOT_FOUND") return jsonError("Agreement draft not found.", 404);
          return jsonError("Unable to download agreement.", 500);
        }
      },
    },
  },
});
