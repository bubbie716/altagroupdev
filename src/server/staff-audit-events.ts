import { formatFlorin } from "@/lib/bank/format";
import {
  internalAccountUrl,
  internalAltaPayOpsUrl,
  internalCompanyUrl,
  internalCompanyVerificationsQueueUrl,
  internalDepositsQueueUrl,
  internalJobsUrl,
  internalSettingsUrl,
  internalTransactionUrl,
  internalTransfersUrl,
  internalUserUrl,
  internalWithdrawalsQueueUrl,
} from "@/lib/staff-audit/staff-audit-internal-urls";
import type { BankingStaffAuditContext, StaffAuditSource } from "@/lib/staff-audit/staff-audit-types";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

function sourceFromContext(context?: BankingStaffAuditContext): StaffAuditSource | undefined {
  return context?.source;
}

export function staffAuditDepositSubmitted(input: {
  userId: string;
  actorName?: string;
  transactionId: string;
  referenceCode: string;
  amount: number;
  auditContext?: BankingStaffAuditContext;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Deposit request submitted",
    actorUserId: input.userId,
    actorName: input.actorName,
    details: `${formatFlorin(input.amount)} · Ref ${input.referenceCode}`,
    internalUrl: internalTransactionUrl(input.transactionId),
    severity: "ACTION",
    requiresAction: true,
    source: sourceFromContext(input.auditContext),
    dedupeKey: `deposit-submitted:${input.transactionId}`,
  });
}

export function staffAuditWithdrawalSubmitted(input: {
  userId: string;
  actorName?: string;
  transactionId: string;
  referenceCode: string;
  amount: number;
  auditContext?: BankingStaffAuditContext;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Withdrawal request submitted",
    actorUserId: input.userId,
    actorName: input.actorName,
    details: `${formatFlorin(input.amount)} · Ref ${input.referenceCode}`,
    internalUrl: internalTransactionUrl(input.transactionId),
    severity: "ACTION",
    requiresAction: true,
    source: sourceFromContext(input.auditContext),
    dedupeKey: `withdrawal-submitted:${input.transactionId}`,
  });
}

export function staffAuditTransferCompleted(input: {
  userId: string;
  actorName?: string;
  referenceCode: string;
  amount: number;
  fromAccountName: string;
  toAccountName: string;
  auditContext?: BankingStaffAuditContext;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Internal transfer completed",
    actorUserId: input.userId,
    actorName: input.actorName,
    details: `${formatFlorin(input.amount)} · ${input.fromAccountName} → ${input.toAccountName} · Ref ${input.referenceCode}`,
    internalUrl: internalTransfersUrl(),
    severity: "INFO",
    source: sourceFromContext(input.auditContext),
    dedupeKey: `transfer-completed:${input.referenceCode}`,
  });
}

export function staffAuditAltaPaySent(input: {
  userId: string;
  actorName?: string;
  payeeName: string;
  amount: number;
  referenceCode: string;
  auditContext?: BankingStaffAuditContext;
}): void {
  sendStaffAuditMessage({
    product: "Alta Pay",
    action: "Payment sent",
    actorUserId: input.userId,
    actorName: input.actorName,
    details: `${input.payeeName} · ${formatFlorin(input.amount)} · Ref ${input.referenceCode}`,
    internalUrl: internalAltaPayOpsUrl(),
    severity: "INFO",
    source: sourceFromContext(input.auditContext),
    dedupeKey: `alta-pay-sent:${input.referenceCode}`,
  });
}

export function staffAuditAccountOpened(input: {
  userId: string;
  accountId: string;
  accountName: string;
  accountTypeLabel: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Account opened",
    actorUserId: input.userId,
    details: `${input.accountTypeLabel} · ${input.accountName}`,
    internalUrl: internalAccountUrl(input.accountId),
    severity: "INFO",
    dedupeKey: `account-opened:${input.accountId}`,
  });
}

export function staffAuditDepositReviewed(input: {
  adminId: string;
  adminName?: string;
  transactionId: string;
  referenceCode: string;
  amount: number;
  approved: boolean;
  reviewNote?: string | null;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: input.approved ? "Deposit approved" : "Deposit denied",
    actorUserId: input.adminId,
    actorName: input.adminName,
    details: [
      formatFlorin(input.amount),
      `Ref ${input.referenceCode}`,
      !input.approved && input.reviewNote?.trim()
        ? `Reason: ${input.reviewNote.trim()}`
        : null,
    ].filter(Boolean) as string[],
    internalUrl: internalTransactionUrl(input.transactionId),
    severity: input.approved ? "INFO" : "WARNING",
    dedupeKey: `deposit-review:${input.transactionId}:${input.approved ? "approved" : "denied"}`,
  });
}

export function staffAuditWithdrawalReviewed(input: {
  adminId: string;
  adminName?: string;
  transactionId: string;
  referenceCode: string;
  amount: number;
  approved: boolean;
  reviewNote?: string | null;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: input.approved ? "Withdrawal approved" : "Withdrawal denied",
    actorUserId: input.adminId,
    actorName: input.adminName,
    details: [
      formatFlorin(input.amount),
      `Ref ${input.referenceCode}`,
      !input.approved && input.reviewNote?.trim()
        ? `Reason: ${input.reviewNote.trim()}`
        : null,
    ].filter(Boolean) as string[],
    internalUrl: internalTransactionUrl(input.transactionId),
    severity: input.approved ? "INFO" : "WARNING",
    dedupeKey: `withdrawal-review:${input.transactionId}:${input.approved ? "approved" : "denied"}`,
  });
}

