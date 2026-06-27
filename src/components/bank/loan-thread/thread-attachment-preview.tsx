"use client";

import { Download, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  threadAttachmentHref,
  threadAttachmentPreviewKind,
} from "@/lib/bank/thread-attachment-utils";
import type { ThreadAttachment } from "@/lib/bank/loan-application-thread-types";
import { cn } from "@/lib/utils";

type PreviewAttachment = Pick<
  ThreadAttachment,
  "type" | "fileName" | "url" | "downloadPath" | "mimeType" | "fileSizeBytes"
>;

function downloadAttachment(href: string, fileName?: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.rel = "noopener noreferrer";
  if (fileName) anchor.download = fileName;
  anchor.click();
}

export function ThreadAttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: PreviewAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attachment) return null;

  const href = threadAttachmentHref(attachment);
  const kind = threadAttachmentPreviewKind(attachment);
  const label = attachment.fileName ?? "Attachment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0",
          kind === "download" ? "max-w-md" : "max-w-5xl",
        )}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pr-12">
          <p className="min-w-0 truncate text-sm font-medium">{label}</p>
          {kind !== "download" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => downloadAttachment(href, attachment.fileName)}
            >
              <Download />
              Download
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          {kind === "image" ? (
            <img
              src={href}
              alt={label}
              className="mx-auto max-h-[calc(92vh-4rem)] w-auto max-w-full object-contain"
            />
          ) : null}
          {kind === "pdf" ? (
            <iframe
              src={href}
              title={label}
              className="h-[calc(92vh-4rem)] min-h-[480px] w-full rounded-md border bg-background"
            />
          ) : null}
          {kind === "download" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <File className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">This file cannot be previewed in the browser.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadAttachment(href, attachment.fileName)}
              >
                <Download />
                Download file
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
