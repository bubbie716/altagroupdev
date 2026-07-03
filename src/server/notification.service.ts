import type { UserNotificationType as DbNotificationType } from "@prisma/client";
import { prisma } from "@/server/db";

export type CreateNotificationInput = {
  userId: string;
  type: DbNotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
  embedImageUrl?: string | null;
};

async function dispatchDiscordForNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const { isDiscordNotificationEnabled } = await import("@/server/bank-settings.service");
    const enabled = await isDiscordNotificationEnabled(input.userId, input.type);
    if (!enabled) {
      if (process.env.NODE_ENV !== "test") {
        console.info("[notifications] Discord DM skipped by user preference", {
          userId: input.userId,
          type: input.type,
        });
      }
      return;
    }

    const { dispatchNotificationDm } = await import("@/server/notification-discord-dispatch.service");
    const result = await dispatchNotificationDm({
      userId: input.userId,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      embedImageUrl: input.embedImageUrl,
    });
    if (!result.sent && process.env.NODE_ENV !== "test") {
      console.warn("[notifications] Discord DM not sent", {
        userId: input.userId,
        type: input.type,
        reason: result.reason,
      });
    }
  } catch (error) {
    console.error("[notifications] Discord dispatch failed", error);
  }
}

/** In-app notification with optional Discord DM delivery. */
export async function createUserNotification(input: CreateNotificationInput): Promise<void> {
  await prisma.userNotification.create({
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

  await dispatchDiscordForNotification(input);
}

export async function createUserNotifications(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.userNotification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: input.type,
      channel: "IN_APP" as const,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      metadata: input.metadata ?? undefined,
    })),
  });

  for (const userId of unique) {
    await dispatchDiscordForNotification({ userId, ...input });
  }
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
