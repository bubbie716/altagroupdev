import type {
  AltaCardApplicationThreadContext,
  AltaCardApplicationThreadMessageRow,
} from "@/lib/bank/alta-card-application-thread-types";
import type {
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
} from "@/lib/bank/loan-application-thread-types";

export function mapAltaCardThreadContextToLoan(
  ctx: AltaCardApplicationThreadContext,
): LoanApplicationThreadContext {
  return {
    threadId: ctx.threadId,
    applicationId: ctx.applicationId,
    viewerUserId: ctx.viewerUserId,
    status: ctx.status,
    statusLabel: ctx.statusLabel,
    assignedStaffId: ctx.assignedStaffId,
    assignedStaffName: ctx.assignedStaffName,
    canSend: ctx.canSend,
    applicantName: ctx.applicantName,
    applicantAvatarUrl: ctx.applicantAvatarUrl,
    companyName: ctx.companyName,
    productLabel: `${ctx.cardTypeLabel} · ${ctx.requestedTierLabel}`,
    requestedAmount: ctx.requestedLimit ?? 0,
    applicationStatus: ctx.applicationStatus,
    applicationStatusLabel: ctx.applicationStatusLabel,
    submittedAt: ctx.submittedAt,
    submittedAtLabel: ctx.submittedAtLabel,
  };
}

export function mapAltaCardThreadMessagesToLoan(
  messages: AltaCardApplicationThreadMessageRow[],
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
