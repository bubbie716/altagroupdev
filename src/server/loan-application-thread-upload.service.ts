import type { ThreadAttachment } from "@/lib/bank/loan-application-thread-types";
import { prisma } from "@/server/db";
import { assertThreadAccessForDownload, assertThreadAccessForUpload } from "@/server/loan-application-thread.service";
import {
  AltaCardThreadStorageError,
  streamAltaCardThreadAttachment,
  uploadAltaCardThreadPrivateFile,
} from "@/server/alta-card-thread-storage.service";

const MAX_BYTES = 15 * 1024 * 1024;

function attachmentType(mime: string): ThreadAttachment["type"] {
  if (mime.startsWith("image/")) return "IMAGE";
  return "FILE";
}

export async function uploadThreadAttachment(
  userId: string,
  applicationId: string,
  file: File,
): Promise<ThreadAttachment> {
  const thread = await assertThreadAccessForUpload(userId, applicationId);

  if (file.size > MAX_BYTES) {
    throw new Error("BAD_REQUEST:File exceeds 15 MB limit.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BAD_REQUEST:File upload is not configured yet. Paste links in your message instead.");
  }

  try {
    const stored = await uploadAltaCardThreadPrivateFile(file, {
      scope: "loan",
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
    if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Vercel Blob")) {
      throw new Error(`BAD_REQUEST:${error.message}`);
    }
    throw new Error("BAD_REQUEST:Upload failed. Please try again.");
  }
}

export async function downloadLoanThreadAttachment(
  userId: string,
  applicationId: string,
  attachmentId: string,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  fileName: string;
}> {
  const thread = await assertThreadAccessForDownload(userId, applicationId);
  const match = await findLoanThreadAttachment(applicationId, attachmentId);
  if (!match?.storageKey) {
    throw new Error("NOT_FOUND");
  }

  const payload = await streamAltaCardThreadAttachment(match.storageKey, {
    scope: "loan",
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

async function findLoanThreadAttachment(
  applicationId: string,
  attachmentId: string,
): Promise<ThreadAttachment | null> {
  const messages = await prisma.loanApplicationThreadMessage.findMany({
    where: { thread: { applicationId } },
    select: { attachments: true },
  });

  for (const message of messages) {
    if (!message.attachments || !Array.isArray(message.attachments)) continue;
    for (const raw of message.attachments) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string, unknown>;
      if (row.id === attachmentId) {
        return row as ThreadAttachment;
      }
    }
  }
  return null;
}
