import type {
  Prisma,
  SecureDealRoomMessageSource,
  SecureDealRoomType,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessInternal,
  canManageBusinessTreasury,
  canViewCompanyDealRoom,
} from "@/lib/auth/permissions";
import {
  buildChannelOpenedDmBody,
  buildChannelOpenedDmTitle,
  buildDealRoomChannelName,
  buildDealRoomChannelWelcomeContent,
  buildWebsiteToDiscordChannelMessage,
  DEAL_ROOM_CHANNEL_FAILURE_COPY,
  sanitizeDiscordReplyContent,
} from "@/lib/bank/secure-deal-room-discord-copy";
import {
  DEAL_ROOM_TYPE_LABELS,
  type DiscordChannelMessageInput,
  type DiscordChannelMessageResult,
  type SecureDealRoomDiscordContext,
  type StaffDealRoomMessageNotifyInput,
  type WebsiteMessageSyncInput,
} from "@/lib/bank/secure-deal-room-discord-types";
import { buildNotificationDmPayload } from "@/lib/discord/notification-dm";
import { prisma } from "@/server/db";
import {
  dispatchEnsureDealRoomChannel,
  dispatchLockDealRoomChannel,
  dispatchPostDealRoomChannelMessage,
} from "@/server/deal-room-discord-channel-dispatch.service";
import { sendDiscordUserDm } from "@/server/discord-dm.service";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

type SessionRecord = Prisma.SecureDealRoomDiscordSessionGetPayload<object>;

