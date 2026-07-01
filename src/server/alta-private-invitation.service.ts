import type { AltaPrivateInvitation } from "@prisma/client";
import type {
  AltaPrivateCustomerPageState,
  AltaPrivateInternalSummary,
  AltaPrivateInvitationStatusCode,
  AltaPrivateInvitationSummary,
  PrivateBankingQueueRow,
} from "@/lib/bank/alta-private-types";
import {
  canRespondToAltaPrivateInvitation,
  canRevokeAltaPrivateInvitation,
  canSendAltaPrivateInvitation,
} from "@/lib/bank/alta-private-invitation-rules";
import { finalizeAltaPrivateMembershipActivation } from "@/server/alta-private-timeline.service";
import { isPrivateClient } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { isAdmin } from "@/lib/auth/permissions";

const DEFAULT_INVITATION_TTL_DAYS = 30;

function forbid(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function fromDbStatus(status: AltaPrivateInvitation["status"]): AltaPrivateInvitationStatusCode {
  return status.toLowerCase() as AltaPrivateInvitationStatusCode;
}

function invitationExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_INVITATION_TTL_DAYS);
  return date;
}

function mapInvitation(
  row: AltaPrivateInvitation & { invitedBy?: { discordUsername: string } | null },
): AltaPrivateInvitationSummary {
  return {
    id: row.id,
    userId: row.userId,
    status: fromDbStatus(row.status),
    invitationMessage: row.invitationMessage,
    invitedByUserId: row.invitedByUserId,
    invitedByUsername: row.invitedBy?.discordUsername ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireAdminActor(actorUserId: string): Promise<AltaUser> {
  const record = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!record) forbid();
  const actor = mapDbUserToAltaUser(record);
  if (!isAdmin(actor)) forbid();
  return actor;
}

async function expireStalePendingInvitations(userId?: string): Promise<void> {
  const now = new Date();
  await prisma.altaPrivateInvitation.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
      ...(userId ? { userId } : {}),
    },
    data: { status: "EXPIRED", updatedAt: now },
  });
}

async function userHasPrivateMembership(userId: string): Promise<boolean> {
  const tag = await prisma.userTagAssignment.findUnique({
    where: { userId_tag: { userId, tag: "PRIVATE_CLIENT" } },
  });
  return tag != null;
}

async function activateAltaPrivateMembership(
  userId: string,
  actorUserId: string | null,
): Promise<void> {
  const alreadyMember = await userHasPrivateMembership(userId);
  if (!alreadyMember) {
    await prisma.userTagAssignment.upsert({
      where: { userId_tag: { userId, tag: "PRIVATE_CLIENT" } },
      create: { userId, tag: "PRIVATE_CLIENT" },
      update: {},
    });
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: actorUserId ?? userId,
    targetUserId: userId,
    action: "ALTA_PRIVATE_ACTIVATED",
    entityType: "USER",
    entityId: userId,
    description: "Alta Private membership activated",
    metadata: { userId, actorUserId },
  });

  if (!alreadyMember) {
    await writeAuditLog({
      actorUserId: actorUserId ?? userId,
      targetUserId: userId,
      action: "PRIVATE_BANKING_CLIENT_MARKED",
      entityType: "USER",
      entityId: userId,
      description: "Alta Private membership activated",
      metadata: { userId, actorUserId, before: false, after: true },
    });
  }

  await finalizeAltaPrivateMembershipActivation(userId, actorUserId);
}

export async function sendAltaPrivateInvitation(
  actorUserId: string,
  input: { userId: string; invitationMessage: string; expiresAt?: Date | null },
): Promise<{ invitationId: string }> {
  await requireAdminActor(actorUserId);

  const message = input.invitationMessage.trim();
  if (message.length < 10) {
    badRequest("Invitation message must be at least 10 characters.");
  }

  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target) notFound();

  await expireStalePendingInvitations(input.userId);

  const membershipActive = await userHasPrivateMembership(input.userId);
  const pending = await prisma.altaPrivateInvitation.findFirst({
    where: { userId: input.userId, status: "PENDING" },
  });
  const sendCheck = canSendAltaPrivateInvitation({
    membershipActive,
    hasPendingInvitation: pending != null,
  });
  if (!sendCheck.ok) {
    if (sendCheck.reason === "already_member") badRequest("Customer is already an Alta Private member.");
    badRequest("A pending Alta Private invitation already exists for this customer.");
  }

  const invitation = await prisma.altaPrivateInvitation.create({
    data: {
      userId: input.userId,
      invitedByUserId: actorUserId,
      invitationMessage: message,
      expiresAt: input.expiresAt ?? invitationExpiryDate(),
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    targetUserId: input.userId,
    action: "ALTA_PRIVATE_INVITATION_SENT",
    entityType: "USER",
    entityId: input.userId,
    description: "Alta Private invitation sent",
    metadata: { invitationId: invitation.id, userId: input.userId, invitationMessage: message },
  });

  const { recordAltaPrivateInvitedTimelineEvent } = await import(
    "@/server/alta-private-timeline.service"
  );
  await recordAltaPrivateInvitedTimelineEvent({
    userId: input.userId,
    invitationId: invitation.id,
    occurredAt: invitation.createdAt,
    actorUserId,
  });

  try {
    const { sendAltaPrivateInvitationDiscordNotification } = await import(
      "@/server/alta-private-discord.service"
    );
    await sendAltaPrivateInvitationDiscordNotification(input.userId, invitation.id);
  } catch {
    // Discord must never break invitation flow.
  }

  return { invitationId: invitation.id };
}

