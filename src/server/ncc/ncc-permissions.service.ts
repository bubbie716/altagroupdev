import type { InstitutionMemberRole, NccStaffMembership, NccStaffRole } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canAccessInternal } from "@/lib/auth/permissions";
import {
  institutionRoleHasPermission,
  type NccInstitutionPermission,
} from "@/lib/ncc/ncc-permissions";
import {
  staffRoleHasPermission,
  type NccStaffPermission,
} from "@/lib/ncc/ncc-staff-permissions";
import { requireAuth } from "@/server/auth.service";
import { prisma } from "@/server/db";

function forbid(): never {
  throw new Error("FORBIDDEN");
}

export type NccStaffActor = AltaUser & {
  nccStaffRole: NccStaffRole;
  nccStaffMembershipId: string;
};

export async function getActiveNccStaffMembership(
  userId: string,
): Promise<NccStaffMembership | null> {
  return prisma.nccStaffMembership.findFirst({
    where: { userId, status: "ACTIVE" },
  });
}

/**
 * Dedicated NCC staff authorization.
 * Internal platform access alone does NOT grant NCC financial authority.
 */
export async function requireNccStaff(
  permission: NccStaffPermission = "view_control_plane",
): Promise<NccStaffActor> {
  const user = await requireAuth();
  const membership = await getActiveNccStaffMembership(user.id);
  if (!membership || !staffRoleHasPermission(membership.role, permission)) {
    forbid();
  }
  return {
    ...user,
    nccStaffRole: membership.role,
    nccStaffMembershipId: membership.id,
  };
}

/** Soft check — does not throw. */
export async function hasNccStaffPermission(
  userId: string,
  permission: NccStaffPermission,
): Promise<boolean> {
  const membership = await getActiveNccStaffMembership(userId);
  if (!membership) return false;
  return staffRoleHasPermission(membership.role, permission);
}

export async function getActiveInstitutionMembership(userId: string, institutionId: string) {
  return prisma.institutionMember.findFirst({
    where: { userId, institutionId, status: "ACTIVE" },
  });
}

/**
 * Participant institution permissions.
 * Internal users and NCC staff do NOT automatically receive institution-owner rights.
 */
export async function requireInstitutionPermission(
  institutionId: string,
  permission: NccInstitutionPermission,
): Promise<{ user: AltaUser; role: InstitutionMemberRole }> {
  const user = await requireAuth();
  const membership = await getActiveInstitutionMembership(user.id, institutionId);
  if (!membership || !institutionRoleHasPermission(membership.role, permission)) {
    forbid();
  }
  return { user, role: membership.role };
}

export async function assertInstitutionAccess(
  user: AltaUser,
  institutionId: string,
  permission: NccInstitutionPermission,
): Promise<InstitutionMemberRole> {
  const membership = await getActiveInstitutionMembership(user.id, institutionId);
  if (!membership || !institutionRoleHasPermission(membership.role, permission)) {
    forbid();
  }
  return membership.role;
}

/**
 * Optional helper for non-financial internal tooling that still needs Alta Group access.
 * Must not be used for NCC settlement / liquidity / activation authority.
 */
export async function requireInternalPlatformAccess(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!canAccessInternal(user)) forbid();
  return user;
}
