import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import { prisma } from "@/server/db";
import { assertReviewThreadAccessForDownload, assertReviewThreadAccessForUpload } from "@/server/alta-card-review-thread.service";
import {
  AltaCardThreadStorageError,
  streamAltaCardThreadAttachment,
  uploadAltaCardThreadPrivateFile,
} from "@/server/alta-card-thread-storage.service";

const MAX_BYTES = 15 * 1024 * 1024;

function attachmentType(mime: string): AltaCardThreadAttachment["type"] {
  if (mime.startsWith("image/")) return "IMAGE";
  return "FILE";
}

export async function uploadAltaCardReviewThreadAttachment(
  userId: string,
  reviewRequestId: string,
  file: File,
): Promise<AltaCardThreadAttachment> {
  const { thread } = await assertReviewThreadAccessForUpload(userId, reviewRequestId);

  if (file.size > MAX_BYTES) {
    throw new Error("BAD_REQUEST:File exceeds 15 MB limit.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BAD_REQUEST:File upload is not configured yet. Paste links in your message instead.");
  }

  try {
    const stored = await uploadAltaCardThreadPrivateFile(file, {
      scope: "review",
      parentId: reviewRequestId,
      actorUserId: userId,
      targetUserId: thread.applicantUserId,
      targetCompanyId: thread.companyId,
    });

    return {
      id: stored.id,
      type: attachmentType(stored.mimeType),
      fileName: stored.fileName,
      storageKey: stored.storageKey,
      downloadPath: stored.downloadPath,
      mimeType: stored.mimeType,
      fileSizeBytes: stored.fileSizeBytes,
    };
  } catch (error) {
    if (error instanceof AltaCardThreadStorageError) {
      throw new Error(`BAD_REQUEST:${error.message}`);
    }
    if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Vercel Blob")) {
      throw new Error(`BAD_REQUEST:${error.message}`);
    }
    console.error("Review thread attachment upload failed:", error);
    throw new Error("BAD_REQUEST:Upload failed. Please try again.");
  }
}

export async function downloadAltaCardReviewThreadAttachment(
  userId: string,
  reviewRequestId: string,
  attachmentId: string,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  fileName: string;
}> {
  const { thread } = await assertReviewThreadAccessForDownload(userId, reviewRequestId);
  const match = await findReviewThreadAttachment(reviewRequestId, attachmentId);
  if (!match?.storageKey) {
    throw new Error("NOT_FOUND");
  }

  const payload = await streamAltaCardThreadAttachment(match.storageKey, {
    scope: "review",
    parentId: reviewRequestId,
    actorUserId: userId,
    targetUserId: thread.applicantUserId,
    targetCompanyId: thread.companyId,
    attachmentId,
    fileName: match.fileName ?? "attachment",
  });

  return {
    ...payload,
    fileName: match.fileName ?? "attachment",
  };
}

async function findReviewThreadAttachment(
  reviewRequestId: string,
  attachmentId: string,
): Promise<AltaCardThreadAttachment | null> {
  const messages = await prisma.altaCardReviewThreadMessage.findMany({
    where: { thread: { reviewRequestId } },
    select: { attachments: true },
  });

  for (const message of messages) {
    if (!message.attachments || !Array.isArray(message.attachments)) continue;
    for (const raw of message.attachments) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string, unknown>;
      if (row.id === attachmentId) {
        return row as AltaCardThreadAttachment;
      }
    }
  }
  return null;
}
