import type { NccStaffMembership, NccStaffRole } from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  assertTypedConfirmation,
  isNccAdministratorRole,
  NCC_ADMIN_ROLES,
} from "@/lib/ncc/ncc-staff-permissions";
import { prisma } from "@/server/db";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccStaffError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccStaffError";
  }
}

const ROLE_RANK: Record<NccStaffRole, number> = {
  VIEWER: 0,
  AUDITOR: 1,
  COMPLIANCE_ANALYST: 2,
  SETTLEMENT_OPERATOR: 2,
  LIQUIDITY_OPERATOR: 2,
  SENIOR_APPROVER: 3,
  NCC_ADMINISTRATOR: 4,
  EMERGENCY_ADMINISTRATOR: 5,
};

function requireReason(reason: string | undefined | null): string {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) throw new NccStaffError("REASON_REQUIRED");
  return trimmed;
}

async function writeStaffAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_STAFF_MEMBERSHIP",
    entityId: input.entityId,
    targetUserId: input.targetUserId,
    description: input.description,
    metadata: input.metadata,
  });
}

function assertNotSelfEscalation(input: {
  actorUserId: string;
  actorRole: NccStaffRole;
  targetUserId: string;
  nextRole: NccStaffRole;
  /** True when target has no ACTIVE membership yet. */
  isNewMembership: boolean;
}) {
  if (input.actorUserId !== input.targetUserId) return;

  if (input.isNewMembership && !isNccAdministratorRole(input.actorRole)) {
    throw new NccStaffError(
      "SELF_ASSIGNMENT_DENIED",
      "Cannot grant yourself NCC staff membership unless already an administrator.",
    );
  }

  const actorRank = ROLE_RANK[input.actorRole];
  const nextRank = ROLE_RANK[input.nextRole];
  if (nextRank > actorRank) {
    throw new NccStaffError(
      "SELF_ESCALATION_DENIED",
      "Cannot assign or escalate your own NCC staff role.",
    );
  }
  if (isNccAdministratorRole(input.nextRole) && input.nextRole !== input.actorRole) {
    throw new NccStaffError(
      "SELF_ESCALATION_DENIED",
      "Cannot assign yourself a different administrator role.",
    );
  }
}

async function countActiveAdministrators(excludeMembershipId?: string): Promise<number> {
  return prisma.nccStaffMembership.count({
    where: {
      status: "ACTIVE",
      role: { in: [...NCC_ADMIN_ROLES] },
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}),
    },
  });
}

async function assertNotFinalAdministrator(membership: NccStaffMembership): Promise<void> {
  if (membership.status !== "ACTIVE" || !isNccAdministratorRole(membership.role)) return;
  const remaining = await countActiveAdministrators(membership.id);
  if (remaining === 0) {
    throw new NccStaffError(
      "FINAL_ADMINISTRATOR",
      "Cannot revoke or demote the final active NCC administrator.",
    );
  }
}

export async function listNccStaff() {
  await requireNccStaff("manage_staff");
  return prisma.nccStaffMembership.findMany({
    where: { status: "ACTIVE" },
    include: {
      user: {
        select: {
          id: true,
          discordUsername: true,
          discordId: true,
          email: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function assignNccStaff(input: {
  userId: string;
  role: NccStaffRole;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_staff");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const existing = await prisma.nccStaffMembership.findUnique({
    where: { userId: input.userId },
  });

  assertNotSelfEscalation({
    actorUserId: actor.id,
    actorRole: actor.nccStaffRole,
    targetUserId: input.userId,
    nextRole: input.role,
    isNewMembership: !existing || existing.status !== "ACTIVE",
  });

  if (existing?.status === "ACTIVE") {
    throw new NccStaffError("ALREADY_ACTIVE", "User already has an active NCC staff membership.");
  }

  const membership = existing
    ? await prisma.nccStaffMembership.update({
        where: { id: existing.id },
        data: {
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: actor.id,
          revokedAt: null,
          revokedByUserId: null,
          revokeReason: null,
        },
      })
    : await prisma.nccStaffMembership.create({
        data: {
          userId: input.userId,
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: actor.id,
        },
      });

  await writeStaffAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.STAFF_ASSIGNED,
    entityId: membership.id,
    targetUserId: input.userId,
    description: `NCC staff assigned role ${input.role}`,
    metadata: { role: input.role, reason },
  });

  return membership;
}

export async function updateNccStaffRole(input: {
  userId: string;
  role: NccStaffRole;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_staff");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const membership = await prisma.nccStaffMembership.findUnique({
    where: { userId: input.userId },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new NccStaffError("NOT_FOUND", "Active NCC staff membership not found.");
  }

  assertNotSelfEscalation({
    actorUserId: actor.id,
    actorRole: actor.nccStaffRole,
    targetUserId: input.userId,
    nextRole: input.role,
    isNewMembership: false,
  });

  if (isNccAdministratorRole(membership.role) && !isNccAdministratorRole(input.role)) {
    await assertNotFinalAdministrator(membership);
  }

  const updated = await prisma.nccStaffMembership.update({
    where: { id: membership.id },
    data: { role: input.role },
  });

  await writeStaffAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.STAFF_ROLE_UPDATED,
    entityId: updated.id,
    targetUserId: input.userId,
    description: `NCC staff role changed from ${membership.role} to ${input.role}`,
    metadata: { fromRole: membership.role, toRole: input.role, reason },
  });

  return updated;
}

export async function revokeNccStaff(input: {
  userId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_staff");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const membership = await prisma.nccStaffMembership.findUnique({
    where: { userId: input.userId },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new NccStaffError("NOT_FOUND", "Active NCC staff membership not found.");
  }

  await assertNotFinalAdministrator(membership);

  const updated = await prisma.nccStaffMembership.update({
    where: { id: membership.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedByUserId: actor.id,
      revokeReason: reason,
    },
  });

  await writeStaffAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.STAFF_REVOKED,
    entityId: updated.id,
    targetUserId: input.userId,
    description: `NCC staff membership revoked (was ${membership.role})`,
    metadata: { priorRole: membership.role, reason },
  });

  return updated;
}

/**
 * Test/seed bootstrap only. Creates an NCC_ADMINISTRATOR when ZERO active
 * administrators exist. Does not bypass confirmation when admins already exist.
 */
export async function ensureBootstrapNccAdministrator(userId: string): Promise<NccStaffMembership> {
  const adminCount = await countActiveAdministrators();
  if (adminCount > 0) {
    throw new NccStaffError(
      "BOOTSTRAP_DENIED",
      "Bootstrap administrator is only allowed when zero active administrators exist.",
    );
  }

  const existing = await prisma.nccStaffMembership.findUnique({ where: { userId } });
  const membership = existing
    ? await prisma.nccStaffMembership.update({
        where: { id: existing.id },
        data: {
          role: "NCC_ADMINISTRATOR",
          status: "ACTIVE",
          revokedAt: null,
          revokedByUserId: null,
          revokeReason: null,
        },
      })
    : await prisma.nccStaffMembership.create({
        data: {
          userId,
          role: "NCC_ADMINISTRATOR",
          status: "ACTIVE",
        },
      });

  await writeStaffAudit({
    actorUserId: userId,
    action: NCC_AUDIT.STAFF_BOOTSTRAP_ADMIN,
    entityId: membership.id,
    targetUserId: userId,
    description: "Bootstrap NCC administrator created (zero prior admins)",
    metadata: { bootstrap: true },
  });

  return membership;
}
