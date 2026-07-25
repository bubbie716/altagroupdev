import { buildCompanyInvitationDmPayload } from "@/lib/discord/invitation-dm";
import { sendDiscordInvitationDm } from "@/server/discord-dm.service";
import { prisma } from "@/server/db";

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[invitation-delivery] ${message}`, meta ?? {});
}

async function recordInvitationDeliveryFailure(input: {
  invitationId: string;
  invitationKind: "company";
  userId: string;
  reason: string;
}): Promise<void> {
  const { recordCustomerDmDeliveryFailure, isRetryableDeliveryFailure } = await import(
    "@/server/notification-delivery-audit.service"
  );
  const retryable = isRetryableDeliveryFailure(input.reason);
  await recordCustomerDmDeliveryFailure({
    actorUserId: input.userId,
    userId: input.userId,
    title: "Invitation DM",
    reason: input.reason,
    retryable,
    sourceAction: `invitation_${input.invitationKind}`,
    metadata: { invitationId: input.invitationId, invitationKind: input.invitationKind },
  });
}

export async function deliverCompanyInvitationDm(
  invitationId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const invitation = await prisma.companyInvitation.findUnique({
    where: { id: invitationId },
    include: {
      company: { select: { name: true } },
      invitedBy: { select: { id: true, discordUsername: true } },
      invitedUser: { select: { id: true, discordId: true } },
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
      await recordInvitationDeliveryFailure({
        invitationId,
        invitationKind: "company",
        userId: invitation.invitedUser?.id ?? invitation.invitedBy.id,
        reason: result.reason ?? "not_configured",
      });
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
    await recordInvitationDeliveryFailure({
      invitationId,
      invitationKind: "company",
      userId: invitation.invitedUser?.id ?? invitation.invitedBy.id,
      reason: message,
    });
    return { sent: false, reason: message };
  }
}

export async function syncUndeliveredInvitationDms(): Promise<{ sent: number }> {
  const companyIds = await prisma.companyInvitation.findMany({
    where: { status: "PENDING", discordNotifiedAt: null },
    select: { id: true },
  });

  let sent = 0;
  for (const row of companyIds) {
    const result = await deliverCompanyInvitationDm(row.id);
    if (result.sent) {
      sent += 1;
    } else {
      logDelivery("Company invitation sync skipped", { invitationId: row.id, reason: result.reason });
    }
  }

  if (companyIds.length > 0) {
    logDelivery("sync complete", { pendingCompany: companyIds.length, sent });
  }

  return { sent };
}

export async function syncUndeliveredInvitationDmsForUser(userId: string): Promise<{ sent: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true, discordUsername: true },
  });
  if (!user) return { sent: 0 };

  const companyIds = await prisma.companyInvitation.findMany({
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
  });

  let sent = 0;
  for (const row of companyIds) {
    const result = await deliverCompanyInvitationDm(row.id);
    if (result.sent) sent += 1;
  }

  return { sent };
}
