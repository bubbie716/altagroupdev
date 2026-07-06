import type { CompanyRole } from "@/lib/auth/types";
import type {
  CompaniesDashboardData,
  CompanyDetail,
  CompanySummary,
  CreateCompanyInput,
  InternalCompanyRow,
  RemoveMemberInput,
  SendInvitationInput,
  UpdateCompanySettingsInput,
  UpdateMemberRoleInput,
} from "@/lib/company/types";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth.service";
import {
  mapCompanyDetail,
  mapCompanyInvitation,
  mapCompanySummary,
  mapInternalCompanyRow,
  toDbCompanyType,
  toDbMemberRole,
} from "@/server/company-mapper";
import { fromDbCompanyRole } from "@/server/enum-map";
import {
  canAssignCompanyRole,
  canManageCompanyMember,
} from "@/lib/auth/permissions";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function requireMembership(companyId: string, userId: string) {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) forbidden();
  return membership;
}

function canManageMembers(role: CompanyRole): boolean {
  return role === "owner" || role === "executive";
}

const INVITATION_TTL_DAYS = 30;

function parseDiscordIdentifier(identifier: string): { discordId?: string; username: string } {
  const trimmed = identifier.trim().replace(/^@/, "");
  if (/^\d{17,20}$/.test(trimmed)) {
    return { discordId: trimmed, username: trimmed };
  }
  return { username: trimmed };
}

function invitationExpiryDate(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + INVITATION_TTL_DAYS);
  return expires;
}

async function findPendingInvitation(companyId: string, userId?: string, discordId?: string, username?: string) {
  return prisma.companyInvitation.findFirst({
    where: {
      companyId,
      status: "PENDING",
      OR: [
        userId ? { invitedUserId: userId } : undefined,
        discordId ? { invitedDiscordId: discordId } : undefined,
        username
          ? { invitedDiscordUsername: { equals: username, mode: "insensitive" } }
          : undefined,
      ].filter(Boolean) as { invitedUserId?: string; invitedDiscordId?: string; invitedDiscordUsername?: { equals: string; mode: "insensitive" } }[],
    },
  });
}

async function invitationMatchesUser(
  invitation: { invitedUserId: string | null; invitedDiscordId: string | null; invitedDiscordUsername: string | null },
  userId: string,
  discordId: string,
  discordUsername: string,
): Promise<boolean> {
  if (invitation.invitedUserId === userId) return true;
  if (invitation.invitedDiscordId && invitation.invitedDiscordId === discordId) return true;
  if (
    invitation.invitedDiscordUsername &&
    invitation.invitedDiscordUsername.toLowerCase() === discordUsername.toLowerCase()
  ) {
    return true;
  }
  return false;
}

async function expireStaleInvitations(userId: string, discordId: string, discordUsername: string) {
  const now = new Date();
  const pending = await prisma.companyInvitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
      OR: [
        { invitedUserId: userId },
        { invitedDiscordId: discordId },
        { invitedDiscordUsername: { equals: discordUsername, mode: "insensitive" } },
      ],
    },
  });
  if (pending.length === 0) return;
  await prisma.companyInvitation.updateMany({
    where: { id: { in: pending.map((i) => i.id) } },
    data: { status: "EXPIRED", respondedAt: now },
  });
}

const companyWithMembersInclude = {
  memberships: {
    include: { user: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export async function listUserCompanies(userId: string): Promise<CompanySummary[]> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });

  return memberships.map((m) => mapCompanySummary(m.company, fromDbCompanyRole(m.role)));
}

