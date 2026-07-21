import { createServerFn } from "@tanstack/react-start";

/**
 * Applicant + staff document helpers for the participant application portal.
 * Staff review queue actions also live in ncc-control-plane.functions.ts.
 */

export const listNccApplicationDocuments = createServerFn({ method: "GET" })
  .inputValidator((input: { applicationId: string }) => input)
  .handler(async ({ data }) => {
    const { listParticipantDocuments } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return listParticipantDocuments(data.applicationId);
  });

export const uploadNccApplicationDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      applicationId: string;
      documentType: string;
      fileName: string;
      contentType: string;
      /** Base64-encoded file bytes (no data: prefix). */
      base64: string;
      expiresAt?: string | null;
      replaceDocumentId?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { uploadParticipantDocument } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    const binary = Buffer.from(data.base64, "base64");
    const file = {
      name: data.fileName,
      type: data.contentType,
      size: binary.length,
      arrayBuffer: async () =>
        binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
    };
    return uploadParticipantDocument({
      applicationId: data.applicationId,
      documentType: data.documentType,
      file,
      expiresAt: data.expiresAt,
      replaceDocumentId: data.replaceDocumentId,
    });
  });

export const staffAcceptNccDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      documentId: string;
      reviewNote?: string | null;
      manualSafeReviewCompleted?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { acceptParticipantDocument } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return acceptParticipantDocument(data);
  });

export const staffRejectNccDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string; reviewNote: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { rejectParticipantDocument } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return rejectParticipantDocument(data);
  });

export const staffMarkNccDocumentUnderReview = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string; note?: string | null }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { markDocumentUnderReview } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return markDocumentUnderReview(data.documentId, data.note);
  });
