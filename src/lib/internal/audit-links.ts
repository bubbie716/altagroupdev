import type { AuditEntityType } from "@prisma/client";
import type { AuditLogFilters } from "@/lib/internal/audit.types";

/** Build an internal audit log URL with query filters. */
export function auditFilterHref(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
  if (filters.targetUserId) params.set("targetUserId", filters.targetUserId);
  if (filters.targetAccountId) params.set("targetAccountId", filters.targetAccountId);
  if (filters.targetCompanyId) params.set("targetCompanyId", filters.targetCompanyId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `/internal/audit?${qs}` : "/internal/audit";
}

export function entityAuditHref(entityType: AuditEntityType, entityId: string): string {
  return auditFilterHref({ entityType, entityId });
}