export async function listUserPendingInvitations(userId: string, discordId: string, discordUsername: string) {
  await expireStaleInvitations(userId, discordId, discordUsername);
  const now = new Date();
  const invitations = await prisma.companyInvitation.findMany({
    where: {
      status: "PENDING",
      AND: [
        {
          OR: [
            { invitedUserId: userId },
            { invitedDiscordId: discordId },
            { invitedDiscordUsername: { equals: discordUsername, mode: "insensitive" } },
          ],
        },
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
    },
    include: { company: true, invitedBy: true },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map(mapCompanyInvitation);
}

export async function getCompaniesDashboard(
  userId: string,
  discordId: string,
  discordUsername: string,
): Promise<CompaniesDashboardData> {
  const [companies, invitations] = await Promise.all([
    listUserCompanies(userId),
    listUserPendingInvitations(userId, discordId, discordUsername),
  ]);
  return { companies, invitations };
}

export async function getCompanyDetailForUser(
  companyId: string,
  userId: string,
): Promise<CompanyDetail> {
  const membership = await requireMembership(companyId, userId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: companyWithMembersInclude,
  });
  if (!company) notFound();
  return mapCompanyDetail(company, userId, fromDbCompanyRole(membership.role));
}

export async function createCompany(
  userId: string,
  input: CreateCompanyInput,
): Promise<{ companyId: string }> {
  const desiredTicker = input.desiredTicker?.trim().toUpperCase() || null;

  let primaryContact = input.primaryContactDiscordUsername?.trim() ?? "";
  if (!primaryContact) {
    const owner = await prisma.user.findUnique({ where: { id: userId } });
    primaryContact = owner?.discordUsername ?? "";
  }

  const company = await prisma.company.create({
    data: {
      name: input.name.trim(),
      type: toDbCompanyType(input.type),
      sector: input.sector.trim(),
      desiredTicker,
      description: input.description.trim(),
      headquarters: input.headquarters?.trim() || null,
      primaryContactDiscordUsername: primaryContact || null,
      intendedUses: input.intendedUses,
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      memberships: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: "COMPANY_CREATED",
    entityType: "COMPANY",
    entityId: company.id,
    targetCompanyId: company.id,
    targetUserId: userId,
    description: `Created company ${company.name}`,
    metadata: auditSourceMetadata("website", { companyName: company.name }),
  });

  return { companyId: company.id };
}

export async function updateCompanySettings(
  userId: string,
  input: UpdateCompanySettingsInput,
): Promise<{ companyId: string }> {
  const membership = await requireMembership(input.companyId, userId);
  if (fromDbCompanyRole(membership.role) !== "owner") forbidden();

  const existing = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!existing) notFound();

  const desiredTicker =
    existing.ticker === null
      ? input.desiredTicker?.trim().toUpperCase() || null
      : existing.desiredTicker;

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      name: input.name.trim(),
      sector: input.sector.trim(),
      description: input.description.trim(),
      headquarters: input.headquarters?.trim() || null,
      desiredTicker,
    },
  });

  return { companyId: input.companyId };
}

export async function updateMemberRole(
  actorUserId: string,
  input: UpdateMemberRoleInput,
): Promise<void> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();

  const target = await prisma.companyMembership.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
  });
  if (!target) notFound();

  const targetRole = fromDbCompanyRole(target.role);
  const nextRole = input.role;

  if (!canManageCompanyMember(actorRole, targetRole)) forbidden();
  if (!canAssignCompanyRole(actorRole, nextRole)) forbidden();

  if (targetRole === "owner" && nextRole !== "owner") {
    const ownerCount = await prisma.companyMembership.count({
      where: { companyId: input.companyId, role: "OWNER" },
    });
    if (ownerCount <= 1) forbidden();
  }

  await prisma.companyMembership.update({
    where: { id: input.membershipId },
    data: { role: toDbMemberRole(nextRole) },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_MEMBER_ROLE_CHANGED",
    entityType: "COMPANY",
    entityId: input.companyId,
    targetCompanyId: input.companyId,
    targetUserId: target.userId,
    description: `Changed member role from ${targetRole} to ${nextRole}`,
    metadata: auditSourceMetadata("website", {
      membershipId: input.membershipId,
      previousRole: targetRole,
      newRole: nextRole,
    }),
  });

  try {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { name: true },
    });
    if (company) {
      const { notifyCompanyRoleChanged } = await import("@/server/banking-notification.service");
      await notifyCompanyRoleChanged(target.userId, {
        companyId: input.companyId,
        companyName: company.name,
        newRole: nextRole,
      });
    }
  } catch (error) {
    console.error("[company] role changed notification failed", error);
  }
}

export async function removeMember(actorUserId: string, input: RemoveMemberInput): Promise<void> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();

  const target = await prisma.companyMembership.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
  });
  if (!target) notFound();

  const targetRole = fromDbCompanyRole(target.role);

  if (!canManageCompanyMember(actorRole, targetRole)) forbidden();

  if (targetRole === "owner") {
    const ownerCount = await prisma.companyMembership.count({
      where: { companyId: input.companyId, role: "OWNER" },
    });
    if (ownerCount <= 1) forbidden();
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_MEMBER_REMOVED",
    entityType: "COMPANY",
    entityId: input.companyId,
    targetCompanyId: input.companyId,
    targetUserId: target.userId,
    description: `Removed company member (${targetRole})`,
    metadata: auditSourceMetadata("website", {
      membershipId: input.membershipId,
      role: targetRole,
    }),
  });

  await prisma.companyMembership.delete({ where: { id: input.membershipId } });
}

