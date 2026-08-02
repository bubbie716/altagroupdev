import { buildNotificationDmPayload } from "@/lib/discord/notification-dm";
import { sendDiscordNotificationDm } from "@/server/discord-dm.service";
import { prisma } from "@/server/db";
import { assertLiveNotificationTransportAllowed } from "@/server/notification-test-transport";

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
  embedImageUrl?: string | null;
  /** Used for product-aware Discord branding (footer / CTA). */
  eventType?: string | null;
};

export async function deliverUserNotificationDm(
  input: UserNotificationDmInput,
): Promise<{ sent: boolean; reason?: string }> {
  assertLiveNotificationTransportAllowed("deliverUserNotificationDm");
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
    embedImageUrl: input.embedImageUrl,
    eventType: input.eventType,
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
