import { createFileRoute } from "@tanstack/react-router";
import type { AgreementFieldData } from "@/lib/agreements/agreement-types";
import { jsonError, requireAuthFromRequest } from "@/server/bank-request-auth";

export const Route = createFileRoute("/api/deal-rooms/$dealRoomId/agreement/preview")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const body = (await request.json()) as { fieldData?: AgreementFieldData };
          const { getAgreementWorkspace } = await import("@/server/deal-room-agreement.service");
          const { previewLoanAgreementPdf } = await import("@/server/agreement-pdf.service");

          const workspace = await getAgreementWorkspace(user.id, params.dealRoomId);
          const fieldData = body.fieldData ?? workspace.fieldData;
          const bytes = await previewLoanAgreementPdf(workspace.templateSlug, fieldData);

          return new Response(Buffer.from(bytes), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Cache-Control": "private, no-store",
              "Content-Disposition": 'inline; filename="agreement-preview.pdf"',
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          if (message === "UNAUTHORIZED") return jsonError("Authentication required.", 401);
          if (message === "FORBIDDEN") return jsonError("You do not have access to this deal room.", 403);
          if (message === "NOT_FOUND") return jsonError("Deal room not found.", 404);
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.replace(/^BAD_REQUEST:/, ""), 400);
          }
          return jsonError("Unable to generate agreement preview.", 500);
        }
      },
    },
  },
});
