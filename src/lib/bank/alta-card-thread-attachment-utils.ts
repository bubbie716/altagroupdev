import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import {
  isThreadAttachmentLink,
  threadAttachmentHref,
} from "@/lib/bank/thread-attachment-utils";

export {
  isThreadAttachmentLink,
  threadAttachmentHref,
  threadAttachmentOpensInNewTab,
} from "@/lib/bank/thread-attachment-utils";

/** @deprecated Use threadAttachmentHref */
export function altaCardThreadAttachmentHref(attachment: AltaCardThreadAttachment): string {
  return threadAttachmentHref(attachment);
}

/** @deprecated Use isThreadAttachmentLink */
export function isAltaCardThreadAttachmentLink(attachment: AltaCardThreadAttachment): boolean {
  return isThreadAttachmentLink(attachment);
}
