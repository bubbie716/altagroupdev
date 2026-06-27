import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import { ThreadAttachmentList } from "@/components/bank/loan-thread/thread-attachments";

export function AltaCardThreadAttachmentList({
  attachments,
  tone = "light",
}: {
  attachments: AltaCardThreadAttachment[];
  tone?: "light" | "dark";
}) {
  return <ThreadAttachmentList attachments={attachments} tone={tone} />;
}
