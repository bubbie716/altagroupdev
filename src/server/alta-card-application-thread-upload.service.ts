import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import { prisma } from "@/server/db";
import { assertAltaCardThreadAccessForDownload, assertAltaCardThreadAccessForUpload } from "@/server/alta-card-application-thread.service";
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

export async function uploadAltaCardThreadAttachment(
  userId: string,
  applicationId: string,
  file: File,
): Promise<AltaCardThreadAttachment> {
  const { thread } = await assertAltaCardThreadAccessForUpload(userId, applicationId);

  if (file.size > MAX_BYTES) {
    throw new Error("BAD_REQUEST:File exceeds 15 MB limit.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BAD_REQUEST:File upload is not configured yet. Paste links in your message instead.");
  }

  try {
    const stored = await uploadAltaCardThreadPrivateFile(file, {
      scope: "application",
      parentId: applicationId,
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
    if (error instanceof Error && error.message.includes("Vercel Blob")) {
      throw new Error(`BAD_REQUEST:${error.message}`);
    }
    throw new Error("BAD_REQUEST:Upload failed. Please try again.");
  }
}

export async function downloadAltaCardThreadAttachment(
  userId: string,
  applicationId: string,
  attachmentId: string,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  fileName: string;
}> {
  const { thread } = await assertAltaCardThreadAccessForDownload(userId, applicationId);
  const match = await findApplicationThreadAttachment(applicationId, attachmentId);
  if (!match?.storageKey) {
    throw new Error("NOT_FOUND");
  }

  const payload = await streamAltaCardThreadAttachment(match.storageKey, {
    scope: "application",
    parentId: applicationId,
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

async function findApplicationThreadAttachment(
  applicationId: string,
  attachmentId: string,
): Promise<AltaCardThreadAttachment | null> {
  const messages = await prisma.altaCardApplicationThreadMessage.findMany({
    where: { thread: { applicationId } },
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
