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
