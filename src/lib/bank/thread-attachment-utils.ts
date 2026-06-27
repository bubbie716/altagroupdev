/** Shared href + link helpers for secure deal room / review thread attachments. */

export function threadAttachmentHref(attachment: {
  downloadPath?: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
}): string {
  const base = attachment.downloadPath ?? attachment.url ?? "#";
  if (
    base.startsWith("/api/") &&
    (attachment.mimeType === "application/pdf" ||
      attachment.fileName?.toLowerCase().endsWith(".pdf"))
  ) {
    return base.includes("?") ? `${base}&inline=1` : `${base}?inline=1`;
  }
  return base;
}

export function threadAttachmentOpensInNewTab(attachment: {
  type?: string;
  downloadPath?: string;
  url?: string;
}): boolean {
  if (attachment.type === "LINK") return true;
  const href = threadAttachmentHref(attachment);
  return href.startsWith("http");
}

export function isThreadAttachmentLink(attachment: { type?: string }): boolean {
  return attachment.type === "LINK";
}

export type ThreadAttachmentPreviewKind = "image" | "pdf" | "download";

export function threadAttachmentPreviewKind(attachment: {
  type?: string;
  mimeType?: string;
  fileName?: string;
}): ThreadAttachmentPreviewKind {
  if (attachment.type === "IMAGE") return "image";
  const mime = attachment.mimeType ?? "";
  const ext = (attachment.fileName?.split(".").pop() ?? "").toLowerCase();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return "image";
  }
  return "download";
}

/** Internal deal-room attachments preview in an overlay; external links open in a new tab. */
export function threadAttachmentUsesOverlayPreview(attachment: {
  type?: string;
  downloadPath?: string;
  url?: string;
}): boolean {
  return !threadAttachmentOpensInNewTab(attachment);
}
