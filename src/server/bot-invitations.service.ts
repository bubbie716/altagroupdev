import {
  acceptAltaPrivateInvitation,
  declineAltaPrivateInvitation,
} from "@/server/alta-private-invitation.service";
import {
  acceptCompanyInvitation,
  declineCompanyInvitation,
  listUserPendingInvitations,
} from "@/server/company.service";
import { prisma } from "@/server/db";

function notFound(): never {
  throw new Error("NOT_FOUND");
}

async function loadUserDiscord(userId: string): Promise<{ discordId: string; discordUsername: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true, discordUsername: true },
  });
  if (!user) notFound();
  return { discordId: user.discordId, discordUsername: user.discordUsername ?? "" };
}

export async function listBotCompanyInvitations(userId: string) {
  const { discordId, discordUsername } = await loadUserDiscord(userId);
  return listUserPendingInvitations(userId, discordId, discordUsername);
}

export async function acceptBotAltaPrivateInvitation(userId: string, invitationId: string) {
  return acceptAltaPrivateInvitation(userId, invitationId);
}

export async function declineBotAltaPrivateInvitation(userId: string, invitationId: string) {
  return declineAltaPrivateInvitation(userId, invitationId);
}

export async function acceptBotCompanyInvitation(userId: string, invitationId: string) {
  const invitation = await prisma.companyInvitation.findUnique({
    where: { id: invitationId },
    include: { company: { select: { name: true } } },
  });
  const result = await acceptCompanyInvitation(userId, invitationId);
  return {
    companyId: result.companyId,
    companyName: invitation?.company.name ?? "the company",
  };
}

export async function declineBotCompanyInvitation(userId: string, invitationId: string) {
  return declineCompanyInvitation(userId, invitationId);
}
