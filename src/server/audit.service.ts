import type { AuditEntityType, Prisma } from "@prisma/client";
import type { AuditLogFilters, AuditLogRow, WriteAuditLogInput } from "@/lib/internal/audit.types";
import { prisma } from "@/server/db";

function mapAuditRow(
  row: Prisma.AuditLogGetPayload<{
    include: { actor: { select: { discordUsername: true } } };
  }>,
  targetUsername: string | null,
): AuditLogRow {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    actorUsername: row.actor.discordUsername,
    targetUserId: row.targetUserId,
    targetUsername,
    targetAccountId: row.targetAccountId,
    targetCompanyId: row.targetCompanyId,
    targetTransactionId: row.targetTransactionId,
    targetLoanId: row.targetLoanId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    description: row.description,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      targetAccountId: input.targetAccountId ?? null,
      targetCompanyId: input.targetCompanyId ?? null,
      targetTransactionId: input.targetTransactionId ?? null,
      targetLoanId: input.targetLoanId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      metadata: input.metadata ?? undefined,
    },
  });
}

function buildAuditWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { actor: { discordUsername: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (filters.action) and.push({ action: filters.action });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.actorUserId) and.push({ actorUserId: filters.actorUserId });
  if (filters.targetUserId) and.push({ targetUserId: filters.targetUserId });
  if (filters.targetAccountId) and.push({ targetAccountId: filters.targetAccountId });
  if (filters.targetCompanyId) and.push({ targetCompanyId: filters.targetCompanyId });

  if (filters.from) {
    and.push({ createdAt: { gte: new Date(filters.from) } });
  }
  if (filters.to) {
    and.push({ createdAt: { lte: new Date(filters.to) } });
  }

  return and.length > 0 ? { AND: and } : {};
}

async function resolveTargetUsernames(rows: { targetUserId: string | null }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.targetUserId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, discordUsername: true },
  });
  return new Map(users.map((u) => [u.id, u.discordUsername]));
}

export async function listRecentAuditLogs(limit = 25): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const targetMap = await resolveTargetUsernames(rows);
  return rows.map((row) => mapAuditRow(row, row.targetUserId ? targetMap.get(row.targetUserId) ?? null : null));
}

export async function queryAuditLogs(filters: AuditLogFilters, limit = 200): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: buildAuditWhere(filters),
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const targetMap = await resolveTargetUsernames(rows);
  return rows.map((row) => mapAuditRow(row, row.targetUserId ? targetMap.get(row.targetUserId) ?? null : null));
}

export async function listAuditLogsForTarget(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType, entityId },
        { targetUserId: entityId },
        { targetAccountId: entityId },
        { targetCompanyId: entityId },
        { targetLoanId: entityId },
        { targetTransactionId: entityId },
      ],
    },
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const targetMap = await resolveTargetUsernames(rows);
  return rows.map((row) => mapAuditRow(row, row.targetUserId ? targetMap.get(row.targetUserId) ?? null : null));
}
