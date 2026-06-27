import type { AltaUser } from "@/lib/auth/types";

/** Closed-thread copy for secure deal room uploads (by product). */
export const SECURE_THREAD_CLOSED_UPLOAD_MESSAGES = {
  loan: "Thread is closed.",
  application: "This secure deal room is closed.",
  review: "This secure review thread is closed.",
} as const;

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

/**
 * Uploads require an open thread and send permission.
 * Downloads use view access only — see *AccessForDownload in each thread service.
 */
export function assertSecureThreadUploadAccess(input: {
  user: AltaUser;
  isStaff: (user: AltaUser) => boolean;
  threadClosed: boolean;
  canSendAsApplicant: boolean;
  closedMessage: string;
}): void {
  if (input.isStaff(input.user)) {
    if (input.threadClosed) badRequest(input.closedMessage);
    return;
  }
  if (!input.canSendAsApplicant) forbidden();
}
