import type { AuditEntityType } from "@prisma/client";
import type { WriteAuditLogInput } from "@/lib/internal/audit.types";
import {
  internalAccountUrl,
  internalAltaPayOpsUrl,
  internalCompanyUrl,
  internalDepositsQueueUrl,
  internalJobsUrl,
  internalSettingsUrl,
  internalTransactionUrl,
  internalTransfersUrl,
  internalUserUrl,
  internalWithdrawalsQueueUrl,
} from "@/lib/staff-audit/staff-audit-internal-urls";
import type { StaffAuditProduct, StaffAuditSeverity, StaffAuditSource } from "@/lib/staff-audit/staff-audit-types";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

/** Automated or read-only audit rows that should not spam the staff channel. */
const DISCORD_SKIP_ACTIONS = new Set([
  "RELATIONSHIP_TIMELINE_EVENT_CREATED",
  "COMPANY_RELATIONSHIP_TIMELINE_EVENT_CREATED",
  "RELATIONSHIP_PROFILE_REFRESHED",
  "RELATIONSHIP_PROFILE_CREATED",
  "RELATIONSHIP_SCORE_CHANGED",
  "RELATIONSHIP_TIER_CHANGED",
  "RELATIONSHIP_RECOMMENDATIONS_GENERATED",
  "RELATIONSHIP_RECOMMENDATION_DISMISSED",
  "RELATIONSHIP_RECOMMENDATION_REVIEWED",
  "RELATIONSHIP_RECOMMENDATION_ACCEPTED",
  "RELATIONSHIP_PREAPPROVAL_READINESS_VIEWED",
  "RELATIONSHIP_RECOMMENDATION_USED",
  "COMPANY_RELATIONSHIP_SCORE_CHANGED",
  "COMPANY_RELATIONSHIP_TIER_CHANGED",
  "COMPANY_RELATIONSHIP_RECOMMENDATIONS_GENERATED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_DISMISSED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_REVIEWED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_ACCEPTED",
  "COMPANY_RELATIONSHIP_PREAPPROVAL_READINESS_VIEWED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_USED",
  "RELATIONSHIP_TIMELINE_BACKFILLED",
  "COMPANY_RELATIONSHIP_TIMELINE_BACKFILLED",
  "LOAN_THREAD_MESSAGE_SENT",
  "ALTA_CARD_APPLICATION_MESSAGE_SENT",
  "MANUAL_INTEREST_PREVIEWED",
]);

