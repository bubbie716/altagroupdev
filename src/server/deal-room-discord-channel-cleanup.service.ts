import type { SecureDealRoomType } from "@prisma/client";
import { directDeleteDealRoomChannel } from "@/server/deal-room-discord-channel-direct.service";
import { writeAuditLog } from "@/server/audit.service";
import { prisma } from "@/server/db";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

export type DeleteClosedDealRoomChannelsResult = {
  deleted: number;
  failed: number;
  skipped: number;
  channels: Array<{
    sessionId: string;
    dealRoomType: SecureDealRoomType;
    dealRoomId: string;
    discordChannelId: string;
    ok: boolean;
    reason?: string;
  }>;
};

function auditEntityTypeForDealRoom(
  dealRoomType: SecureDealRoomType,
): "LOAN_APPLICATION" | "ALTA_CARD" | "DEAL_ROOM" {
  if (dealRoomType === "LOAN_APPLICATION") return "LOAN_APPLICATION";
  return "ALTA_CARD";
}

export async function deleteClosedDealRoomChannels(input: {
  actorUserId: string;
}): Promise<DeleteClosedDealRoomChannelsResult> {
  const sessions = await prisma.secureDealRoomDiscordSession.findMany({
    where: {
      status: "CLOSED",
      discordChannelId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
  });

  const result: DeleteClosedDealRoomChannelsResult = {
    deleted: 0,
    failed: 0,
    skipped: 0,
    channels: [],
  };

  for (const session of sessions) {
    const channelId = session.discordChannelId?.trim();
    if (!channelId) {
      result.skipped += 1;
      continue;
    }

    const deletion = await directDeleteDealRoomChannel(channelId);
    const entry = {
      sessionId: session.id,
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      discordChannelId: channelId,
      ok: deletion.ok,
      reason: deletion.reason,
    };
    result.channels.push(entry);

    if (!deletion.ok) {
      result.failed += 1;
      continue;
    }

    result.deleted += 1;
    await prisma.secureDealRoomDiscordSession.update({
      where: { id: session.id },
      data: {
        discordChannelId: null,
        updatedAt: new Date(),
      },
    });
  }

  if (result.deleted > 0 || result.failed > 0) {
    await writeAuditLog({
      actorUserId: input.actorUserId,
      action: "DEAL_ROOM_DISCORD_CHANNELS_CLEANED",
      entityType: "DEAL_ROOM",
      entityId: "closed-channel-cleanup",
      description: "Staff deleted closed Secure Deal Room Discord channels.",
      metadata: {
        deleted: result.deleted,
        failed: result.failed,
        skipped: result.skipped,
        channelIds: result.channels.filter((c) => c.ok).map((c) => c.discordChannelId),
        source: "discord_bot",
      },
    });

    sendStaffAuditMessage({
      product: "Deal Room",
      action: "Closed Discord channels deleted",
      actorUserId: input.actorUserId,
      details: `${result.deleted} deleted · ${result.failed} failed`,
      internalUrl: "/internal/queues/deal-rooms",
      severity: result.failed > 0 ? "WARNING" : "INFO",
      source: "discord_bot",
      dedupeKey: `deal-room-cleanup:${Date.now()}`,
    });
  }

  return result;
}
