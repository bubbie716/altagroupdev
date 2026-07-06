import type { UserNotificationType as DbNotificationType } from "@prisma/client";
import type { NotificationDmPayload } from "@/lib/discord/notification-dm";
import { prisma } from "@/server/db";

function logDelivery(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[customer-notification-delivery] ${message}`, meta ?? {});
}

export type DeliverCustomerNotificationDmInput = {
  notificationId: string;
  userId: string;
  type: DbNotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  embedImageUrl?: string | null;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
  /** Optional pre-built payload for non-standard embeds (e.g. deal room opened). */
  customPayload?: NotificationDmPayload;
};

async function deliverCustomPayloadDm(
  userId: string,
  payload: NotificationDmPayload,
): Promise<{ sent: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  const discordUserId = user?.discordId?.trim();
  if (!discordUserId) {
    return { sent: false, reason: "no_discord_id" };
  }

  const { sendDiscordNotificationDm } = await import("@/server/discord-dm.service");
  try {
    const result = await sendDiscordNotificationDm(discordUserId, payload);
    if (!result.sent) {
      return { sent: false, reason: "not_configured" };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, reason: message };
  }
}

async function markDiscordDelivered(notificationId: string): Promise<void> {
  await prisma.userNotification.update({
    where: { id: notificationId },
    data: { discordNotifiedAt: new Date() },
  });
}

/** Delivers a customer Discord DM with prefs, audit, retry, and delivery tracking. */
export async function deliverCustomerNotificationDm(
  input: DeliverCustomerNotificationDmInput,
): Promise<{ sent: boolean; reason?: string; skipped?: boolean }> {
  try {
    const { isDiscordNotificationEnabled } = await import("@/server/bank-settings.service");
    const { isMandatoryDiscordNotification } = await import("@/lib/bank/notification-pref-rules");
    const enabled =
      isMandatoryDiscordNotification(input.type) ||
      (await isDiscordNotificationEnabled(input.userId, input.type));
    if (!enabled) {
      logDelivery("Discord DM skipped by user preference", {
        userId: input.userId,
        type: input.type,
        notificationId: input.notificationId,
      });
      return { sent: false, skipped: true, reason: "pref_disabled" };
    }

    let result: { sent: boolean; reason?: string };
    if (input.customPayload) {
      result = await deliverCustomPayloadDm(input.userId, input.customPayload);
      if (!result.sent) {
        const { dispatchNotificationDm } = await import(
          "@/server/notification-discord-dispatch.service"
        );
        const fallback = await dispatchNotificationDm({
          userId: input.userId,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
          linkLabel: input.linkLabel,
        });
        result = { sent: fallback.sent, reason: fallback.reason };
      }
    } else {
      const { dispatchNotificationDm } = await import(
        "@/server/notification-discord-dispatch.service"
      );
      const dispatch = await dispatchNotificationDm({
        userId: input.userId,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        linkLabel: input.linkLabel,
        embedImageUrl: input.embedImageUrl,
      });
      result = { sent: dispatch.sent, reason: dispatch.reason };
    }

    if (result.sent) {
      await markDiscordDelivered(input.notificationId);
      logDelivery("DM sent", {
        userId: input.userId,
        type: input.type,
        notificationId: input.notificationId,
      });
      return { sent: true };
    }

    logDelivery("DM not sent", {
      userId: input.userId,
      type: input.type,
      notificationId: input.notificationId,
      reason: result.reason,
    });

    const actorUserId = input.actorUserId ?? input.userId;
    const { recordCustomerDmDeliveryFailure, isRetryableDeliveryFailure } = await import(
      "@/server/notification-delivery-audit.service"
    );
    const retryable = isRetryableDeliveryFailure(result.reason);
    await recordCustomerDmDeliveryFailure({
      actorUserId,
      userId: input.userId,
      title: input.title,
      reason: result.reason ?? "not_sent",
      retryable,
      sourceAction: input.type,
      metadata: {
        notificationId: input.notificationId,
        notificationType: input.type,
        ...input.metadata,
      },
    });

    if (retryable) {
      const entityId =
        typeof input.metadata?.referenceCode === "string"
          ? input.metadata.referenceCode
          : input.notificationId;
      const { enqueueCustomerDmRetry } = await import("@/server/notification-retry-queue.service");
      await enqueueCustomerDmRetry({
        userId: input.userId,
        payload: {
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl ?? "/bank",
          linkLabel: input.linkLabel,
          notificationId: input.notificationId,
        },
        dedupeKey: `customer-dm:${input.userId}:${input.type}:${entityId}`,
        sourceAction: input.type,
        sourceEntityId: entityId,
        reason: result.reason,
      });
    }

    return { sent: false, reason: result.reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logDelivery("DM delivery failed", {
      userId: input.userId,
      type: input.type,
      notificationId: input.notificationId,
      error: message,
    });
    return { sent: false, reason: message };
  }
}

/** Discord API calls must not block banking UX — deliver in the background. */
export function scheduleDeliverCustomerNotificationDm(
  input: DeliverCustomerNotificationDmInput,
): void {
  void deliverCustomerNotificationDm(input).catch((error) => {
    logDelivery("background DM delivery failed", {
      userId: input.userId,
      type: input.type,
      notificationId: input.notificationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
