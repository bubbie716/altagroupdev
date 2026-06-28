import type { OpsExceptionDispositionStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isMissingOpsV1TableError } from "@/server/ops-prisma-guard";

export type ExceptionDispositionRow = {
  exceptionKey: string;
  status: OpsExceptionDispositionStatus;
  lastReason: string | null;
  lastActorUsername: string | null;
  updatedAt: string;
};

export async function listExceptionDispositions(): Promise<ExceptionDispositionRow[]> {
  await requireOperator();
  try {
    const rows = await prisma.opsExceptionDisposition.findMany({
      include: { lastActor: true },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => ({
      exceptionKey: r.exceptionKey,
      status: r.status,
      lastReason: r.lastReason,
      lastActorUsername: r.lastActor?.discordUsername ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (isMissingOpsV1TableError(error)) return [];
    throw error;
  }
}

export async function getExceptionDispositionMap(): Promise<Map<string, ExceptionDispositionRow>> {
  const rows = await listExceptionDispositions();
  return new Map(rows.map((r) => [r.exceptionKey, r]));
}

export async function setExceptionDisposition(
  actorUserId: string,
  exceptionKey: string,
  status: OpsExceptionDispositionStatus,
  reason: string,
): Promise<ExceptionDispositionRow> {
  await requireOperator();
  const row = await prisma.opsExceptionDisposition.upsert({
    where: { exceptionKey },
    create: {
      exceptionKey,
      status,
      lastReason: reason.trim(),
      lastActorUserId: actorUserId,
    },
    update: {
      status,
      lastReason: reason.trim(),
      lastActorUserId: actorUserId,
    },
    include: { lastActor: true },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "OPS_EXCEPTION_DISPOSITION",
    entityType: "PLATFORM",
    entityId: exceptionKey,
    description: `Exception ${status.toLowerCase()}: ${reason.trim()}`,
    metadata: { exceptionKey, status, reason: reason.trim() },
  });

  return {
    exceptionKey: row.exceptionKey,
    status: row.status,
    lastReason: row.lastReason,
    lastActorUsername: row.lastActor?.discordUsername ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
