export type AltaCardApplicationThreadStatusCode =
  | "open"
  | "waiting_on_applicant"
  | "waiting_on_alta"
  | "closed";

export type AltaCardThreadSenderRoleCode = "applicant" | "alta_staff" | "system";

export type AltaCardThreadAttachmentType = "FILE" | "IMAGE" | "LINK";

export type AltaCardThreadAttachment = {
  type: AltaCardThreadAttachmentType;
  fileName?: string;
  url: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export type AltaCardApplicationThreadMessageRow = {
  id: string;
  senderUserId: string | null;
  senderRole: AltaCardThreadSenderRoleCode;
  senderName: string | null;
  senderAvatarUrl: string | null;
  body: string | null;
  attachments: AltaCardThreadAttachment[];
  createdAt: string;
  createdAtLabel: string;
};

export type AltaCardApplicationThreadContext = {
  threadId: string;
  applicationId: string;
  viewerUserId: string;
  status: AltaCardApplicationThreadStatusCode;
  statusLabel: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  canSend: boolean;
  applicantName: string;
  applicantAvatarUrl: string | null;
  companyName: string | null;
  cardTypeLabel: string;
  requestedTierLabel: string;
  requestedLimit: number | null;
  applicationStatus: string;
  applicationStatusLabel: string;
  submittedAt: string;
  submittedAtLabel: string;
};

export type SendAltaCardThreadMessageInput = {
  applicationId: string;
  body?: string;
  attachments?: AltaCardThreadAttachment[];
};

export type UpdateAltaCardThreadStatusInput = {
  applicationId: string;
  status: AltaCardApplicationThreadStatusCode;
};

export type AssignAltaCardThreadStaffInput = {
  applicationId: string;
  staffUserId: string | null;
};

export const ALTA_CARD_THREAD_STATUS_LABELS: Record<AltaCardApplicationThreadStatusCode, string> = {
  open: "Waiting on Alta",
  waiting_on_applicant: "Waiting on you",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};

export const ALTA_CARD_THREAD_STATUS_LABELS_INTERNAL: Record<
  AltaCardApplicationThreadStatusCode,
  string
> = {
  open: "Waiting on Alta",
  waiting_on_applicant: "Waiting on applicant",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};

export const ALTA_CARD_APPLICATION_STATUS_LABELS: Record<
  import("@/lib/bank/alta-card-types").AltaCardApplicationStatusCode,
  string
> = {
  submitted: "Submitted",
  under_review: "Under review",
  needs_info: "Needs information",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
};
