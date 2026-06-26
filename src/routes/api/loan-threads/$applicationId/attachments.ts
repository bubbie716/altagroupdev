import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest, jsonError } from "@/server/bank-request-auth";
import { uploadThreadAttachment } from "@/server/loan-application-thread-upload.service";

export const Route = createFileRoute("/api/loan-threads/$applicationId/attachments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireAuthFromRequest(request);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return jsonError("File is required.", 400);
          }
          const attachment = await uploadThreadAttachment(user.id, params.applicationId, file);
          return Response.json(attachment);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";
          if (message === "FORBIDDEN") return jsonError("Forbidden.", 403);
          if (message === "NOT_FOUND") return jsonError("Not found.", 404);
          if (message === "UNAUTHORIZED") return jsonError("Unauthorized.", 401);
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.slice("BAD_REQUEST:".length), 400);
          }
          return jsonError("Upload failed. Storage may not be configured.", 500);
        }
      },
    },
  },
});
