export const ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedDealRoomDocumentMimeType = (typeof ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES)[number];

/** 15 MB — institutional lending document limit. */
export const MAX_DEAL_ROOM_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const MIME_TO_EXT: Record<AllowedDealRoomDocumentMimeType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export interface DealRoomDocumentFileInput {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface DealRoomDocumentUploadMetadata {
  dealRoomId: string;
  uploadedByUserId: string;
  documentId: string;
}

export interface DealRoomDocumentStorageResult {
  storageKey: string;
  storedFileName: string;
  url: string;
  mimeType: AllowedDealRoomDocumentMimeType;
  sizeBytes: number;
}

export class DealRoomDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealRoomDocumentValidationError";
  }
}

export class DealRoomDocumentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealRoomDocumentStorageError";
  }
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function safeOriginalFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "document";
}

function formatStorageTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function normalizeDealRoomDocumentMimeType(
  type: string,
  fileName?: string,
): AllowedDealRoomDocumentMimeType | null {
  const normalized = type.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (
    normalized &&
    normalized !== "application/octet-stream" &&
    ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES.includes(normalized as AllowedDealRoomDocumentMimeType)
  ) {
    return normalized as AllowedDealRoomDocumentMimeType;
  }
  const ext = fileName?.split(".").pop()?.trim().toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export function validateDealRoomDocumentFile(file: DealRoomDocumentFileInput): {
  mimeType: AllowedDealRoomDocumentMimeType;
  ext: string;
  fileName: string;
} {
  if (!file || file.size <= 0) {
    throw new DealRoomDocumentValidationError("Document file is required.");
  }
  if (file.size > MAX_DEAL_ROOM_DOCUMENT_BYTES) {
    throw new DealRoomDocumentValidationError("Document must be 15MB or smaller.");
  }

  const mimeType = normalizeDealRoomDocumentMimeType(file.type, file.name);
  if (!mimeType) {
    throw new DealRoomDocumentValidationError("Only PDF, PNG, JPG, and DOCX files are accepted.");
  }

  const blocked = [".exe", ".bat", ".cmd", ".sh", ".js", ".html", ".svg", ".zip"];
  const lowerName = file.name.trim().toLowerCase();
  if (blocked.some((ext) => lowerName.endsWith(ext))) {
    throw new DealRoomDocumentValidationError("Unsupported file type.");
  }

  return {
    mimeType,
    ext: MIME_TO_EXT[mimeType],
    fileName: safeOriginalFileName(file.name),
  };
}

export function buildDealRoomDocumentStoragePath(
  metadata: DealRoomDocumentUploadMetadata,
  ext: string,
  uploadedAt: Date,
): string {
  return `deal-room-documents/${safePathSegment(metadata.dealRoomId)}/${formatStorageTimestamp(uploadedAt)}-${safePathSegment(metadata.documentId)}.${ext}`;
}