export async function sendCompanyInvitation(
  actorUserId: string,
  input: SendInvitationInput,
): Promise<{ invitationId: string }> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();
  if (!canAssignCompanyRole(actorRole, input.role)) forbidden();

  const { assertCommercialTeamMemberLimit } = await import("@/server/commercial-limits.service");
  await assertCommercialTeamMemberLimit(input.companyId);

  const parsed = parseDiscordIdentifier(input.discordIdentifier);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        parsed.discordId ? { discordId: parsed.discordId } : undefined,
        { discordUsername: { equals: parsed.username, mode: "insensitive" } },
      ].filter(Boolean) as { discordId?: string; discordUsername?: { equals: string; mode: "insensitive" } }[],
    },
  });

  if (user) {
    const existingMember = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: input.companyId } },
    });
    if (existingMember) throw new Error("ALREADY_MEMBER");

    const pending = await findPendingInvitation(input.companyId, user.id, user.discordId, user.discordUsername);
    if (pending) throw new Error("INVITATION_ALREADY_SENT");
  } else {
    const pending = await findPendingInvitation(
      input.companyId,
      undefined,
      parsed.discordId,
      parsed.username,
    );
    if (pending) throw new Error("INVITATION_ALREADY_SENT");
  }

  const invitation = await prisma.companyInvitation.create({
    data: {
      companyId: input.companyId,
      invitedByUserId: actorUserId,
      invitedUserId: user?.id ?? null,
      invitedDiscordId: user?.discordId ?? parsed.discordId ?? null,
      invitedDiscordUsername: user?.discordUsername ?? parsed.username,
      role: toDbMemberRole(input.role),
      expiresAt: invitationExpiryDate(),
    },
  });

  try {
    const { scheduleDispatchInvitationDm } = await import("@/server/invitation-discord-dispatch.service");
    scheduleDispatchInvitationDm("company", invitation.id);
  } catch (error) {
    console.error("[invitations] company invitation dispatch failed", error);
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { name: true },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_INVITATION_SENT",
    entityType: "COMPANY",
    entityId: invitation.id,
    targetCompanyId: input.companyId,
    description: `Company invitation sent to ${input.discordIdentifier.trim()}`,
    metadata: auditSourceMetadata("website", {
      invitationId: invitation.id,
      companyName: company?.name,
      role: input.role,
    }),
  });

  return { invitationId: invitation.id };
}

export async function acceptCompanyInvitation(
  userId: string,
  invitationId: string,
  auditContext?: import("@/lib/staff-audit/staff-audit-types").BankingStaffAuditContext,
): Promise<{ companyId: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  const invitation = await prisma.companyInvitation.findUnique({
    where: { id: invitationId },
    include: { company: true },
  });
  if (!invitation || invitation.status !== "PENDING") notFound();

  const matches = await invitationMatchesUser(
    invitation,
    userId,
    user.discordId,
    user.discordUsername,
  );
  if (!matches) forbidden();

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await prisma.companyInvitation.update({
      where: { id: invitationId },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
    throw new Error("INVITATION_EXPIRED");
  }

  const existingMember = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId: invitation.companyId } },
  });
  if (existingMember) {
    await prisma.companyInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date(), invitedUserId: userId },
    });
    return { companyId: invitation.companyId };
  }

  const { assertCommercialTeamMemberLimit } = await import("@/server/commercial-limits.service");
  await assertCommercialTeamMemberLimit(invitation.companyId);

  await prisma.$transaction([
    prisma.companyMembership.create({
      data: {
        userId,
        companyId: invitation.companyId,
        role: invitation.role,
      },
    }),
    prisma.companyInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date(), invitedUserId: userId },
    }),
  ]);

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: "COMPANY_INVITATION_ACCEPTED",
    entityType: "COMPANY",
    entityId: invitationId,
    targetCompanyId: invitation.companyId,
    targetUserId: userId,
    description: `Accepted invitation to ${invitation.company.name}`,
    metadata: auditSourceMetadata(auditContext?.source, {
      companyName: invitation.company.name,
      invitationId,
    }),
  });

  return { companyId: invitation.companyId };
}

