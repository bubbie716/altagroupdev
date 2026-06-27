import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import type { AltaCardReviewStatusCode } from "@/lib/bank/alta-card-review-types";

export type AltaCardReviewThreadStatusCode =
  | "open"
  | "waiting_on_applicant"
  | "waiting_on_alta"
  | "closed";

export type AltaCardReviewThreadSenderRoleCode = "applicant" | "alta_staff" | "system";

export const ALTA_CARD_REVIEW_THREAD_STATUS_LABELS: Record<AltaCardReviewThreadStatusCode, string> = {
  open: "Open",
  waiting_on_applicant: "Waiting on you",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};

export const ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL: Record<
  AltaCardReviewThreadStatusCode,
  string
> = {
  open: "Open",
  waiting_on_applicant: "Waiting on cardholder",
  waiting_on_alta: "Waiting on Alta",
  closed: "Closed",
};

export type AltaCardReviewThreadContext = {
  threadId: string;
  reviewRequestId: string;
  viewerUserId: string;
  status: AltaCardReviewThreadStatusCode;
  statusLabel: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  canSend: boolean;
  applicantName: string;
  applicantAvatarUrl: string | null;
  companyName: string | null;
  cardTypeLabel: string;
  currentTierLabel: string;
  reviewStatus: AltaCardReviewStatusCode;
  reviewStatusLabel: string;
  submittedAt: string;
  submittedAtLabel: string;
};

export type AltaCardReviewThreadMessageRow = {
  id: string;
  senderUserId: string | null;
  senderRole: AltaCardReviewThreadSenderRoleCode;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string | null;
  attachments: AltaCardThreadAttachment[];
  createdAt: string;
  createdAtLabel: string;
};

export type SendAltaCardReviewThreadMessageInput = {
  reviewRequestId: string;
  body?: string;
  attachments?: AltaCardThreadAttachment[];
};

export type UpdateAltaCardReviewThreadStatusInput = {
  reviewRequestId: string;
  status: AltaCardReviewThreadStatusCode;
};

export type AssignAltaCardReviewThreadStaffInput = {
  reviewRequestId: string;
  staffUserId: string | null;
};

export type AltaCardReviewThreadDetail = {
  context: AltaCardReviewThreadContext;
  messages: AltaCardReviewThreadMessageRow[];
};
