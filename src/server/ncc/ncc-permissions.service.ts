import type { InstitutionMemberRole } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canAccessInternal } from "@/lib/auth/permissions";
import { requireAuth } from "@/server/auth.service";
import { prisma } from "@/server/db";
import {
  institutionRoleHasPermission,
  type NccInstitutionPermission,
} from "@/lib/ncc/ncc-permissions";

function forbid(): never {
  throw new Error("FORBIDDEN");
}

/** NCC internal staff — Alta Group operator/admin until dedicated NCC tags land. */
export async function requireNccStaff(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!canAccessInternal(user)) forbid();
  return user;
}

export async function getActiveInstitutionMembership(userId: string, institutionId: string) {
  return prisma.institutionMember.findFirst({
    where: { userId, institutionId, status: "ACTIVE" },
  });
}

export async function requireInstitutionPermission(
  institutionId: string,
  permission: NccInstitutionPermission,
): Promise<{ user: AltaUser; role: InstitutionMemberRole }> {
  const user = await requireAuth();
  if (canAccessInternal(user)) {
    return { user, role: "INSTITUTION_OWNER" };
  }

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
  if (canAccessInternal(user)) return "INSTITUTION_OWNER";
  const membership = await getActiveInstitutionMembership(user.id, institutionId);
  if (!membership || !institutionRoleHasPermission(membership.role, permission)) {
    forbid();
  }
  return membership.role;
}
