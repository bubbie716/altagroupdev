import type {
  AltaCardReviewThreadContext,
  AltaCardReviewThreadMessageRow,
} from "@/lib/bank/alta-card-review-thread-types";
import type {
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
} from "@/lib/bank/loan-application-thread-types";

export function mapAltaCardReviewThreadContextToLoan(
  ctx: AltaCardReviewThreadContext,
): LoanApplicationThreadContext {
  return {
    threadId: ctx.threadId,
    applicationId: ctx.reviewRequestId,
    viewerUserId: ctx.viewerUserId,
    status: ctx.status,
    statusLabel: ctx.statusLabel,
    assignedStaffId: ctx.assignedStaffId,
    assignedStaffName: ctx.assignedStaffName,
    canSend: ctx.canSend,
    applicantName: ctx.applicantName,
    applicantAvatarUrl: ctx.applicantAvatarUrl,
    companyName: ctx.companyName,
    productLabel: `${ctx.cardTypeLabel} · ${ctx.currentTierLabel}`,
    requestedAmount: 0,
    applicationStatus: ctx.reviewStatus,
    applicationStatusLabel: ctx.reviewStatusLabel,
    submittedAt: ctx.submittedAt,
    submittedAtLabel: ctx.submittedAtLabel,
  };
}

export function mapAltaCardReviewThreadMessagesToLoan(
  messages: AltaCardReviewThreadMessageRow[],
): LoanApplicationThreadMessageRow[] {
  return messages.map((message) => ({
    id: message.id,
    senderUserId: message.senderUserId,
    senderRole: message.senderRole,
    senderName: message.senderName,
    senderAvatarUrl: message.senderAvatarUrl,
    body: message.body,
    attachments: message.attachments,
    createdAt: message.createdAt,
    createdAtLabel: message.createdAtLabel,
  }));
}
