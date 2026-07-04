import type { AuditEntityType } from "@prisma/client";
import { buildAuditMetadata } from "@/lib/internal/audit-metadata";
import {
  normalizeFailedActionSource,
  type FailedActionSource,
} from "@/lib/internal/failed-action-source";
import { writeAuditLog } from "@/server/audit.service";

export type RecordFailedActionInput = {
  actorUserId: string;
  /** Human-readable label, e.g. WITHDRAWAL_APPROVAL */
  actionAttempted: string;
  failureReason: string;
  entityType: AuditEntityType;
  entityId?: string;
  targetUserId?: string;
  targetAccountId?: string;
  targetCompanyId?: string;
  targetTransactionId?: string;
  targetLoanId?: string;
  amount?: number;
  source?: FailedActionSource | string;
  internalLink?: string;
  /** Override default OPS_ACTION_FAILED when a specific action already exists. */
  auditAction?: string;
  metadata?: Record<string, unknown>;
};

export async function recordFailedAction(input: RecordFailedActionInput): Promise<void> {
  const source = normalizeFailedActionSource(input.source);
  const auditAction = input.auditAction ?? "OPS_ACTION_FAILED";

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: auditAction,
    entityType: input.entityType,
    entityId: input.entityId,
    targetUserId: input.targetUserId,
    targetAccountId: input.targetAccountId,
    targetCompanyId: input.targetCompanyId,
    targetTransactionId: input.targetTransactionId,
    targetLoanId: input.targetLoanId,
    description: `Failed ${input.actionAttempted}: ${input.failureReason}`,
    metadata: buildAuditMetadata(
      { source, severity: "warning", reason: input.failureReason },
      {
        actionAttempted: input.actionAttempted,
        failureReason: input.failureReason,
        amount: input.amount ?? null,
        internalLink: input.internalLink ?? null,
        ...input.metadata,
      },
    ),
  });
}

export async function recordPermissionDeniedAction(input: {
  actorUserId: string;
  actionAttempted: string;
  entityType: AuditEntityType;
  entityId?: string;
  source?: FailedActionSource | string;
  internalLink?: string;
}): Promise<void> {
  await recordFailedAction({
    ...input,
    failureReason: "Permission denied",
    auditAction: "OPS_PERMISSION_DENIED",
  });
}