const ACTION_LABELS: Record<string, string> = {
  BANK_ACCOUNT_OPENED: "Account opened",
  BANK_DEPOSIT_REQUEST_SUBMITTED: "Deposit request submitted",
  BANK_WITHDRAWAL_REQUEST_SUBMITTED: "Withdrawal request submitted",
  BANK_INTERNAL_TRANSFER_COMPLETED: "Internal transfer completed",
  BANK_INTERNAL_TRANSFER_FAILED: "Internal transfer failed",
  BANK_SCHEDULED_TRANSFER_CREATED: "Scheduled transfer created",
  BANK_SCHEDULED_TRANSFER_CANCELLED: "Scheduled transfer cancelled",
  BANK_SCHEDULED_TRANSFER_EXECUTED: "Scheduled transfer executed",
  BANK_SCHEDULED_TRANSFER_FAILED: "Scheduled transfer failed",
  DEPOSIT_APPROVED: "Deposit approved",
  DEPOSIT_DENIED: "Deposit denied",
  WITHDRAWAL_APPROVED: "Withdrawal approved",
  WITHDRAWAL_DENIED: "Withdrawal denied",
  ACCOUNT_STATUS_CHANGED: "Account status changed",
  ACCOUNT_RESTRICTIONS_UPDATED: "Account restrictions updated",
  ACCOUNT_ADJUSTMENT_CREATED: "Manual adjustment created",
  ACCOUNT_HOLD_APPLIED: "Account hold applied",
  ACCOUNT_HOLD_RELEASED: "Account hold released",
  ACCOUNT_REOPENED: "Account reopened",
  ADJUSTMENT_REVERSED: "Adjustment reversed",
  ADMIN_MANUAL_TRANSFER: "Admin manual transfer",
  ALTA_PAY_SENT: "Alta Pay sent",
  ALTA_PAY_FAILED: "Alta Pay failed",
  ALTA_PAY_REVERSED: "Alta Pay reversed",
  ALTA_CARD_ALTA_PAY_CHARGED: "Alta Pay sent (card-funded)",
  ALTA_PRIVATE_INVITATION_SENT: "Alta Private invitation sent",
  ALTA_PRIVATE_INVITATION_REVOKED: "Alta Private invitation revoked",
  ALTA_PRIVATE_INVITATION_ACCEPTED: "Alta Private invitation accepted",
  ALTA_PRIVATE_INVITATION_DECLINED: "Alta Private invitation declined",
  ALTA_PRIVATE_ACTIVATED: "Alta Private membership activated",
  COMPANY_CREATED: "Company created",
  COMPANY_VERIFIED: "Company verified",
  COMPANY_REJECTED: "Company verification rejected",
  COMPANY_VERIFICATION_REVOKED: "Company verification revoked",
  COMPANY_INVITATION_SENT: "Company invitation sent",
  COMPANY_INVITATION_ACCEPTED: "Company invitation accepted",
  COMPANY_INVITATION_DECLINED: "Company invitation declined",
  COMPANY_MEMBER_ROLE_CHANGED: "Company member role changed",
  COMPANY_MEMBER_REMOVED: "Company member removed",
  BUSINESS_ACCOUNT_OPENED: "Business account opened",
  LOAN_APPLICATION_SUBMITTED: "Loan application submitted",
  LOAN_APPROVED: "Loan application approved",
  LOAN_DENIED: "Loan application denied",
  LOAN_FUNDED: "Loan funded",
  LOAN_PAYMENT_MADE: "Loan payment made",
  LOAN_PAID_OFF: "Loan paid off",
  ADMIN_LOAN_PAYMENT_RECORDED: "Loan payment recorded (operator)",
  MAINTENANCE_MODE_ENABLED: "Maintenance mode enabled",
  MAINTENANCE_MODE_DISABLED: "Maintenance mode disabled",
  MAINTENANCE_MESSAGE_UPDATED: "Maintenance message updated",
  CREDIT_DESK_OPENED: "Credit Desk opened",
  CREDIT_DESK_CLOSED: "Credit Desk closed",
  USER_TAG_GRANTED: "User tag granted",
  USER_TAG_REVOKED: "User tag revoked",
  USER_STATUS_CHANGED: "Customer account status changed",
  INTERNAL_NOTE_ADDED: "Internal note added",
  OPS_JOB_MANUAL_RUN: "Ops job manual run",
  OPS_CRON_JOB_FAILED: "Scheduled job failed",
  OPS_REVIEW_FLAG_CREATED: "Review flag created",
  OPS_REVIEW_FLAG_RESOLVED: "Review flag resolved",
};

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function labelForAction(action: string): string {
  return ACTION_LABELS[action] ?? humanizeAction(action);
}

function resolveSource(metadata: Record<string, unknown> | undefined): StaffAuditSource | undefined {
  const raw = metadata?.source;
  if (typeof raw !== "string") return "website";
  const normalized = raw.toLowerCase();
  if (normalized === "discord_bot") return "discord_bot";
  if (normalized === "cron") return "cron";
  if (normalized === "system") return "system";
  return "website";
}

function inferSeverity(action: string, metadata: Record<string, unknown> | undefined): StaffAuditSeverity {
  const metaSeverity = metadata?.severity;
  if (metaSeverity === "critical") return "CRITICAL";
  if (metaSeverity === "warning") return "WARNING";

  if (
    action.includes("DENIED") ||
    action.includes("REJECTED") ||
    action.includes("FAILED") ||
    action.includes("FROZEN") ||
    action.includes("REVOKED")
  ) {
    return "WARNING";
  }
  if (
    action.includes("SUBMITTED") ||
    action.includes("REQUEST") ||
    action.includes("CREATED") && action.includes("INVITATION")
  ) {
    return "ACTION";
  }
  if (action.includes("MAINTENANCE_MODE_ENABLED") || action.includes("CREDIT_DESK_CLOSED")) {
    return "CRITICAL";
  }
  return "INFO";
}

