import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest, jsonError, authRequestErrorResponse } from "@/server/bank-request-auth";

export const Route = createFileRoute("/api/company-branding/$companyId/logo")({
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
          const { uploadCompanyBrandingLogo } = await import("@/server/company-branding.service");
          const settings = await uploadCompanyBrandingLogo(user.id, params.companyId, file);
          return Response.json({ logoUrl: settings.logoUrl });
        } catch (error) {
          const authError = authRequestErrorResponse(error);
          if (authError) return authError;
          const message = error instanceof Error ? error.message : "Upload failed.";
          if (message === "NOT_FOUND") return jsonError("Not found.", 404);
          if (message.startsWith("BAD_REQUEST:")) {
            return jsonError(message.slice("BAD_REQUEST:".length), 400);
          }
          return jsonError("Upload failed. Storage may not be configured.", 500);
        }
      },
    },
  },
});
