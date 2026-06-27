import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import { cn } from "@/lib/utils";
import {
  isThreadAttachmentLink,
  threadAttachmentHref,
  threadAttachmentOpensInNewTab,
} from "@/lib/bank/thread-attachment-utils";
import { File, FileImage, FileSpreadsheet, FileText, Link2 } from "lucide-react";

export function AltaCardThreadAttachmentList({
  attachments,
  tone = "light",
}: {
  attachments: AltaCardThreadAttachment[];
  tone?: "light" | "dark";
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.type === "IMAGE");
  const others = attachments.filter((a) => a.type !== "IMAGE");

  return (
    <div className="mt-3 flex flex-col gap-2">
      {images.length > 0 ? (
        <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((a, i) => {
            const href = threadAttachmentHref(a);
            const openInNewTab = threadAttachmentOpensInNewTab(a);
            return (
            <a
              key={`${a.id ?? href}-${i}`}
              href={href}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noopener noreferrer" : undefined}
              className={cn(
                "group relative block w-full max-w-sm self-start overflow-hidden rounded-xl border",
                images.length === 1 && "max-w-xs",
                tone === "dark" ? "border-white/15" : "border-border/60",
              )}
            >
              <img
                src={href}
                alt={a.fileName ?? "Image attachment"}
                loading="lazy"
                className="block h-auto max-h-64 w-full object-contain"
              />
            </a>
            );
          })}
        </div>
      ) : null}
      {others.map((a, i) => (
        <AltaCardThreadAttachmentChip key={`${a.id ?? a.downloadPath ?? a.url}-${i}`} attachment={a} tone={tone} />
      ))}
    </div>
  );
}

function AltaCardThreadAttachmentChip({
  attachment,
  tone,
}: {
  attachment: AltaCardThreadAttachment;
  tone: "light" | "dark";
}) {
  const isLink = isThreadAttachmentLink(attachment);
  const href = threadAttachmentHref(attachment);
  const openInNewTab = threadAttachmentOpensInNewTab(attachment);
  const label = attachment.fileName ?? (isLink ? attachment.url : undefined) ?? href;
  const subtitle = isLink && attachment.url
    ? safeHostname(attachment.url)
    : formatBytes(attachment.fileSizeBytes);
  const Icon = isLink ? Link2 : pickFileIcon(attachment.fileName, attachment.mimeType);

  return (
    <a
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={cn(
        "group inline-flex max-w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition",
        tone === "dark"
          ? "border-white/15 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.07]"
          : "border-border/70 bg-surface-1 text-foreground hover:border-foreground/30 hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "dark" ? "bg-white/10 text-white" : "bg-foreground/5 text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium leading-tight">{label}</span>
        {subtitle ? (
          <span
            className={cn(
              "truncate font-mono text-[10px] uppercase tracking-[0.12em]",
              tone === "dark" ? "text-white/55" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function pickFileIcon(name?: string, mime?: string) {
  const ext = (name?.split(".").pop() ?? "").toLowerCase();
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return FileImage;
  if (["csv", "xls", "xlsx", "numbers"].includes(ext)) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  return File;
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function formatBytes(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
