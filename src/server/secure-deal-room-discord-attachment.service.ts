import type { SecureDealRoomType } from "@prisma/client";
import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import type { DiscordChannelAttachmentInput } from "@/lib/bank/secure-deal-room-discord-types";
import { resolveAltaCardThreadAttachmentMime } from "@/lib/storage/alta-card-thread-attachment.constants";
import { prisma } from "@/server/db";
import {
  AltaCardThreadStorageError,
  type AltaCardThreadStorageContext,
  type SecureThreadStorageScope,
  uploadAltaCardThreadPrivateFile,
} from "@/server/alta-card-thread-storage.service";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

function attachmentType(mime: string): AltaCardThreadAttachment["type"] {
  if (mime.startsWith("image/")) return "IMAGE";
  return "FILE";
}

async function resolveStorageContext(
  dealRoomType: SecureDealRoomType,
  threadId: string,
  dealRoomId: string,
  actorUserId: string,
): Promise<AltaCardThreadStorageContext> {
  switch (dealRoomType) {
    case "LOAN_APPLICATION": {
      const thread = await prisma.loanApplicationThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, loanApplicationId: true },
      });
      if (!thread) throw new Error("THREAD_NOT_FOUND");
      return {
        scope: "loan",
        parentId: thread.loanApplicationId ?? dealRoomId,
        actorUserId,
        targetUserId: thread.applicantUserId,
        targetCompanyId: thread.companyId,
      };
    }
    case "ALTA_CARD_APPLICATION": {
      const thread = await prisma.altaCardApplicationThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, applicationId: true },
      });
      if (!thread) throw new Error("THREAD_NOT_FOUND");
      return {
        scope: "application",
        parentId: thread.applicationId ?? dealRoomId,
        actorUserId,
        targetUserId: thread.applicantUserId,
        targetCompanyId: thread.companyId,
      };
    }
    case "ALTA_CARD_REVIEW": {
      const thread = await prisma.altaCardReviewThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, reviewRequestId: true },
      });
      if (!thread) throw new Error("THREAD_NOT_FOUND");
      return {
        scope: "review",
        parentId: thread.reviewRequestId ?? dealRoomId,
        actorUserId,
        targetUserId: thread.applicantUserId,
        targetCompanyId: thread.companyId,
      };
    }
    default:
      throw new Error("UNSUPPORTED_DEAL_ROOM_TYPE");
  }
}

export async function storeDiscordDealRoomAttachments(input: {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  actorUserId: string;
  attachments: DiscordChannelAttachmentInput[];
}): Promise<AltaCardThreadAttachment[]> {
  if (input.attachments.length === 0) return [];
  if (input.attachments.length > MAX_ATTACHMENTS) {
    throw new Error("BAD_REQUEST:Maximum 5 files per message.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BAD_REQUEST:File upload is not configured.");
  }

  const storageContext = await resolveStorageContext(
    input.dealRoomType,
    input.threadId,
    input.dealRoomId,
    input.actorUserId,
  );

  const stored: AltaCardThreadAttachment[] = [];

  for (const attachment of input.attachments) {
    if (attachment.sizeBytes > MAX_BYTES) {
      throw new Error("BAD_REQUEST:File exceeds 15 MB limit.");
    }

    const mimeType =
      resolveAltaCardThreadAttachmentMime({
        name: attachment.fileName,
        type: attachment.mimeType,
      }) ?? null;
    if (!mimeType) {
      throw new Error("BAD_REQUEST:File type not supported.");
    }

    const file = new File([new Uint8Array(attachment.buffer)], attachment.fileName, { type: mimeType });

    try {
      const uploaded = await uploadAltaCardThreadPrivateFile(file, storageContext);
      stored.push({
        id: uploaded.id,
        type: attachmentType(uploaded.mimeType),
        fileName: uploaded.fileName,
        storageKey: uploaded.storageKey,
        downloadPath: uploaded.downloadPath,
        mimeType: uploaded.mimeType,
        fileSizeBytes: uploaded.fileSizeBytes,
      });
    } catch (error) {
      if (error instanceof AltaCardThreadStorageError) {
        throw new Error(`BAD_REQUEST:${error.message}`);
      }
      throw error;
    }
  }

  return stored;
}

export type { SecureThreadStorageScope };