export function staffAuditAccountStatusChanged(input: {
  adminId: string;
  accountId: string;
  action: string;
  details?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: input.action,
    actorUserId: input.adminId,
    details: input.details,
    internalUrl: internalAccountUrl(input.accountId),
    severity: input.severity ?? "WARNING",
    dedupeKey: `account-status:${input.accountId}:${input.action}`,
  });
}

export function staffAuditUserStatusChanged(input: {
  adminId: string;
  userId: string;
  accountStatus: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Ops",
    action: "Customer account status changed",
    actorUserId: input.adminId,
    details: `Status: ${input.accountStatus}`,
    internalUrl: internalUserUrl(input.userId),
    severity: input.accountStatus === "frozen" ? "WARNING" : "INFO",
    dedupeKey: `user-status:${input.userId}:${input.accountStatus}`,
  });
}

export function staffAuditAltaPrivateInvitation(input: {
  action: string;
  actorUserId: string;
  targetUserId: string;
  invitationId?: string;
  severity?: "INFO" | "ACTION" | "WARNING";
  source?: StaffAuditSource;
}): void {
  sendStaffAuditMessage({
    product: "Alta Private",
    action: input.action,
    actorUserId: input.actorUserId,
    internalUrl: internalUserUrl(input.targetUserId),
    severity: input.severity ?? "ACTION",
    source: input.source,
    dedupeKey: input.invitationId
      ? `alta-private:${input.invitationId}:${input.action}`
      : `alta-private:${input.targetUserId}:${input.action}`,
  });
}

export function staffAuditCompanyInvitation(input: {
  action: string;
  actorUserId: string;
  companyId: string;
  companyName?: string;
  source?: StaffAuditSource;
}): void {
  sendStaffAuditMessage({
    product: "Companies",
    action: input.action,
    actorUserId: input.actorUserId,
    details: input.companyName,
    internalUrl: internalCompanyUrl(input.companyId),
    severity: "INFO",
    source: input.source,
    dedupeKey: `company-invite:${input.action}:${input.companyId}:${input.actorUserId}`,
  });
}

export function staffAuditCompanyVerification(input: {
  adminId: string;
  companyId: string;
  companyName: string;
  action: string;
  reviewNote?: string | null;
}): void {
  sendStaffAuditMessage({
    product: "Companies",
    action: input.action,
    actorUserId: input.adminId,
    details: [
      input.companyName,
      input.reviewNote?.trim() ? `Note: ${input.reviewNote.trim()}` : null,
    ].filter(Boolean) as string[],
    internalUrl: internalCompanyUrl(input.companyId),
    severity: input.action.includes("rejected") ? "WARNING" : "INFO",
    dedupeKey: `company-verify:${input.companyId}:${input.action}`,
  });
}

export function staffAuditMaintenanceMode(input: {
  adminId: string;
  enabled: boolean;
  reason: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Ops",
    action: input.enabled ? "Maintenance mode enabled" : "Maintenance mode disabled",
    actorUserId: input.adminId,
    details: `Reason: ${input.reason}`,
    internalUrl: internalSettingsUrl(),
    severity: input.enabled ? "CRITICAL" : "INFO",
    dedupeKey: `maintenance:${input.enabled ? "on" : "off"}:${input.adminId}`,
  });
}

export function staffAuditCreditDesk(input: {
  adminId: string;
  closed: boolean;
  reason?: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Ops",
    action: input.closed ? "Credit Desk closed" : "Credit Desk opened",
    actorUserId: input.adminId,
    details: input.reason ? `Reason: ${input.reason}` : undefined,
    internalUrl: internalSettingsUrl(),
    severity: input.closed ? "CRITICAL" : "INFO",
    dedupeKey: `credit-desk:${input.closed ? "closed" : "opened"}:${input.adminId}`,
  });
}

export function staffAuditAccountRestrictionsUpdated(input: {
  adminId: string;
  accountId: string;
  reason: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Account restrictions updated",
    actorUserId: input.adminId,
    details: `Reason: ${input.reason}`,
    internalUrl: internalAccountUrl(input.accountId),
    severity: "WARNING",
    dedupeKey: `account-restrictions:${input.accountId}`,
  });
}

export function staffAuditOpsJobFailed(input: {
  jobKey: string;
  summary: string;
  actorUserId?: string;
}): void {
  sendStaffAuditMessage({
    product: "Alta Ops",
    action: "Scheduled job failed",
    actorUserId: input.actorUserId,
    details: `${input.jobKey} · ${input.summary}`,
    internalUrl: internalJobsUrl(),
    severity: "CRITICAL",
    source: "cron",
    dedupeKey: `job-failed:${input.jobKey}`,
  });
}

export function staffAuditDepositQueueLink(): string {
  return internalDepositsQueueUrl();
}

export function staffAuditWithdrawalQueueLink(): string {
  return internalWithdrawalsQueueUrl();
}

export function staffAuditCompanyVerificationQueueLink(): string {
  return internalCompanyVerificationsQueueUrl();
}
