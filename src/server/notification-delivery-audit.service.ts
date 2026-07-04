import type { AuditEntityType } from "@prisma/client";
import { buildAuditMetadata } from "@/lib/internal/audit-metadata";
import { writeAuditLog } from "@/server/audit.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

export type CustomerDmDeliveryFailureInput = {
  actorUserId: string;
  userId: string;
  title: string;
  reason: string;
  retryable?: boolean;
  source?: string;
  sourceAction?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function recordCustomerDmDeliveryFailure(
  input: CustomerDmDeliveryFailureInput,
): Promise<void> {
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "CUSTOMER_DM_DELIVERY_FAILED",
    entityType: input.entityType ?? "USER",
    entityId: input.entityId ?? input.userId,
    targetUserId: input.userId,
    description: `Customer DM not delivered: ${input.title}`,
    metadata: buildAuditMetadata(
      { source: input.source ?? "INTERNAL", severity: "warning", reason: input.reason },
      {
        notificationTitle: input.title,
        deliveryChannel: "DISCORD_DM",
        retryable: input.retryable ?? isRetryableDeliveryFailure(input.reason),
        sourceAction: input.sourceAction ?? null,
        ...input.metadata,
      },
    ),
  });
}

export async function recordStaffAuditMessageFailure(input: {
  actorUserId?: string;
  product: string;
  action: string;
  reason: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const actorUserId = input.actorUserId ?? (await resolveSystemActorUserId());
  await writeAuditLog({
    actorUserId,
    action: "STAFF_AUDIT_MESSAGE_FAILED",
    entityType: "PLATFORM",
    description: `Staff audit message not delivered: ${input.product} · ${input.action}`,
    metadata: buildAuditMetadata(
      { source: "INTERNAL", severity: "warning", reason: input.reason },
      {
        product: input.product,
        staffAction: input.action,
        deliveryChannel: "DISCORD_STAFF_AUDIT",
        retryable: input.retryable ?? isRetryableDeliveryFailure(input.reason),
        ...input.metadata,
      },
    ),
  });
}

export async function recordOpsNotificationDeliveryFailure(input: {
  actorUserId: string;
  notificationKind: string;
  reason: string;
  retryable?: boolean;
  entityType?: AuditEntityType;
  entityId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "OPS_NOTIFICATION_DELIVERY_FAILED",
    entityType: input.entityType ?? "USER",
    entityId: input.entityId ?? input.targetUserId,
    targetUserId: input.targetUserId,
    description: `Notification delivery failed: ${input.notificationKind}`,
    metadata: buildAuditMetadata(
      { source: "INTERNAL", severity: "warning", reason: input.reason },
      {
        notificationKind: input.notificationKind,
        retryable: input.retryable ?? isRetryableDeliveryFailure(input.reason),
        ...input.metadata,
      },
    ),
  });
}

export function isRetryableDeliveryFailure(reason: string | undefined): boolean {
  if (!reason) return true;
  const normalized = reason.toLowerCase();
  if (normalized === "duplicate") return false;
  if (normalized.includes("no_discord")) return false;
  if (normalized.includes("not linked")) return false;
  if (normalized.includes("disabled")) return false;
  if (normalized.includes("preference")) return false;
  if (normalized.includes("forbidden")) return false;
  return true;
}
