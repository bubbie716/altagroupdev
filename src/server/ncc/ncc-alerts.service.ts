import type {
  NccOperationalAlert,
  NccOperationalAlertSeverity,
  NccOperationalAlertStatus,
  Prisma,
} from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { prisma } from "@/server/db";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccAlertError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccAlertError";
  }
}

async function writeAlertAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_OPERATIONAL_ALERT",
    entityId: input.entityId,
    description: input.description,
    metadata: input.metadata,
  });
}

/**
 * Idempotent open-alert upsert by alertKey (does not duplicate OPEN/ACKNOWLEDGED).
 * Auth-free for trusted server callers (network mode, workers). Prefer upsertOpenAlert.
 */
export async function upsertOpenAlertRecord(input: {
  alertKey: string;
  title: string;
  detail?: string | null;
  severity?: NccOperationalAlertSeverity;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actorUserId?: string;
}): Promise<NccOperationalAlert> {
  const alertKey = input.alertKey.trim();
  if (!alertKey) throw new NccAlertError("ALERT_KEY_REQUIRED");

  const existing = await prisma.nccOperationalAlert.findFirst({
    where: {
      alertKey,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.nccOperationalAlert.update({
      where: { id: existing.id },
      data: {
        title: input.title.trim(),
        detail: input.detail?.trim() || existing.detail,
        severity: input.severity ?? existing.severity,
        entityType: input.entityType ?? existing.entityType,
        entityId: input.entityId ?? existing.entityId,
        metadata:
          input.metadata !== undefined
            ? (input.metadata as Prisma.InputJsonValue)
            : (existing.metadata ?? undefined),
      },
    });
  }

  const created = await prisma.nccOperationalAlert.create({
    data: {
      alertKey,
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      severity: input.severity ?? "WARNING",
      status: "OPEN",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  if (input.actorUserId) {
    await writeAlertAudit({
      actorUserId: input.actorUserId,
      action: NCC_AUDIT.ALERT_CREATED,
      entityId: created.id,
      description: `Alert opened: ${created.title}`,
      metadata: { alertKey: created.alertKey, severity: created.severity },
    });
  }

  return created;
}

export async function upsertOpenAlert(input: {
  alertKey: string;
  title: string;
  detail?: string | null;
  severity?: NccOperationalAlertSeverity;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const actor = await requireNccStaff("manage_alerts");
  return upsertOpenAlertRecord({ ...input, actorUserId: actor.id });
}

export async function acknowledgeAlert(input: { alertId: string }) {
  const actor = await requireNccStaff("manage_alerts");
  const alert = await prisma.nccOperationalAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) throw new NccAlertError("NOT_FOUND");
  if (alert.status === "RESOLVED") throw new NccAlertError("ALREADY_RESOLVED");
  if (alert.status === "ACKNOWLEDGED") return alert;

  const updated = await prisma.nccOperationalAlert.update({
    where: { id: alert.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedByUserId: actor.id,
      acknowledgedAt: new Date(),
    },
  });

  await writeAlertAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ALERT_ACKNOWLEDGED,
    entityId: updated.id,
    description: `Alert acknowledged: ${updated.title}`,
  });

  return updated;
}

export async function resolveAlert(input: { alertId: string; note?: string }) {
  const actor = await requireNccStaff("manage_alerts");
  const alert = await prisma.nccOperationalAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) throw new NccAlertError("NOT_FOUND");
  if (alert.status === "RESOLVED") return alert;

  const note = input.note?.trim();
  const updated = await prisma.nccOperationalAlert.update({
    where: { id: alert.id },
    data: {
      status: "RESOLVED",
      resolvedByUserId: actor.id,
      resolvedAt: new Date(),
      ...(note
        ? {
            notes: alert.notes ? `${alert.notes}\n${note}` : note,
          }
        : {}),
    },
  });

  await writeAlertAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ALERT_RESOLVED,
    entityId: updated.id,
    description: `Alert resolved: ${updated.title}`,
  });

  return updated;
}

export async function assignAlert(input: { alertId: string; assignedToUserId: string | null }) {
  const actor = await requireNccStaff("manage_alerts");
  const alert = await prisma.nccOperationalAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) throw new NccAlertError("NOT_FOUND");
  if (alert.status === "RESOLVED") throw new NccAlertError("ALREADY_RESOLVED");

  const updated = await prisma.nccOperationalAlert.update({
    where: { id: alert.id },
    data: { assignedToUserId: input.assignedToUserId },
  });

  await writeAlertAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ALERT_ASSIGNED,
    entityId: updated.id,
    description: input.assignedToUserId
      ? `Alert assigned to ${input.assignedToUserId}`
      : "Alert unassigned",
    metadata: { assignedToUserId: input.assignedToUserId },
  });

  return updated;
}

export async function addAlertNote(input: { alertId: string; note: string }) {
  const actor = await requireNccStaff("manage_alerts");
  const note = input.note.trim();
  if (!note) throw new NccAlertError("NOTE_REQUIRED");

  const alert = await prisma.nccOperationalAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) throw new NccAlertError("NOT_FOUND");

  const stamped = `[${new Date().toISOString()} ${actor.id}] ${note}`;
  const updated = await prisma.nccOperationalAlert.update({
    where: { id: alert.id },
    data: {
      notes: alert.notes ? `${alert.notes}\n${stamped}` : stamped,
    },
  });

  await writeAlertAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ALERT_NOTE_ADDED,
    entityId: updated.id,
    description: `Note added to alert: ${updated.title}`,
  });

  return updated;
}

export async function listAlerts(options?: {
  status?: NccOperationalAlertStatus | NccOperationalAlertStatus[];
  severity?: NccOperationalAlertSeverity;
  limit?: number;
}) {
  await requireNccStaff("view_health");
  const statusFilter = options?.status
    ? Array.isArray(options.status)
      ? { in: options.status }
      : options.status
    : undefined;

  return prisma.nccOperationalAlert.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(options?.severity ? { severity: options.severity } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: Math.min(options?.limit ?? 100, 500),
  });
}
