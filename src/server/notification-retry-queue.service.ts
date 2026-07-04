import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { isRetryableDeliveryFailure } from "@/server/notification-delivery-audit.service";

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 24 * 60 * 60_000];

export type CustomerDmQueuePayload = {
  title: string;
  body: string;
  linkUrl: string;
  linkLabel?: string;
  notificationId?: string;
};

export type EnqueueCustomerDmInput = {
  userId: string;
  payload: CustomerDmQueuePayload;
  dedupeKey: string;
  sourceAction?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  reason?: string;
};

function nextRetryAt(attempts: number): Date {
  const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS.at(-1)!;
  return new Date(Date.now() + delay);
}

export async function enqueueCustomerDmRetry(input: EnqueueCustomerDmInput): Promise<string | null> {
  if (input.reason && !isRetryableDeliveryFailure(input.reason)) {
    return null;
  }

  const existing = await prisma.notificationDeliveryQueue.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { id: true, status: true },
  });
  if (existing && (existing.status === "PENDING" || existing.status === "RETRYING" || existing.status === "SENT")) {
    return existing.id;
  }

  const row = await prisma.notificationDeliveryQueue.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      userId: input.userId,
      channel: "DISCORD_DM",
      payload: input.payload as Prisma.InputJsonValue,
      dedupeKey: input.dedupeKey,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: nextRetryAt(0),
      lastError: input.reason ?? null,
      status: "PENDING",
      sourceAction: input.sourceAction ?? null,
      sourceEntityType: input.sourceEntityType ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
    },
    update: {
      payload: input.payload as Prisma.InputJsonValue,
      lastError: input.reason ?? null,
      status: "PENDING",
      nextRetryAt: nextRetryAt(0),
      sourceAction: input.sourceAction ?? null,
      sourceEntityType: input.sourceEntityType ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
    },
  });

  return row.id;
}

export type ProcessNotificationRetryQueueResult = {
  processed: number;
  sent: number;
  requeued: number;
  permanentFailures: number;
};

export async function processNotificationRetryQueue(
  now = new Date(),
): Promise<ProcessNotificationRetryQueueResult> {
  const due = await prisma.notificationDeliveryQueue.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { nextRetryAt: "asc" },
    take: 50,
  });

  const { dispatchNotificationDm } = await import("@/server/notification-discord-dispatch.service");
  let sent = 0;
  let requeued = 0;
  let permanentFailures = 0;

  for (const row of due) {
    const payload = row.payload as CustomerDmQueuePayload;
    const result = await dispatchNotificationDm({
      userId: row.userId,
      title: payload.title,
      body: payload.body,
      linkUrl: payload.linkUrl,
      linkLabel: payload.linkLabel,
    });

    if (result.sent) {
      await prisma.notificationDeliveryQueue.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts: row.attempts + 1,
          lastError: null,
          nextRetryAt: null,
        },
      });
      if (payload.notificationId) {
        await prisma.userNotification.updateMany({
          where: { id: payload.notificationId },
          data: { discordNotifiedAt: new Date() },
        });
      }
      sent += 1;
      continue;
    }

    const attempts = row.attempts + 1;
    const retryable = isRetryableDeliveryFailure(result.reason);
    if (!retryable || attempts >= row.maxAttempts) {
      await prisma.notificationDeliveryQueue.update({
        where: { id: row.id },
        data: {
          status: "PERMANENT_FAILURE",
          attempts,
          lastError: result.reason ?? "delivery_failed",
          nextRetryAt: null,
        },
      });
      permanentFailures += 1;

      const { recordCustomerDmDeliveryFailure } = await import(
        "@/server/notification-delivery-audit.service"
      );
      const { writeAuditLog } = await import("@/server/audit.service");
      await recordCustomerDmDeliveryFailure({
        actorUserId: row.userId,
        userId: row.userId,
        title: payload.title,
        reason: result.reason ?? "max_retries_exceeded",
        retryable: false,
        sourceAction: row.sourceAction ?? undefined,
        metadata: {
          queueId: row.id,
          attempts,
          maxAttempts: row.maxAttempts,
          permanentFailure: true,
        },
      });
      await writeAuditLog({
        actorUserId: row.userId,
        action: "OPS_NOTIFICATION_DELIVERY_FAILED",
        entityType: "USER",
        entityId: row.userId,
        targetUserId: row.userId,
        description: `Customer DM permanently failed after ${attempts} attempts`,
        metadata: {
          source: "CRON",
          severity: "warning",
          queueId: row.id,
          attempts,
          reason: result.reason ?? "max_retries_exceeded",
          requiresAction: true,
        },
      });
      continue;
    }

    await prisma.notificationDeliveryQueue.update({
      where: { id: row.id },
      data: {
        status: "RETRYING",
        attempts,
        lastError: result.reason ?? "delivery_failed",
        nextRetryAt: nextRetryAt(attempts),
      },
    });
    requeued += 1;
  }

  return { processed: due.length, sent, requeued, permanentFailures };
}

export async function countPermanentNotificationFailures(): Promise<number> {
  return prisma.notificationDeliveryQueue.count({
    where: { status: "PERMANENT_FAILURE" },
  });
}