function productFor(input: WriteAuditLogInput): StaffAuditProduct {
  const { action, entityType } = input;
  if (action.startsWith("ALTA_CARD") || action.startsWith("ALTA_EMPLOYEE_CARD")) return "Alta Card";
  if (action.startsWith("ALTA_PRIVATE") || action.startsWith("PRIVATE_BANKING")) return "Alta Private";
  if (action.startsWith("COMPANY_") || action === "BUSINESS_ACCOUNT_OPENED") return "Companies";
  if (action.startsWith("ALTA_PAY") || action === "ALTA_CARD_ALTA_PAY_CHARGED") return "Alta Pay";
  if (
    action.startsWith("MAINTENANCE") ||
    action.startsWith("CREDIT_DESK") ||
    action.startsWith("OPS_") ||
    action.startsWith("USER_") ||
    action === "INTERNAL_NOTE_ADDED"
  ) {
    return "Alta Ops";
  }
  if (entityType === "ALTA_CARD") return "Alta Card";
  if (entityType === "COMPANY") return "Companies";
  if (entityType === "PLATFORM") return "Alta Ops";
  if (entityType === "LOAN" || entityType === "LOAN_APPLICATION") return "Alta Bank";
  return "Alta Bank";
}

function resolveInternalUrl(input: WriteAuditLogInput): string | undefined {
  const { action, targetTransactionId, targetAccountId, targetUserId, targetCompanyId, entityId, entityType } =
    input;

  if (targetTransactionId) return internalTransactionUrl(targetTransactionId);
  if (action.includes("DEPOSIT") && action.includes("SUBMITTED")) return internalDepositsQueueUrl();
  if (action.includes("WITHDRAWAL") && action.includes("SUBMITTED")) return internalWithdrawalsQueueUrl();
  if (action.includes("SCHEDULED_TRANSFER") || action.includes("TRANSFER")) return internalTransfersUrl();
  if (action.startsWith("ALTA_PAY") || action === "ALTA_CARD_ALTA_PAY_CHARGED") return internalAltaPayOpsUrl();
  if (action.startsWith("MAINTENANCE") || action.startsWith("CREDIT_DESK")) return internalSettingsUrl();
  if (action.startsWith("OPS_")) return internalJobsUrl();
  if (targetAccountId) return internalAccountUrl(targetAccountId);
  if (entityType === "BANK_ACCOUNT" && entityId) return internalAccountUrl(entityId);
  if (targetCompanyId) return internalCompanyUrl(targetCompanyId);
  if (entityType === "COMPANY" && entityId) return internalCompanyUrl(entityId);
  if (targetUserId) return internalUserUrl(targetUserId);
  if (entityType === "USER" && entityId) return internalUserUrl(entityId);
  return undefined;
}

function buildDetails(input: WriteAuditLogInput, metadata: Record<string, unknown>): string | undefined {
  const parts: string[] = [];

  const amount = metadata.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    parts.push(`ƒ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  const referenceCode = metadata.referenceCode;
  if (typeof referenceCode === "string" && referenceCode.trim()) {
    parts.push(`Ref ${referenceCode.trim()}`);
  }

  const reviewNote = metadata.reviewNote;
  if (typeof reviewNote === "string" && reviewNote.trim()) {
    parts.push(`Note: ${reviewNote.trim()}`);
  }

  const reason = metadata.reason;
  if (typeof reason === "string" && reason.trim()) {
    parts.push(`Reason: ${reason.trim()}`);
  }

  if (parts.length > 0) return parts.join(" · ");

  const description = input.description?.trim();
  if (description && description.length <= 120) return description;
  return undefined;
}

function dedupeKeyFor(input: WriteAuditLogInput): string {
  const id =
    input.targetTransactionId ??
    input.entityId ??
    input.targetAccountId ??
    input.targetUserId ??
    input.targetCompanyId ??
    "global";
  return `audit-log:${input.action}:${id}`;
}

/** Mirror a database audit row to the staff Discord channel. Fire-and-forget; never throws. */
export function notifyDiscordFromAuditLog(input: WriteAuditLogInput): void {
  if (DISCORD_SKIP_ACTIONS.has(input.action)) return;

  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};

  sendStaffAuditMessage({
    product: productFor(input),
    action: labelForAction(input.action),
    actorUserId: input.actorUserId,
    details: buildDetails(input, metadata),
    internalUrl: resolveInternalUrl(input),
    severity: inferSeverity(input.action, metadata),
    requiresAction: metadata.requiresAction === true,
    source: resolveSource(metadata),
    dedupeKey: dedupeKeyFor(input),
  });
}