export async function revokeAltaPrivateInvitation(
  actorUserId: string,
  invitationId: string,
  reason: string,
): Promise<void> {
  await requireAdminActor(actorUserId);

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) badRequest("Revocation reason is required.");

  const invitation = await prisma.altaPrivateInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation) notFound();

  await expireStalePendingInvitations(invitation.userId);
  const fresh = await prisma.altaPrivateInvitation.findUnique({ where: { id: invitationId } });
  if (!fresh) notFound();

  if (!canRevokeAltaPrivateInvitation(fromDbStatus(fresh.status))) {
    badRequest("Only pending invitations can be revoked.");
  }

  const now = new Date();
  await prisma.altaPrivateInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED", revokedAt: now, updatedAt: now },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    targetUserId: fresh.userId,
    action: "ALTA_PRIVATE_INVITATION_REVOKED",
    entityType: "USER",
    entityId: fresh.userId,
    description: "Alta Private invitation revoked",
    metadata: { invitationId, userId: fresh.userId, reason: trimmedReason },
  });
}

export async function acceptAltaPrivateInvitation(
  userId: string,
  invitationId: string,
): Promise<{ activated: true }> {
  await expireStalePendingInvitations(userId);

  const invitation = await prisma.altaPrivateInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation) notFound();

  const respondCheck = canRespondToAltaPrivateInvitation({
    invitationUserId: invitation.userId,
    actorUserId: userId,
    status: fromDbStatus(invitation.status),
    expiresAt: invitation.expiresAt?.toISOString() ?? null,
  });
  if (!respondCheck.ok) {
    if (respondCheck.reason === "wrong_user") forbid();
    if (respondCheck.reason === "expired") {
      await prisma.altaPrivateInvitation.update({
        where: { id: invitationId },
        data: { status: "EXPIRED", updatedAt: new Date() },
      });
      badRequest("This invitation has expired.");
    }
    badRequest("This invitation is no longer available.");
  }

  const now = new Date();
  await prisma.altaPrivateInvitation.update({
    where: { id: invitationId },
    data: { status: "ACCEPTED", acceptedAt: now, updatedAt: now },
  });

  await activateAltaPrivateMembership(userId, userId);

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    targetUserId: userId,
    action: "ALTA_PRIVATE_INVITATION_ACCEPTED",
    entityType: "USER",
    entityId: userId,
    description: "Alta Private invitation accepted",
    metadata: { invitationId, userId },
  });

  try {
    const { sendAltaPrivateAcceptedDiscordNotification } = await import(
      "@/server/alta-private-discord.service"
    );
    await sendAltaPrivateAcceptedDiscordNotification(userId);
  } catch {
    // Discord must never break acceptance flow.
  }

  return { activated: true };
}

export async function declineAltaPrivateInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  await expireStalePendingInvitations(userId);

  const invitation = await prisma.altaPrivateInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation) notFound();

  const respondCheck = canRespondToAltaPrivateInvitation({
    invitationUserId: invitation.userId,
    actorUserId: userId,
    status: fromDbStatus(invitation.status),
    expiresAt: invitation.expiresAt?.toISOString() ?? null,
  });
  if (!respondCheck.ok) {
    if (respondCheck.reason === "wrong_user") forbid();
    badRequest("This invitation is no longer available.");
  }

  const now = new Date();
  await prisma.altaPrivateInvitation.update({
    where: { id: invitationId },
    data: { status: "DECLINED", declinedAt: now, updatedAt: now },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    targetUserId: userId,
    action: "ALTA_PRIVATE_INVITATION_DECLINED",
    entityType: "USER",
    entityId: userId,
    description: "Alta Private invitation declined",
    metadata: { invitationId, userId },
  });

  try {
    const { sendAltaPrivateDeclinedDiscordNotification } = await import(
      "@/server/alta-private-discord.service"
    );
    await sendAltaPrivateDeclinedDiscordNotification(userId);
  } catch {
    // Discord must never break decline flow.
  }
}

