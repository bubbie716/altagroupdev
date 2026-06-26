import type { ReactNode } from "react";
import type { ThreadAttachment } from "@/lib/bank/loan-application-thread-types";
import { cn } from "@/lib/utils";

const URL_PATTERN = /https?:\/\/[^\s<]+/g;

export function linkifyText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push(
      <a
        key={`${url}-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-gold underline underline-offset-2 hover:text-gold/80"
      >
        {url}
      </a>,
    );
    lastIndex = index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

export function ThreadAttachmentList({ attachments }: { attachments: ThreadAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a, i) => (
        <ThreadAttachmentChip key={`${a.url}-${i}`} attachment={a} />
      ))}
    </div>
  );
}

function ThreadAttachmentChip({ attachment }: { attachment: ThreadAttachment }) {
  if (attachment.type === "IMAGE") {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block max-w-xs">
        <img
          src={attachment.url}
          alt={attachment.fileName ?? "Image attachment"}
          className="max-h-48 rounded-lg border border-border/60 object-cover"
        />
      </a>
    );
  }

  const label = attachment.fileName ?? attachment.url;

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2",
        "text-[12px] text-foreground hover:border-gold/40",
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {attachment.type === "LINK" ? "Link" : "File"}
      </span>
      <span className="truncate">{label}</span>
    </a>
  );
}
