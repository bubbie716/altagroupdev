import { randomBytes } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import {
  buildDealRoomDocumentStoragePath,
  DealRoomDocumentStorageError,
  type DealRoomDocumentFileInput,
  type DealRoomDocumentStorageResult,
  type DealRoomDocumentUploadMetadata,
  validateDealRoomDocumentFile,
} from "@/lib/storage/deal-room-document.constants";

export {
  ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES,
  MAX_DEAL_ROOM_DOCUMENT_BYTES,
  DealRoomDocumentStorageError,
  DealRoomDocumentValidationError,
} from "@/lib/storage/deal-room-document.constants";

export interface DocumentStorageBackend {
  upload(
    pathname: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ url: string; pathname: string }>;
  delete(pathname: string): Promise<void>;
  fetch(pathname: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
    size: number;
  } | null>;
}

function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new DealRoomDocumentStorageError("Document storage is not configured.");
  }
  return token;
}

export type BlobAccessMode = "public" | "private";

/** Must match the Vercel Blob store type. Defaults to public for dev/public stores. */
export function resolveBlobAccessMode(): BlobAccessMode {
  const configured = process.env.BLOB_ACCESS?.trim().toLowerCase();
  if (configured === "private" || configured === "public") return configured;
  return "public";
}

/** Vercel Blob implementation — swap backend here without changing deal-room services. */
export const vercelBlobDocumentStorage: DocumentStorageBackend = {
  async upload(pathname, body, contentType) {
    const token = getBlobToken();
    const access = resolveBlobAccessMode();
    const blob = await put(pathname, body, {
      access,
      contentType,
      token,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  },

  async delete(pathname) {
    const token = getBlobToken();
    await del(pathname, { token });
  },

  async fetch(pathname) {
    const token = getBlobToken();
    const access = resolveBlobAccessMode();
    const result = await get(pathname, { access, token });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      stream: result.stream,
      contentType: result.blob.contentType ?? "application/octet-stream",
      size: result.blob.size ?? 0,
    };
  },
};

let storageBackend: DocumentStorageBackend = vercelBlobDocumentStorage;

export function setDocumentStorageBackend(backend: DocumentStorageBackend): void {
  storageBackend = backend;
}

export async function uploadDealRoomDocument(
  file: DealRoomDocumentFileInput,
  metadata: DealRoomDocumentUploadMetadata,
): Promise<DealRoomDocumentStorageResult> {
  const { mimeType, ext, fileName } = validateDealRoomDocumentFile(file);
  const uploadedAt = new Date();
  const pathname = buildDealRoomDocumentStoragePath(metadata, ext, uploadedAt);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    const blob = await storageBackend.upload(pathname, body, mimeType);
    const storedFileName = pathname.split("/").pop() ?? fileName;

    return {
      storageKey: blob.pathname,
      storedFileName,
      url: blob.url,
      mimeType,
      sizeBytes: file.size,
    };
  } catch (error) {
    if (error instanceof DealRoomDocumentStorageError) throw error;
    throw new DealRoomDocumentStorageError("Document upload failed. Please try again.");
  }
}

/** Soft-delete policy: blob remains until explicit cleanup. No-op on storage for soft deletes. */
export async function deleteDealRoomDocument(storageKey: string, hardDelete = false): Promise<void> {
  if (!hardDelete) return;
  try {
    await storageBackend.delete(storageKey);
  } catch {
    throw new DealRoomDocumentStorageError("Document could not be removed from storage.");
  }
}

export async function downloadDealRoomDocument(storageKey: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
} | null> {
  try {
    return await storageBackend.fetch(storageKey);
  } catch {
    throw new DealRoomDocumentStorageError("Document could not be retrieved.");
  }
}

/** Returns an authenticated app download path (authorization enforced at request time). */
export function generateSignedDocumentUrl(documentId: string): string {
  return `/api/deal-rooms/documents/${documentId}/download`;
}

export function generateDocumentDownloadNonce(): string {
  return randomBytes(16).toString("hex");
}
