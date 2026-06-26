export type LoanApplicationThreadStatusCode =
  | "open"
  | "waiting_on_applicant"
  | "waiting_on_alta"
  | "closed";

export type ThreadSenderRoleCode = "applicant" | "alta_staff" | "system";

export type ThreadAttachmentType = "FILE" | "IMAGE" | "LINK";

export type ThreadAttachment = {
  type: ThreadAttachmentType;
  fileName?: string;
  url: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export type LoanApplicationThreadMessageRow = {
  id: string;
  senderUserId: string | null;
  senderRole: ThreadSenderRoleCode;
  senderName: string | null;
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
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  canSend: boolean;
  applicantName: string;
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

export type AssignThreadStaffInput = {
  applicationId: string;
  staffUserId: string | null;
};

export const THREAD_STATUS_LABELS: Record<LoanApplicationThreadStatusCode, string> = {
  open: "Open",
  waiting_on_applicant: "Waiting on you",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};

export const THREAD_STATUS_LABELS_INTERNAL: Record<LoanApplicationThreadStatusCode, string> = {
  open: "Open",
  waiting_on_applicant: "Waiting on applicant",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};
