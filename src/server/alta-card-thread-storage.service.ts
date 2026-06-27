import { randomUUID } from "node:crypto";
import type { AuditEntityType } from "@prisma/client";
import { resolveAltaCardThreadAttachmentMime } from "@/lib/storage/alta-card-thread-attachment.constants";
import {
  vercelBlobDocumentStorage,
  DealRoomDocumentStorageError,
} from "@/server/document-storage.service";
import { writeAuditLog } from "@/server/audit.service";

export { DealRoomDocumentStorageError as AltaCardThreadStorageError };

const MAX_BYTES = 15 * 1024 * 1024;

export type SecureThreadStorageScope = "loan" | "application" | "review";

export type AltaCardThreadStorageContext = {
  scope: SecureThreadStorageScope;
  parentId: string;
  actorUserId: string;
  targetUserId?: string | null;
  targetCompanyId?: string | null;
};

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "attachment";
}

function storagePathPrefix(scope: SecureThreadStorageScope): string {
  if (scope === "loan") return "loan-threads";
  if (scope === "application") return "alta-card-threads";
  return "alta-card-review-threads";
}

export function buildAltaCardThreadStoragePath(
  scope: SecureThreadStorageScope,
  parentId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${storagePathPrefix(scope)}/${parentId}/${attachmentId}/${safeFileName(fileName)}`;
}

export function altaCardThreadAttachmentDownloadPath(
  scope: SecureThreadStorageScope,
  parentId: string,
  attachmentId: string,
): string {
  if (scope === "loan") {
    return `/api/loan-threads/${parentId}/attachments/${attachmentId}/download`;
  }
  if (scope === "application") {
    return `/api/alta-card-threads/${parentId}/attachments/${attachmentId}/download`;
  }
  return `/api/alta-card-review-threads/${parentId}/attachments/${attachmentId}/download`;
}

function auditMetaForScope(scope: SecureThreadStorageScope): {
  entityType: AuditEntityType;
  uploadAction: string;
  downloadAction: string;
} {
  if (scope === "loan") {
    return {
      entityType: "LOAN_APPLICATION",
      uploadAction: "LOAN_APPLICATION_THREAD_ATTACHMENT_UPLOADED",
      downloadAction: "LOAN_APPLICATION_THREAD_ATTACHMENT_DOWNLOADED",
    };
  }
  return {
    entityType: "ALTA_CARD",
    uploadAction: "ALTA_CARD_THREAD_ATTACHMENT_UPLOADED",
    downloadAction: "ALTA_CARD_THREAD_ATTACHMENT_DOWNLOADED",
  };
}

export async function uploadAltaCardThreadPrivateFile(
  file: File,
  ctx: AltaCardThreadStorageContext,
): Promise<{
  id: string;
  storageKey: string;
  downloadPath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}> {
  if (file.size > MAX_BYTES) {
    throw new DealRoomDocumentStorageError("File exceeds 15 MB limit.");
  }
  const mimeType = resolveAltaCardThreadAttachmentMime(file);
  if (!mimeType) {
    throw new DealRoomDocumentStorageError("File type not supported.");
  }

  const attachmentId = randomUUID();
  const pathname = buildAltaCardThreadStoragePath(ctx.scope, ctx.parentId, attachmentId, file.name);
  const body = Buffer.from(await file.arrayBuffer());
  const blob = await vercelBlobDocumentStorage.upload(pathname, body, mimeType);
  const audit = auditMetaForScope(ctx.scope);

  await writeAuditLog({
    actorUserId: ctx.actorUserId,
    action: audit.uploadAction,
    entityType: audit.entityType,
    entityId: ctx.parentId,
    targetUserId: ctx.targetUserId ?? undefined,
    targetCompanyId: ctx.targetCompanyId ?? undefined,
    description: `Thread attachment uploaded: ${file.name}`,
    metadata: {
      attachmentId,
      storageKey: blob.pathname,
      scope: ctx.scope,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
    },
  });

  return {
    id: attachmentId,
    storageKey: blob.pathname,
    downloadPath: altaCardThreadAttachmentDownloadPath(ctx.scope, ctx.parentId, attachmentId),
    fileName: file.name,
    mimeType,
    fileSizeBytes: file.size,
  };
}

export async function streamAltaCardThreadAttachment(
  storageKey: string,
  ctx: AltaCardThreadStorageContext & { attachmentId: string; fileName: string },
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}> {
  const payload = await vercelBlobDocumentStorage.fetch(storageKey);
  if (!payload) {
    throw new DealRoomDocumentStorageError("Attachment file not found in storage.");
  }

  const audit = auditMetaForScope(ctx.scope);

  await writeAuditLog({
    actorUserId: ctx.actorUserId,
    action: audit.downloadAction,
    entityType: audit.entityType,
    entityId: ctx.parentId,
    targetUserId: ctx.targetUserId ?? undefined,
    targetCompanyId: ctx.targetCompanyId ?? undefined,
    description: `Thread attachment downloaded: ${ctx.fileName}`,
    metadata: {
      attachmentId: ctx.attachmentId,
      storageKey,
      scope: ctx.scope,
      fileName: ctx.fileName,
    },
  });

  return payload;
}
