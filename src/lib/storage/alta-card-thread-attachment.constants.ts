export const ALLOWED_ALTA_CARD_THREAD_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedAltaCardThreadAttachmentMimeType =
  (typeof ALLOWED_ALTA_CARD_THREAD_ATTACHMENT_MIME_TYPES)[number];

const ALLOWED_MIME = new Set<string>(ALLOWED_ALTA_CARD_THREAD_ATTACHMENT_MIME_TYPES);

const EXT_TO_MIME: Record<string, AllowedAltaCardThreadAttachmentMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function mimeFromExtension(fileName: string): AllowedAltaCardThreadAttachmentMimeType | null {
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

/** Resolve MIME from browser metadata, with extension fallback for empty/octet-stream types. */
export function resolveAltaCardThreadAttachmentMime(file: {
  name: string;
  type: string;
}): AllowedAltaCardThreadAttachmentMimeType | null {
  const normalized = file.type.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized && normalized !== "application/octet-stream" && ALLOWED_MIME.has(normalized)) {
    return normalized as AllowedAltaCardThreadAttachmentMimeType;
  }
  return mimeFromExtension(file.name);
}