export async function getCustomerAltaPrivatePageState(userId: string): Promise<AltaPrivateCustomerPageState> {
  await expireStalePendingInvitations(userId);

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) notFound();
  const user = mapDbUserToAltaUser(userRecord);

  if (isPrivateClient(user)) {
    const tag = await prisma.userTagAssignment.findUnique({
      where: { userId_tag: { userId, tag: "PRIVATE_CLIENT" } },
    });
    return { kind: "member", activatedAt: tag?.createdAt.toISOString() ?? null };
  }

  const pending = await prisma.altaPrivateInvitation.findFirst({
    where: { userId, status: "PENDING" },
    include: { invitedBy: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    return { kind: "invited", invitation: mapInvitation(pending) };
  }

  const recentDeclined = await prisma.altaPrivateInvitation.findFirst({
    where: { userId, status: "DECLINED" },
    orderBy: { declinedAt: "desc" },
  });
  if (recentDeclined) {
    return { kind: "declined", declinedAt: recentDeclined.declinedAt?.toISOString() ?? null };
  }

  const profile = await prisma.relationshipProfile.findUnique({ where: { userId } });
  return { kind: "aspirational", eligible: profile?.privateBankingEligible ?? false };
}

export async function getAltaPrivateInvitationForUser(
  userId: string,
  invitationId: string,
): Promise<AltaPrivateInvitationSummary> {
  await expireStalePendingInvitations(userId);

  const invitation = await prisma.altaPrivateInvitation.findUnique({
    where: { id: invitationId },
    include: { invitedBy: { select: { discordUsername: true } } },
  });
  if (!invitation || invitation.userId !== userId) notFound();
  return mapInvitation(invitation);
}

export async function getInternalAltaPrivateSummary(userId: string): Promise<AltaPrivateInternalSummary> {
  await expireStalePendingInvitations(userId);

  const [membershipActive, profile, invitations] = await Promise.all([
    userHasPrivateMembership(userId),
    prisma.relationshipProfile.findUnique({ where: { userId } }),
    prisma.altaPrivateInvitation.findMany({
      where: { userId },
      include: { invitedBy: { select: { discordUsername: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const mapped = invitations.map(mapInvitation);
  return {
    membershipActive,
    eligible: profile?.privateBankingEligible ?? false,
    pendingInvitation: mapped.find((row) => row.status === "pending") ?? null,
    invitationHistory: mapped,
  };
}

export async function listPrivateBankingQueueRows(): Promise<PrivateBankingQueueRow[]> {
  await expireStalePendingInvitations();

  const users = await prisma.user.findMany({
    include: {
      tags: true,
      bankAccounts: { select: { balance: true } },
      relationshipProfile: { select: { privateBankingEligible: true, relationshipTier: true } },
      altaPrivateInvitationsReceived: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: PrivateBankingQueueRow[] = [];

  for (const user of users) {
    const altaPrivateActive = user.tags.some((t) => t.tag === "PRIVATE_CLIENT");
    const eligible = user.relationshipProfile?.privateBankingEligible ?? false;
    const latestInvitation = user.altaPrivateInvitationsReceived[0] ?? null;
    const invitationStatus = latestInvitation ? fromDbStatus(latestInvitation.status) : null;

    const include =
      altaPrivateActive ||
      eligible ||
      invitationStatus === "pending" ||
      invitationStatus === "declined" ||
      invitationStatus === "revoked" ||
      invitationStatus === "expired";

    if (!include) continue;

    rows.push({
      userId: user.id,
      discordUsername: user.discordUsername,
      discordId: user.discordId,
      email: user.email,
      totalBankBalance: user.bankAccounts.reduce((sum, a) => sum + Number(a.balance.toString()), 0),
      bankAccountCount: user.bankAccounts.length,
      accountStatus: user.accountStatus.toLowerCase(),
      createdAt: user.createdAt.toISOString(),
      relationshipTier: user.relationshipProfile?.relationshipTier ?? null,
      altaPrivateEligible: eligible,
      altaPrivateActive,
      invitationStatus,
      invitationId: latestInvitation?.id ?? null,
      invitationSentAt: latestInvitation?.createdAt.toISOString() ?? null,
    });
  }

  return rows.sort((a, b) => {
    const rank = (row: PrivateBankingQueueRow) => {
      if (row.invitationStatus === "pending") return 0;
      if (row.altaPrivateEligible && !row.altaPrivateActive) return 1;
      if (row.altaPrivateActive) return 2;
      return 3;
    };
    return rank(a) - rank(b) || b.totalBankBalance - a.totalBankBalance;
  });
}

export async function countPendingAltaPrivateInvitations(userId: string): Promise<number> {
  await expireStalePendingInvitations(userId);
  return prisma.altaPrivateInvitation.count({
    where: { userId, status: "PENDING" },
  });
}

export async function getAltaPrivateClientContext(userId: string) {
  const { buildAltaPrivateClientContext } = await import(
    "@/lib/bank/alta-private-client-experience"
  );

  const [user, privateTag] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { discordUsername: true },
    }),
    prisma.userTagAssignment.findUnique({
      where: { userId_tag: { userId, tag: "PRIVATE_CLIENT" } },
    }),
  ]);

  if (!user) {
    return buildAltaPrivateClientContext({
      isMember: false,
      discordUsername: "",
      memberSince: null,
    });
  }

  return buildAltaPrivateClientContext({
    isMember: privateTag != null,
    discordUsername: user.discordUsername,
    memberSince: privateTag?.createdAt.toISOString() ?? null,
  });
}