export async function declineCompanyInvitation(
  userId: string,
  invitationId: string,
  auditContext?: import("@/lib/staff-audit/staff-audit-types").BankingStaffAuditContext,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  const invitation = await prisma.companyInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.status !== "PENDING") notFound();

  const company = await prisma.company.findUnique({
    where: { id: invitation.companyId },
    select: { id: true, name: true },
  });

  const matches = await invitationMatchesUser(
    invitation,
    userId,
    user.discordId,
    user.discordUsername,
  );
  if (!matches) forbidden();

  await prisma.companyInvitation.update({
    where: { id: invitationId },
    data: { status: "DECLINED", respondedAt: new Date(), invitedUserId: userId },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: "COMPANY_INVITATION_DECLINED",
    entityType: "COMPANY",
    entityId: invitationId,
    targetCompanyId: invitation.companyId,
    targetUserId: userId,
    description: `Declined invitation to ${company?.name ?? "company"}`,
    metadata: auditSourceMetadata(auditContext?.source, {
      companyName: company?.name,
      invitationId,
    }),
  });
}

export async function addMember(
  actorUserId: string,
  companyId: string,
  targetUserId: string,
  role: CompanyRole,
): Promise<void> {
  const actorMembership = await requireMembership(companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();
  if (!canAssignCompanyRole(actorRole, role)) forbidden();

  const existing = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: targetUserId, companyId } },
  });
  if (existing) {
    throw new Error("ALREADY_MEMBER");
  }

  await prisma.companyMembership.create({
    data: {
      userId: targetUserId,
      companyId,
      role: toDbMemberRole(role),
    },
  });
}

export async function getCompanyMembers(
  companyId: string,
  userId: string,
): Promise<CompanyDetail["members"]> {
  const detail = await getCompanyDetailForUser(companyId, userId);
  return detail.members;
}

export async function listInternalCompanies(): Promise<InternalCompanyRow[]> {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { memberships: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return companies.map(mapInternalCompanyRow);
}

export async function getInternalCompanyDetail(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    include: companyWithMembersInclude,
  });
}

export async function verifyCompany(actorUserId: string, companyId: string, reviewNote?: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();
  if (company.verificationStatus === "VERIFIED") {
    badRequest("This company is already verified.");
  }
  if (company.verificationStatus === "REJECTED") {
    badRequest("Verification was rejected and cannot be approved again from this action.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      verificationStatus: "VERIFIED",
      status: company.status === "PENDING" ? "ACTIVE" : company.status,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_VERIFIED",
    entityType: "COMPANY",
    entityId: companyId,
    targetCompanyId: companyId,
    description: `Verified company ${company.name}`,
    metadata: auditSourceMetadata("website", { reviewNote: reviewNote ?? null }),
  });

  try {
    const members = await prisma.companyMembership.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const { notifyCompanyVerified } = await import("@/server/banking-notification.service");
    await notifyCompanyVerified(
      members.map((member) => member.userId),
      { companyId, companyName: company.name },
    );
  } catch (error) {
    console.error("[company] verified notification failed", error);
  }
}

export async function rejectCompanyVerification(
  actorUserId: string,
  companyId: string,
  reviewNote?: string,
): Promise<void> {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Rejection reason");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();
  if (company.verificationStatus === "VERIFIED") {
    badRequest("Verified companies cannot be rejected. Revoke verification first if needed.");
  }
  if (company.verificationStatus === "REJECTED") {
    badRequest("This company verification is already rejected.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { verificationStatus: "REJECTED" },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_REJECTED",
    entityType: "COMPANY",
    entityId: companyId,
    targetCompanyId: companyId,
    description: `Rejected verification for ${company.name}`,
    metadata: auditSourceMetadata("website", { reviewNote: trimmedNote }),
  });

  try {
    const { notifyCompanyVerificationRejected } = await import("@/server/commercial-notification.service");
    await notifyCompanyVerificationRejected({
      companyId,
      companyName: company.name,
      reason: trimmedNote,
    });
  } catch (error) {
    console.error("[company] rejection notification failed", error);
  }
}

export async function revokeCompanyVerification(
  actorUserId: string,
  companyId: string,
  reviewNote?: string,
): Promise<void> {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Revocation reason");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();
  if (company.verificationStatus !== "VERIFIED") {
    badRequest("Only verified companies can have verification revoked.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { verificationStatus: "UNVERIFIED" },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMPANY_VERIFICATION_REVOKED",
    entityType: "COMPANY",
    entityId: companyId,
    targetCompanyId: companyId,
    description: `Revoked verification for ${company.name}`,
    metadata: { reviewNote: trimmedNote },
  });

  try {
    const { notifyCompanyVerificationRevoked } = await import("@/server/commercial-notification.service");
    await notifyCompanyVerificationRevoked({
      companyId,
      companyName: company.name,
      reason: trimmedNote,
    });
  } catch (error) {
    console.error("[company] revocation notification failed", error);
  }
}
