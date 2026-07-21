import type { NccNetworkControl, NccNetworkSettlementMode } from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { assertTypedConfirmation } from "@/lib/ncc/ncc-staff-permissions";
import { prisma } from "@/server/db";
import { upsertOpenAlertRecord } from "@/server/ncc/ncc-alerts.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccNetworkControlError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccNetworkControlError";
  }
}

const NETWORK_CONTROL_ID = "default";

function requireReason(reason: string | undefined | null): string {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) throw new NccNetworkControlError("REASON_REQUIRED");
  return trimmed;
}

async function writeNetworkAudit(input: {
  actorUserId: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_NETWORK_CONTROL",
    entityId: NETWORK_CONTROL_ID,
    description: input.description,
    metadata: input.metadata,
  });
}

async function ensureNetworkControl(): Promise<NccNetworkControl> {
  return prisma.nccNetworkControl.upsert({
    where: { id: NETWORK_CONTROL_ID },
    create: { id: NETWORK_CONTROL_ID, mode: "ACTIVE" },
    update: {},
  });
}

export async function getNetworkSettlementMode(): Promise<NccNetworkControl> {
  await requireNccStaff("view_control_plane");
  return ensureNetworkControl();
}

/** Throws NETWORK_PAUSE / NETWORK_EMERGENCY_STOP when new settlements must not start. */
export async function assertNetworkAllowsNewSettlement(): Promise<void> {
  const control = await ensureNetworkControl();
  if (control.mode === "PAUSE_NEW_SETTLEMENTS") {
    throw new NccNetworkControlError(
      "NETWORK_PAUSE",
      "Network is paused for new settlements.",
    );
  }
  if (control.mode === "EMERGENCY_STOP") {
    throw new NccNetworkControlError(
      "NETWORK_EMERGENCY_STOP",
      "Network emergency stop is active.",
    );
  }
}

export async function setNetworkSettlementMode(input: {
  mode: NccNetworkSettlementMode;
  reason: string;
  confirmation: string;
}): Promise<NccNetworkControl> {
  const actor = await requireNccStaff("set_network_mode");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  if (input.mode === "ACTIVE") {
    throw new NccNetworkControlError(
      "DUAL_CONTROL_REQUIRED",
      "Resuming to ACTIVE requires requestNetworkResume + approveNetworkResume.",
    );
  }

  const current = await ensureNetworkControl();
  const updated = await prisma.nccNetworkControl.update({
    where: { id: NETWORK_CONTROL_ID },
    data: {
      mode: input.mode,
      reason,
      updatedByUserId: actor.id,
      pendingResumeRequestedByUserId: null,
      pendingResumeReason: null,
      pendingResumeApprovedByUserId: null,
    },
  });

  const auditAction =
    input.mode === "EMERGENCY_STOP"
      ? NCC_AUDIT.NETWORK_EMERGENCY_STOP
      : input.mode === "PAUSE_NEW_SETTLEMENTS"
        ? NCC_AUDIT.NETWORK_PAUSED
        : NCC_AUDIT.NETWORK_MODE_CHANGED;

  await writeNetworkAudit({
    actorUserId: actor.id,
    action: auditAction,
    description: `Network settlement mode set to ${input.mode}`,
    metadata: { fromMode: current.mode, toMode: input.mode, reason },
  });

  await upsertOpenAlertRecord({
    alertKey: `network.mode.${input.mode}`,
    title:
      input.mode === "EMERGENCY_STOP"
        ? "Network emergency stop active"
        : "Network new settlements paused",
    detail: reason,
    severity: input.mode === "EMERGENCY_STOP" ? "CRITICAL" : "WARNING",
    entityType: "NCC_NETWORK_CONTROL",
    entityId: NETWORK_CONTROL_ID,
    metadata: { mode: input.mode, fromMode: current.mode },
    actorUserId: actor.id,
  });

  return updated;
}

export async function requestNetworkResume(input: {
  reason: string;
  confirmation: string;
}): Promise<NccNetworkControl> {
  const actor = await requireNccStaff("request_network_resume");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const current = await ensureNetworkControl();
  if (current.mode === "ACTIVE") {
    throw new NccNetworkControlError("ALREADY_ACTIVE", "Network is already ACTIVE.");
  }

  const updated = await prisma.nccNetworkControl.update({
    where: { id: NETWORK_CONTROL_ID },
    data: {
      pendingResumeRequestedByUserId: actor.id,
      pendingResumeReason: reason,
      pendingResumeApprovedByUserId: null,
      updatedByUserId: actor.id,
    },
  });

  await writeNetworkAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.NETWORK_RESUME_REQUESTED,
    description: `Network resume requested from ${current.mode}`,
    metadata: { mode: current.mode, reason },
  });

  await upsertOpenAlertRecord({
    alertKey: "network.resume.pending",
    title: "Network resume pending dual-control approval",
    detail: reason,
    severity: "WARNING",
    entityType: "NCC_NETWORK_CONTROL",
    entityId: NETWORK_CONTROL_ID,
    metadata: { mode: current.mode, requestedByUserId: actor.id },
    actorUserId: actor.id,
  });

  return updated;
}

export async function approveNetworkResume(input: {
  confirmation: string;
}): Promise<NccNetworkControl> {
  const actor = await requireNccStaff("approve_network_resume");
  assertTypedConfirmation(input.confirmation);

  const current = await ensureNetworkControl();
  if (current.mode === "ACTIVE") {
    throw new NccNetworkControlError("ALREADY_ACTIVE", "Network is already ACTIVE.");
  }
  if (!current.pendingResumeRequestedByUserId || !current.pendingResumeReason) {
    throw new NccNetworkControlError(
      "RESUME_NOT_REQUESTED",
      "No pending network resume request.",
    );
  }
  if (current.pendingResumeRequestedByUserId === actor.id) {
    throw new NccNetworkControlError(
      "SELF_APPROVAL_DENIED",
      "A different authorized staff member must approve network resume.",
    );
  }

  const updated = await prisma.nccNetworkControl.update({
    where: { id: NETWORK_CONTROL_ID },
    data: {
      mode: "ACTIVE",
      reason: current.pendingResumeReason,
      updatedByUserId: actor.id,
      pendingResumeApprovedByUserId: actor.id,
      pendingResumeRequestedByUserId: null,
      pendingResumeReason: null,
    },
  });

  await writeNetworkAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.NETWORK_RESUME_APPROVED,
    description: `Network resume approved; mode set to ACTIVE`,
    metadata: {
      fromMode: current.mode,
      requestedByUserId: current.pendingResumeRequestedByUserId,
      reason: current.pendingResumeReason,
    },
  });

  // Resolve the pending resume alert if open.
  const pending = await prisma.nccOperationalAlert.findFirst({
    where: {
      alertKey: "network.resume.pending",
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
  });
  if (pending) {
    await prisma.nccOperationalAlert.update({
      where: { id: pending.id },
      data: {
        status: "RESOLVED",
        resolvedByUserId: actor.id,
        resolvedAt: new Date(),
      },
    });
  }

  return updated;
}
