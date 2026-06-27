export type LoanApplicationThreadStatusCode =
  | "open"
  | "waiting_on_applicant"
  | "waiting_on_alta"
  | "closed";

export type ThreadSenderRoleCode = "applicant" | "alta_staff" | "system";

export type ThreadAttachmentType = "FILE" | "IMAGE" | "LINK";

export type ThreadAttachment = {
  id?: string;
  type: ThreadAttachmentType;
  fileName?: string;
  /** Public blob URL — loan threads and legacy uploads */
  url?: string;
  /** Auth-gated app download path — Alta Card private attachments */
  downloadPath?: string;
  storageKey?: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export type LoanApplicationThreadMessageRow = {
  id: string;
  senderUserId: string | null;
  senderRole: ThreadSenderRoleCode;
  senderName: string | null;
  senderAvatarUrl: string | null;
  body: string | null;
  attachments: ThreadAttachment[];
  createdAt: string;
  createdAtLabel: string;
};

export type LoanApplicationThreadContext = {
  threadId: string;
  applicationId: string;
  viewerUserId: string;
  status: LoanApplicationThreadStatusCode;
  statusLabel: string;
  /** @deprecated V1 Secure Deal Rooms are not staff-assigned. Always null. */
  assignedStaffId: string | null;
  /** @deprecated V1 Secure Deal Rooms are not staff-assigned. Always null. */
  assignedStaffName: string | null;
  canSend: boolean;
  applicantName: string;
  applicantAvatarUrl: string | null;
  companyName: string | null;
  productLabel: string;
  requestedAmount: number;
  applicationStatus: string;
  applicationStatusLabel: string;
  submittedAt: string;
  submittedAtLabel: string;
};

export type SendThreadMessageInput = {
  applicationId: string;
  body?: string;
  attachments?: ThreadAttachment[];
};

export type UpdateThreadStatusInput = {
  applicationId: string;
  status: LoanApplicationThreadStatusCode;
};

/** @deprecated V1 Secure Deal Rooms are not staff-assigned. No-op for compatibility. */
export type AssignThreadStaffInput = {
  applicationId: string;
  staffUserId: string | null;
};

export const THREAD_STATUS_LABELS: Record<LoanApplicationThreadStatusCode, string> = {
  open: "Waiting on Alta",
  waiting_on_applicant: "Waiting on You",
  waiting_on_alta: "Waiting on Alta",
  closed: "Waiting on Alta",
};

export const THREAD_STATUS_LABELS_INTERNAL: Record<LoanApplicationThreadStatusCode, string> = {
  open: "Waiting on Alta",
  waiting_on_applicant: "Waiting on You",
  waiting_on_alta: "Waiting on Alta",
  closed: "Waiting on Alta",
};

export {
  applicationListStatusLabel,
  formatApplicationStatusLabel,
} from "@/lib/bank/lending-application-status-copy";
