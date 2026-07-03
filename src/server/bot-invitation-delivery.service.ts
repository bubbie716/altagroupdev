import {
  buildCompanyInvitationDmPayload,
  buildPrivateInvitationDmPayload,
} from "@/lib/discord/invitation-dm";
import { sendDiscordInvitationDm } from "@/server/discord-dm.service";
import { prisma } from "@/server/db";

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[invitation-delivery] ${message}`, meta ?? {});
}

export async function deliverAltaPrivateInvitationDm(
  invitationId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const invitation = await prisma.altaPrivateInvitation.findUnique({
    where: { id: invitationId },
    include: {
      user: { select: { discordId: true } },
      invitedBy: { select: { discordUsername: true } },
    },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return { sent: false, reason: "not_pending" };
  }
  if (invitation.discordNotifiedAt) {
    return { sent: false, reason: "already_notified" };
  }

  const discordUserId = invitation.user.discordId?.trim();
  if (!discordUserId) {
    return { sent: false, reason: "no_discord_id" };
  }

  const payload = buildPrivateInvitationDmPayload({
    invitationId: invitation.id,
    invitationMessage: invitation.invitationMessage,
    invitedByUsername: invitation.invitedBy.discordUsername ?? null,
  });

  try {
    const result = await sendDiscordInvitationDm(discordUserId, payload);
    if (!result.sent) {
      logDelivery("Alta Private invitation skipped — Discord not configured", { invitationId });
      return { sent: false, reason: "not_configured" };
    }

    await prisma.altaPrivateInvitation.update({
      where: { id: invitationId },
      data: { discordNotifiedAt: new Date() },
    });

    logDelivery("Alta Private invitation DM sent", { invitationId, discordUserId });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logDelivery("Alta Private invitation DM failed", { invitationId, error: message });
    return { sent: false, reason: message };
  }
}

export async function deliverCompanyInvitationDm(
  invitationId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const invitation = await prisma.companyInvitation.findUnique({
    where: { id: invitationId },
    include: {
      company: { select: { name: true } },
      invitedBy: { select: { discordUsername: true } },
      invitedUser: { select: { discordId: true } },
    },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return { sent: false, reason: "not_pending" };
  }
  if (invitation.discordNotifiedAt) {
    return { sent: false, reason: "already_notified" };
  }

  const discordUserId =
    invitation.invitedUser?.discordId?.trim() || invitation.invitedDiscordId?.trim() || "";
  if (!discordUserId) {
    return { sent: false, reason: "no_discord_id" };
  }

  const payload = buildCompanyInvitationDmPayload({
    invitationId: invitation.id,
    companyName: invitation.company.name,
    role: invitation.role,
    invitedByUsername: invitation.invitedBy.discordUsername,
  });

  try {
    const result = await sendDiscordInvitationDm(discordUserId, payload);
    if (!result.sent) {
      logDelivery("Company invitation skipped — Discord not configured", { invitationId });
      return { sent: false, reason: "not_configured" };
    }

    await prisma.companyInvitation.update({
      where: { id: invitationId },
      data: { discordNotifiedAt: new Date() },
    });

    logDelivery("Company invitation DM sent", { invitationId, discordUserId });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logDelivery("Company invitation DM failed", { invitationId, error: message });
    return { sent: false, reason: message };
  }
}

export async function syncUndeliveredInvitationDms(): Promise<{ sent: number }> {
  const [privateIds, companyIds] = await Promise.all([
    prisma.altaPrivateInvitation.findMany({
      where: { status: "PENDING", discordNotifiedAt: null },
      select: { id: true },
    }),
    prisma.companyInvitation.findMany({
      where: { status: "PENDING", discordNotifiedAt: null },
      select: { id: true },
    }),
  ]);

  let sent = 0;
  for (const row of privateIds) {
    const result = await deliverAltaPrivateInvitationDm(row.id);
    if (result.sent) {
      sent += 1;
    } else {
      logDelivery("Alta Private invitation sync skipped", { invitationId: row.id, reason: result.reason });
    }
  }
  for (const row of companyIds) {
    const result = await deliverCompanyInvitationDm(row.id);
    if (result.sent) {
      sent += 1;
    } else {
      logDelivery("Company invitation sync skipped", { invitationId: row.id, reason: result.reason });
    }
  }

  if (privateIds.length + companyIds.length > 0) {
    logDelivery("sync complete", {
      pendingPrivate: privateIds.length,
      pendingCompany: companyIds.length,
      sent,
    });
  }

  return { sent };
}

export async function syncUndeliveredInvitationDmsForUser(userId: string): Promise<{ sent: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true, discordUsername: true },
  });
  if (!user) return { sent: 0 };

  const [privateIds, companyIds] = await Promise.all([
    prisma.altaPrivateInvitation.findMany({
      where: { userId, status: "PENDING", discordNotifiedAt: null },
      select: { id: true },
    }),
    prisma.companyInvitation.findMany({
      where: {
        status: "PENDING",
        discordNotifiedAt: null,
        OR: [
          { invitedUserId: userId },
          user.discordId ? { invitedDiscordId: user.discordId } : undefined,
          user.discordUsername
            ? { invitedDiscordUsername: { equals: user.discordUsername, mode: "insensitive" } }
            : undefined,
        ].filter(Boolean) as {
          invitedUserId?: string;
          invitedDiscordId?: string;
          invitedDiscordUsername?: { equals: string; mode: "insensitive" };
        }[],
      },
      select: { id: true },
    }),
  ]);

  let sent = 0;
  for (const row of privateIds) {
    const result = await deliverAltaPrivateInvitationDm(row.id);
    if (result.sent) sent += 1;
  }
  for (const row of companyIds) {
    const result = await deliverCompanyInvitationDm(row.id);
    if (result.sent) sent += 1;
  }

  return { sent };
}
