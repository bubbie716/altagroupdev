import type { AuditEntityType } from "@prisma/client";
import type { AuditLogFilters } from "@/lib/internal/audit.types";
import { serializeInternalSearch } from "@/lib/internal/normalize-internal-search";

/** Build an internal audit log URL with query filters (canonical param order). */
export function auditFilterHref(
  filters: AuditLogFilters & { site?: string | null },
): string {
  const qs = serializeInternalSearch({
    site: filters.site ?? undefined,
    q: filters.q,
    action: filters.action,
    entityType: filters.entityType,
    entityId: filters.entityId,
    actorUserId: filters.actorUserId,
    targetUserId: filters.targetUserId,
    targetAccountId: filters.targetAccountId,
    targetCompanyId: filters.targetCompanyId,
    from: filters.from,
    to: filters.to,
  });
  return qs ? `/internal/audit?${qs}` : "/internal/audit";
}

export function entityAuditHref(
  entityType: AuditEntityType,
  entityId: string,
  site?: string | null,
): string {
  return auditFilterHref({ entityType, entityId, site });
}
