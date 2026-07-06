import type { UserNotificationType as DbNotificationType } from "@prisma/client";
import type { NotificationDmPayload } from "@/lib/discord/notification-dm";
import { prisma } from "@/server/db";

export type CreateNotificationInput = {
  userId: string;
  type: DbNotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  metadata?: Record<string, unknown>;
  embedImageUrl?: string | null;
  actorUserId?: string;
  /** When true, only creates the in-app row (caller delivers DM separately). */
  skipDiscord?: boolean;
  /** Optional custom Discord payload for specialized embeds. */
  customDmPayload?: NotificationDmPayload;
};

async function dispatchDiscordForNotification(
  notificationId: string,
  input: CreateNotificationInput,
): Promise<void> {
  const { deliverCustomerNotificationDm } = await import(
    "@/server/customer-notification-delivery.service"
  );
  await deliverCustomerNotificationDm({
    notificationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    linkLabel: input.linkLabel,
    embedImageUrl: input.embedImageUrl,
    actorUserId: input.actorUserId,
    metadata: input.metadata,
    customPayload: input.customDmPayload,
  });
}

/** Discord API calls must not block banking UX — deliver after the in-app row exists. */
function scheduleDiscordForNotification(
  notificationId: string,
  input: CreateNotificationInput,
): void {
  void dispatchDiscordForNotification(notificationId, input).catch((error) => {
    console.error("[notification] background Discord DM failed", {
      notificationId,
      userId: input.userId,
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/** In-app notification with optional Discord DM delivery. Returns notification id. */
export async function createUserNotification(input: CreateNotificationInput): Promise<string> {
  const notification = await prisma.userNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: "IN_APP",
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      metadata: input.metadata ?? undefined,
    },
  });

  if (!input.skipDiscord) {
    scheduleDiscordForNotification(notification.id, input);
  }

  return notification.id;
}

/** Fire-and-forget in-app notification (Discord DM is scheduled inside createUserNotification). */
export function scheduleCreateUserNotification(input: CreateNotificationInput): void {
  void createUserNotification(input).catch((error) => {
    console.error("[notification] background in-app notification failed", {
      userId: input.userId,
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function createUserNotifications(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  for (const userId of unique) {
    if (typeof userId !== "string") {
      throw new Error(
        "createUserNotifications expected string user ids; pass notification fields as the second argument.",
      );
    }
    await createUserNotification({ userId, ...input });
  }
}

/** Fire-and-forget batch in-app notifications. */
export function scheduleCreateUserNotifications(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): void {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    scheduleCreateUserNotification({ userId, ...input });
  }
}

/** Delivers a DM for an existing in-app notification (e.g. deal room opened after channel setup). */
export async function deliverNotificationDiscord(
  notificationId: string,
  input: Omit<CreateNotificationInput, "skipDiscord">,
): Promise<void> {
  scheduleDiscordForNotification(notificationId, input);
}

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getUserNotifications(
  userId: string,
  limit = 30,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.userNotification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