function logDealRoomDiscord(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[deal-room-discord] ${message}`, meta ?? {});
}

export function resolveCustomerDealRoomUrl(
  dealRoomType: SecureDealRoomType,
  dealRoomId: string,
  context?: SecureDealRoomDiscordContext | null,
): string {
  switch (dealRoomType) {
    case "LOAN_APPLICATION":
      return `/bank/lending/applications/${dealRoomId}/thread`;
    case "ALTA_CARD_APPLICATION":
      if (context?.companyId) {
        return `/bank/alta-card/business/applications/${dealRoomId}/thread`;
      }
      return `/bank/alta-card/applications/${dealRoomId}/thread`;
    case "ALTA_CARD_REVIEW":
      if (context?.companyId && context?.cardId) {
        return `/bank/alta-card/business/${context.companyId}/review/${dealRoomId}/thread`;
      }
      if (context?.cardId) {
        return `/bank/alta-card/${context.cardId}/review/${dealRoomId}/thread`;
      }
      return `/bank/alta-card/reviews/${dealRoomId}/thread`;
    default:
      return "/bank";
  }
}

export function resolveInternalDealRoomUrl(
  dealRoomType: SecureDealRoomType,
  dealRoomId: string,
): string {
  switch (dealRoomType) {
    case "LOAN_APPLICATION":
      return `/internal/lending/applications/${dealRoomId}?tab=thread`;
    case "ALTA_CARD_APPLICATION":
      return `/internal/alta-card/applications/${dealRoomId}?tab=thread`;
    case "ALTA_CARD_REVIEW":
      return `/internal/alta-card/reviews/${dealRoomId}?tab=thread`;
    default:
      return "/internal/queues/deal-rooms";
  }
}

/** @deprecated DM reply routing — kept for unit tests only. */
export function resolveSessionForReply(
  sessions: SessionRecord[],
  referencedDiscordMessageId?: string | null,
): SessionRecord | "ambiguous" | null {
  const active = sessions.filter((s) => s.status === "ACTIVE");
  if (active.length === 0) return null;

  const ref = referencedDiscordMessageId?.trim();
  if (ref) {
    const matched = active.find((s) => s.lastDiscordMessageId === ref);
    if (matched) return matched;
    return active.length === 1 ? active[0]! : "ambiguous";
  }

  if (active.length === 1) {
    return active[0]!;
  }

  return "ambiguous";
}

async function upsertDiscordSession(input: {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  userId: string;
  discordUserId: string;
  discordChannelId: string;
  discordChannelName: string;
  context?: SecureDealRoomDiscordContext;
}): Promise<void> {
  await prisma.secureDealRoomDiscordSession.upsert({
    where: {
      dealRoomType_dealRoomId: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
      },
    },
    create: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      userId: input.userId,
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId,
      discordChannelName: input.discordChannelName,
      status: "ACTIVE",
      contextJson: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
      lastInteractionAt: new Date(),
    },
    update: {
      threadId: input.threadId,
      userId: input.userId,
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId,
      discordChannelName: input.discordChannelName,
      status: "ACTIVE",
      contextJson: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
      lastInteractionAt: new Date(),
    },
  });
}

export async function closeDiscordSessionsForDealRoom(
  dealRoomType: SecureDealRoomType,
  dealRoomId: string,
): Promise<void> {
  const sessions = await prisma.secureDealRoomDiscordSession.findMany({
    where: { dealRoomType, dealRoomId, status: "ACTIVE" },
  });

  for (const session of sessions) {
    if (session.discordChannelId) {
      void lockDealRoomDiscordChannelBestEffort({
        dealRoomType,
        dealRoomId,
        discordChannelId: session.discordChannelId,
        customerDiscordUserId: session.discordUserId,
        actorUserId: session.userId,
      });
    }
  }

  await prisma.secureDealRoomDiscordSession.updateMany({
    where: { dealRoomType, dealRoomId, status: "ACTIVE" },
    data: { status: "CLOSED", updatedAt: new Date() },
  });
}

async function createInAppDealRoomOpenedNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.userNotification.create({
    data: {
      userId: input.userId,
      type: "DEAL_ROOM_CREATED",
      channel: "IN_APP",
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

async function createInAppDealRoomNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.userNotification.create({
    data: {
      userId: input.userId,
      type: "DEAL_ROOM_MESSAGE_RECEIVED",
      channel: "IN_APP",
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export type DealRoomOpenedNotifyInput = {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  applicantUserId: string;
  welcomeBody: string;
  context?: SecureDealRoomDiscordContext;
};

export async function notifyCustomerDealRoomOpenedBestEffort(
  input: DealRoomOpenedNotifyInput,
): Promise<void> {
  try {
    await notifyCustomerDealRoomOpened(input);
  } catch (error) {
    logDealRoomDiscord("deal room opened notify failed", {
      dealRoomId: input.dealRoomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function notifyCustomerDealRoomOpened(input: DealRoomOpenedNotifyInput): Promise<void> {
  const applicant = await prisma.user.findUnique({
    where: { id: input.applicantUserId },
    select: { id: true, discordId: true, discordUsername: true },
  });

  const linkUrl = resolveCustomerDealRoomUrl(input.dealRoomType, input.dealRoomId, input.context);

  await createInAppDealRoomOpenedNotification({
    userId: input.applicantUserId,
    title: "Your Secure Deal Room is open",
    body: input.welcomeBody,
    linkUrl,
    metadata: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      source: "APPLICATION_OPENED",
    },
  });

  const discordUserId = applicant?.discordId?.trim();
  if (!discordUserId) {
    await recordDealRoomSyncFailure({
      action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
      actorUserId: input.applicantUserId,
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      description: "Discord channel skipped — customer has no linked Discord account.",
      reason: "no_discord_id",
      source: "APPLICATION_OPENED",
    });
    return;
  }

  const existing = await prisma.secureDealRoomDiscordSession.findUnique({
    where: {
      dealRoomType_dealRoomId: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
      },
    },
  });

  const channelName =
    existing?.discordChannelName ??
    buildDealRoomChannelName({
      discordUsername: applicant?.discordUsername ?? "customer",
      dealRoomType: input.dealRoomType,
    });

  const channelResult = await dispatchEnsureDealRoomChannel({
    channelName,
    customerDiscordUserId: discordUserId,
    dealRoomType: input.dealRoomType,
    dealRoomId: input.dealRoomId,
    welcomeContent: buildDealRoomChannelWelcomeContent(),
    linkUrl,
    existingChannelId: existing?.discordChannelId,
  });

  if (!channelResult.ok || !channelResult.channelId) {
    await recordDealRoomSyncFailure({
      action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
      actorUserId: input.applicantUserId,
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      description: "Discord channel creation failed when Secure Deal Room opened.",
      reason: channelResult.reason ?? "channel_create_failed",
      source: "APPLICATION_OPENED",
      discordChannelId: existing?.discordChannelId ?? undefined,
    });
    return;
  }

  await upsertDiscordSession({
    dealRoomType: input.dealRoomType,
    dealRoomId: input.dealRoomId,
    threadId: input.threadId,
    userId: input.applicantUserId,
    discordUserId,
    discordChannelId: channelResult.channelId,
    discordChannelName: channelResult.channelName ?? channelName,
    context: input.context,
  });

  await writeAuditLog({
    actorUserId: input.applicantUserId,
    action: channelResult.linked
      ? "DEAL_ROOM_DISCORD_CHANNEL_LINKED"
      : "DEAL_ROOM_DISCORD_CHANNEL_CREATED",
    entityType: auditEntityTypeForDealRoom(input.dealRoomType),
    entityId: input.dealRoomId,
    targetUserId: input.applicantUserId,
    description: channelResult.linked
      ? "Reused existing Discord channel for Secure Deal Room."
      : "Created private Discord channel for Secure Deal Room.",
    metadata: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      discordChannelId: channelResult.channelId,
      discordChannelName: channelResult.channelName ?? channelName,
      source: "APPLICATION_OPENED",
    },
  });

  sendStaffAuditMessage({
    product: "Deal Room",
    action: channelResult.linked
      ? "Discord channel linked"
      : "Discord channel created",
    actorUserId: input.applicantUserId,
    details: DEAL_ROOM_TYPE_LABELS[input.dealRoomType],
    internalUrl: resolveInternalDealRoomUrl(input.dealRoomType, input.dealRoomId),
    severity: "INFO",
    dedupeKey: `deal-room-channel-open:${input.dealRoomId}`,
  });

  const dmBody = buildChannelOpenedDmBody({
    dealRoomType: input.dealRoomType,
    channelName: channelResult.channelName ?? channelName,
  });
  const dmPayload = buildNotificationDmPayload({
    title: buildChannelOpenedDmTitle(),
    body: dmBody,
    linkUrl,
    linkLabel: "Open on Alta Bank",
  });
  await sendDiscordUserDm(discordUserId, dmPayload);
}

export async function notifyStaffDealRoomMessageBestEffort(
  input: StaffDealRoomMessageNotifyInput,
): Promise<void> {
  try {
    const linkUrl = resolveCustomerDealRoomUrl(input.dealRoomType, input.dealRoomId, input.context);
    await createInAppDealRoomNotification({
      userId: input.applicantUserId,
      title: "New message in your Secure Deal Room",
      body: previewInAppBody(input.messageBody),
      linkUrl,
      metadata: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
        threadId: input.threadId,
        messageId: input.messageId,
        staffUserId: input.staffUserId,
      },
    });
  } catch (error) {
    logDealRoomDiscord("staff in-app notify failed", {
      dealRoomId: input.dealRoomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function syncWebsiteMessageToDiscordBestEffort(
  input: WebsiteMessageSyncInput,
): Promise<void> {
  try {
    await syncWebsiteMessageToDiscord(input);
  } catch (error) {
    logDealRoomDiscord("website sync failed", {
      dealRoomId: input.dealRoomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function syncWebsiteMessageToDiscord(input: WebsiteMessageSyncInput): Promise<void> {
  const session = await prisma.secureDealRoomDiscordSession.findUnique({
    where: {
      dealRoomType_dealRoomId: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
      },
    },
  });

  if (!session?.discordChannelId || session.status !== "ACTIVE") {
    return;
  }

  const content = buildWebsiteToDiscordChannelMessage({
    senderDisplayName: input.senderDisplayName,
    messageBody: input.messageBody,
  });

  const delivery = await dispatchPostDealRoomChannelMessage({
    channelId: session.discordChannelId,
    content,
  });

  if (!delivery.ok || !delivery.messageId) {
    await recordDealRoomSyncFailure({
      action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
      actorUserId: input.senderUserId,
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      description: "Failed to sync website message to Discord channel.",
      reason: delivery.reason ?? "message_send_failed",
      source: "WEBSITE",
      discordChannelId: session.discordChannelId,
      messageId: input.messageId,
    });
    return;
  }

  await updateThreadMessageDiscordId(
    input.dealRoomType,
    input.messageId,
    delivery.messageId,
  );

  await writeAuditLog({
    actorUserId: input.senderUserId,
    action: "DEAL_ROOM_WEBSITE_MESSAGE_SYNCED_TO_DISCORD",
    entityType: auditEntityTypeForDealRoom(input.dealRoomType),
    entityId: input.dealRoomId,
    targetUserId: session.userId,
    description: "Website Deal Room message synced to Discord channel.",
    metadata: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      messageId: input.messageId,
      discordChannelId: session.discordChannelId,
      discordMessageId: delivery.messageId,
      source: "WEBSITE",
      senderRole: input.senderRole,
    },
  });
}

export async function ingestDiscordChannelMessage(
  input: DiscordChannelMessageInput,
): Promise<DiscordChannelMessageResult> {
  if (input.hasAttachments) {
    return { kind: "failed", reason: "attachments_not_supported" };
  }

  const body = sanitizeDiscordReplyContent(input.content);
  if (!body) {
    return { kind: "failed", reason: "empty_message" };
  }

  if (await isDiscordMessageAlreadySynced(input.discordMessageId)) {
    return { kind: "duplicate" };
  }

  const session = await prisma.secureDealRoomDiscordSession.findFirst({
    where: { discordChannelId: input.discordChannelId, status: "ACTIVE" },
  });
  if (!session) {
    return { kind: "ignored" };
  }

  if (await isThreadClosed(session.dealRoomType, session.threadId)) {
    await closeDiscordSessionsForDealRoom(session.dealRoomType, session.dealRoomId);
    return { kind: "closed" };
  }

  const userRecord = await prisma.user.findUnique({
    where: { discordId: input.discordUserId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) {
    await recordUnauthorizedDiscordMessage(session, input);
    return { kind: "unauthorized" };
  }

  const altaUser = mapDbUserToAltaUser(userRecord);
  const isStaff = canAccessInternal(altaUser);
  const isApplicant = await canUserPostAsApplicant(
    session.dealRoomType,
    session.threadId,
    altaUser,
  );

  if (!isStaff && !isApplicant) {
    await recordUnauthorizedDiscordMessage(session, input, altaUser.id);
    return { kind: "unauthorized" };
  }

  const senderRole = isStaff ? "ALTA_STAFF" : "APPLICANT";

  let messageId: string;
  try {
    messageId = await insertDiscordChannelMessage(
      session,
      altaUser.id,
      body,
      senderRole,
      input.discordMessageId,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    await recordDealRoomSyncFailure({
      action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
      actorUserId: altaUser.id,
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      threadId: session.threadId,
      description: "Failed to sync Discord channel message to website.",
      reason,
      source: "DISCORD",
      discordChannelId: session.discordChannelId,
      discordMessageId: input.discordMessageId,
    });
    return { kind: "failed", reason };
  }

  await prisma.secureDealRoomDiscordSession.update({
    where: { id: session.id },
    data: { lastInteractionAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: altaUser.id,
    action: "DEAL_ROOM_DISCORD_MESSAGE_SYNCED_TO_WEBSITE",
    entityType: auditEntityTypeForDealRoom(session.dealRoomType),
    entityId: session.dealRoomId,
    targetUserId: session.userId,
    description: "Discord channel message synced to Secure Deal Room.",
    metadata: {
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      threadId: session.threadId,
      messageId,
      discordChannelId: session.discordChannelId,
      discordMessageId: input.discordMessageId,
      source: "DISCORD",
      senderRole,
    },
  });

  if (senderRole === "APPLICANT") {
    sendStaffAuditMessage({
      product: "Deal Room",
      action: "Customer message via Discord channel",
      actorUserId: altaUser.id,
      details: `${DEAL_ROOM_TYPE_LABELS[session.dealRoomType]} · ${userRecord.discordUsername}`,
      internalUrl: resolveInternalDealRoomUrl(session.dealRoomType, session.dealRoomId),
      severity: "INFO",
      dedupeKey: `deal-room-discord-channel:${messageId}`,
    });
  }

  return { kind: "synced", messageId };
}

async function lockDealRoomDiscordChannelBestEffort(input: {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  discordChannelId: string;
  customerDiscordUserId: string;
  actorUserId: string;
}): Promise<void> {
  try {
    const result = await dispatchLockDealRoomChannel({
      channelId: input.discordChannelId,
      customerDiscordUserId: input.customerDiscordUserId,
    });

    if (!result.ok) {
      await recordDealRoomSyncFailure({
        action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
        actorUserId: input.actorUserId,
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
        description: "Failed to lock Discord channel when Deal Room closed.",
        reason: result.reason ?? "channel_lock_failed",
        source: "SYSTEM",
        discordChannelId: input.discordChannelId,
      });
      return;
    }

    await writeAuditLog({
      actorUserId: input.actorUserId,
      action: "DEAL_ROOM_DISCORD_CHANNEL_LOCKED",
      entityType: auditEntityTypeForDealRoom(input.dealRoomType),
      entityId: input.dealRoomId,
      description: "Discord channel locked when Secure Deal Room closed.",
      metadata: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
        discordChannelId: input.discordChannelId,
        source: "SYSTEM",
      },
    });
  } catch (error) {
    logDealRoomDiscord("channel lock failed", {
      dealRoomId: input.dealRoomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function previewInAppBody(body: string | null): string {
  const trimmed = body?.trim();
  if (!trimmed) return "Alta sent a new message in your Secure Deal Room.";
  return trimmed.length > 280 ? `${trimmed.slice(0, 279)}…` : trimmed;
}

function auditEntityTypeForDealRoom(
  dealRoomType: SecureDealRoomType,
): "LOAN_APPLICATION" | "ALTA_CARD" | "DEAL_ROOM" {
  if (dealRoomType === "LOAN_APPLICATION") return "LOAN_APPLICATION";
  return "ALTA_CARD";
}

async function isDiscordMessageAlreadySynced(discordMessageId: string): Promise<boolean> {
  const [loan, card, review] = await Promise.all([
    prisma.loanApplicationThreadMessage.findFirst({ where: { discordMessageId } }),
    prisma.altaCardApplicationThreadMessage.findFirst({ where: { discordMessageId } }),
    prisma.altaCardReviewThreadMessage.findFirst({ where: { discordMessageId } }),
  ]);
  return !!(loan || card || review);
}

async function updateThreadMessageDiscordId(
  dealRoomType: SecureDealRoomType,
  messageId: string,
  discordMessageId: string,
): Promise<void> {
  switch (dealRoomType) {
    case "LOAN_APPLICATION":
      await prisma.loanApplicationThreadMessage.update({
        where: { id: messageId },
        data: { discordMessageId },
      });
      return;
    case "ALTA_CARD_APPLICATION":
      await prisma.altaCardApplicationThreadMessage.update({
        where: { id: messageId },
        data: { discordMessageId },
      });
      return;
    case "ALTA_CARD_REVIEW":
      await prisma.altaCardReviewThreadMessage.update({
        where: { id: messageId },
        data: { discordMessageId },
      });
      return;
    default:
      throw new Error("UNSUPPORTED_DEAL_ROOM_TYPE");
  }
}

async function isThreadClosed(
  dealRoomType: SecureDealRoomType,
  threadId: string,
): Promise<boolean> {
  switch (dealRoomType) {
    case "LOAN_APPLICATION": {
      const thread = await prisma.loanApplicationThread.findUnique({
        where: { id: threadId },
        select: { status: true },
      });
      return thread?.status === "CLOSED";
    }
    case "ALTA_CARD_APPLICATION": {
      const thread = await prisma.altaCardApplicationThread.findUnique({
        where: { id: threadId },
        select: { status: true },
      });
      return thread?.status === "CLOSED";
    }
    case "ALTA_CARD_REVIEW": {
      const thread = await prisma.altaCardReviewThread.findUnique({
        where: { id: threadId },
        select: { status: true },
      });
      return thread?.status === "CLOSED";
    }
    default:
      return true;
  }
}

async function canUserPostAsApplicant(
  dealRoomType: SecureDealRoomType,
  threadId: string,
  user: AltaUser,
): Promise<boolean> {
  switch (dealRoomType) {
    case "LOAN_APPLICATION": {
      const thread = await prisma.loanApplicationThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, status: true },
      });
      if (!thread || thread.status === "CLOSED") return false;
      if (thread.applicantUserId === user.id) return true;
      if (thread.companyId && canManageBusinessTreasury(user, { companyId: thread.companyId })) {
        return true;
      }
      return false;
    }
    case "ALTA_CARD_APPLICATION": {
      const thread = await prisma.altaCardApplicationThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, status: true },
      });
      if (!thread || thread.status === "CLOSED") return false;
      if (thread.applicantUserId === user.id) return true;
      if (thread.companyId && canManageBusinessTreasury(user, { companyId: thread.companyId })) {
        return true;
      }
      return false;
    }
    case "ALTA_CARD_REVIEW": {
      const thread = await prisma.altaCardReviewThread.findUnique({
        where: { id: threadId },
        select: { applicantUserId: true, companyId: true, status: true },
      });
      if (!thread || thread.status === "CLOSED") return false;
      if (thread.applicantUserId === user.id) return true;
      if (thread.companyId && canViewCompanyDealRoom(user, thread.companyId)) return true;
      return false;
    }
    default:
      return false;
  }
}

async function insertDiscordChannelMessage(
  session: SessionRecord,
  userId: string,
  body: string,
  senderRole: "APPLICANT" | "ALTA_STAFF",
  discordMessageId: string,
): Promise<string> {
  const source: SecureDealRoomMessageSource = "DISCORD";
  const nextStatus = senderRole === "ALTA_STAFF" ? "WAITING_ON_APPLICANT" : "WAITING_ON_ALTA";

  switch (session.dealRoomType) {
    case "LOAN_APPLICATION": {
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.loanApplicationThreadMessage.create({
          data: {
            threadId: session.threadId,
            senderUserId: userId,
            senderRole,
            source,
            body,
            discordMessageId,
          },
        });
        await tx.loanApplicationThread.update({
          where: { id: session.threadId },
          data: { status: nextStatus, updatedAt: new Date() },
        });
        return created;
      });
      return message.id;
    }
    case "ALTA_CARD_APPLICATION": {
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.altaCardApplicationThreadMessage.create({
          data: {
            threadId: session.threadId,
            senderUserId: userId,
            senderRole,
            source,
            body,
            discordMessageId,
          },
        });
        await tx.altaCardApplicationThread.update({
          where: { id: session.threadId },
          data: { status: nextStatus, updatedAt: new Date() },
        });
        return created;
      });
      return message.id;
    }
    case "ALTA_CARD_REVIEW": {
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.altaCardReviewThreadMessage.create({
          data: {
            threadId: session.threadId,
            senderUserId: userId,
            senderRole,
            source,
            body,
            discordMessageId,
          },
        });
        await tx.altaCardReviewThread.update({
          where: { id: session.threadId },
          data: { status: nextStatus, updatedAt: new Date() },
        });
        return created;
      });
      return message.id;
    }
    default:
      throw new Error("UNSUPPORTED_DEAL_ROOM_TYPE");
  }
}

async function recordUnauthorizedDiscordMessage(
  session: SessionRecord,
  input: DiscordChannelMessageInput,
  actorUserId?: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actorUserId ?? session.userId,
    action: "DEAL_ROOM_DISCORD_SYNC_FAILED",
    entityType: auditEntityTypeForDealRoom(session.dealRoomType),
    entityId: session.dealRoomId,
    targetUserId: session.userId,
    description: "Unauthorized Discord channel message rejected.",
    metadata: {
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      discordChannelId: input.discordChannelId,
      discordMessageId: input.discordMessageId,
      discordUserId: input.discordUserId,
      source: "DISCORD",
      reason: "unauthorized",
    },
  });
}

async function recordDealRoomSyncFailure(input: {
  action: string;
  actorUserId: string;
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId?: string;
  description: string;
  reason: string;
  source: string;
  discordChannelId?: string | null;
  discordMessageId?: string;
  messageId?: string;
}): Promise<void> {
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: auditEntityTypeForDealRoom(input.dealRoomType),
    entityId: input.dealRoomId,
    description: input.description,
    metadata: {
      dealRoomType: input.dealRoomType,
      dealRoomId: input.dealRoomId,
      threadId: input.threadId,
      discordChannelId: input.discordChannelId,
      discordMessageId: input.discordMessageId,
      messageId: input.messageId,
      source: input.source,
      reason: input.reason,
    },
  });

  sendStaffAuditMessage({
    product: "Deal Room",
    action: "Discord sync failed",
    actorUserId: input.actorUserId,
    details: `${DEAL_ROOM_TYPE_LABELS[input.dealRoomType]} · ${input.reason}`,
    internalUrl: resolveInternalDealRoomUrl(input.dealRoomType, input.dealRoomId),
    severity: "WARNING",
    dedupeKey: `deal-room-sync-failed:${input.dealRoomId}:${input.reason}:${input.messageId ?? input.discordMessageId ?? "open"}`,
  });
}

export async function resolveDealRoomContextForStaffMessage(
  dealRoomType: SecureDealRoomType,
  dealRoomId: string,
): Promise<SecureDealRoomDiscordContext | undefined> {
  if (dealRoomType === "ALTA_CARD_REVIEW") {
    const review = await prisma.altaCardReviewRequest.findUnique({
      where: { id: dealRoomId },
      select: { altaCardId: true, companyId: true },
    });
    if (!review) return undefined;
    return { cardId: review.altaCardId, companyId: review.companyId };
  }
  if (dealRoomType === "ALTA_CARD_APPLICATION") {
    const app = await prisma.altaCardApplication.findUnique({
      where: { id: dealRoomId },
      select: { companyId: true },
    });
    if (!app) return undefined;
    return { companyId: app.companyId };
  }
  return undefined;
}
