import { buildNotificationDmPayload } from "@/lib/discord/notification-dm";
import { sendDiscordNotificationDm } from "@/server/discord-dm.service";
import { prisma } from "@/server/db";

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[notification-delivery] ${message}`, meta ?? {});
}

export type UserNotificationDmInput = {
  userId: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  linkLabel?: string;
};

export async function deliverUserNotificationDm(
  input: UserNotificationDmInput,
): Promise<{ sent: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { discordId: true },
  });

  const discordUserId = user?.discordId?.trim();
  if (!discordUserId) {
    return { sent: false, reason: "no_discord_id" };
  }

  const payload = buildNotificationDmPayload({
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    linkLabel: input.linkLabel,
  });

  try {
    const result = await sendDiscordNotificationDm(discordUserId, payload);
    if (!result.sent) {
      logDelivery("notification skipped — Discord not configured", { userId: input.userId });
      return { sent: false, reason: "not_configured" };
    }

    logDelivery("notification DM sent", { userId: input.userId, title: input.title });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logDelivery("notification DM failed", { userId: input.userId, error: message });
    return { sent: false, reason: message };
  }
}
