import type { AuditEntityType } from "@prisma/client";
import type { WriteAuditLogInput } from "@/lib/internal/audit.types";

export type AuditSource = "USER" | "ADMIN" | "OPERATOR" | "SYSTEM" | "CRON";

export type AuditSeverity = "info" | "warning" | "critical";

export type OpsAuditMetadata = {
  source: AuditSource;
  severity?: AuditSeverity;
  reason?: string;
  actorUserId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export function buildAuditMetadata(
  partial: OpsAuditMetadata,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    source: partial.source,
    severity: partial.severity ?? "info",
    reason: partial.reason ?? null,
    entityType: partial.entityType ?? null,
    entityId: partial.entityId ?? null,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    ...extra,
  };
}

/** Merge standardized metadata into writeAuditLog input. */
export function withAuditMetadata(
  input: WriteAuditLogInput,
  meta: OpsAuditMetadata,
): WriteAuditLogInput {
  return {
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
      ...buildAuditMetadata(meta, input.metadata ?? undefined),
    },
  };
}
