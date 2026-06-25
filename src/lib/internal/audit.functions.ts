import { createServerFn } from "@tanstack/react-start";
import type { AuditEntityType } from "@prisma/client";
import type { AuditLogFilters } from "@/lib/internal/audit.types";

export const fetchRecentAuditLogs = createServerFn({ method: "GET" })
  .inputValidator((limit?: number) => limit)
  .handler(async ({ data: limit }) => {
    const { listRecentAuditLogs } = await import("@/server/audit.service");
    await import("@/server/permissions.service").then((m) => m.requireOperator());
    return listRecentAuditLogs(limit ?? 25);
  });

export const fetchAuditLogs = createServerFn({ method: "GET" })
  .inputValidator((filters: AuditLogFilters) => filters)
  .handler(async ({ data: filters }) => {
    const { queryAuditLogs } = await import("@/server/audit.service");
    await import("@/server/permissions.service").then((m) => m.requireOperator());
    return queryAuditLogs(filters);
  });

export const fetchAuditLogsForEntity = createServerFn({ method: "GET" })
  .inputValidator((input: { entityType: AuditEntityType; entityId: string }) => input)
  .handler(async ({ data }) => {
    const { listAuditLogsForTarget } = await import("@/server/audit.service");
    await import("@/server/permissions.service").then((m) => m.requireOperator());
    return listAuditLogsForTarget(data.entityType, data.entityId);
  });
