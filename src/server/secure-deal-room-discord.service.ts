import type {
  Prisma,
  SecureDealRoomMessageSource,
  SecureDealRoomType,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canViewCompanyDealRoom,
} from "@/lib/auth/permissions";
import {
  buildStaffDealRoomDmBody,
  buildStaffDealRoomDmTitle,
  DEAL_ROOM_REPLY_FAILURE_COPY,
  sanitizeDiscordReplyContent,
} from "@/lib/bank/secure-deal-room-discord-copy";
import {
  DEAL_ROOM_TYPE_LABELS,
  type DiscordDealRoomReplyInput,
  type DiscordDealRoomReplyResult,
  type SecureDealRoomDiscordContext,
  type StaffDealRoomMessageNotifyInput,
} from "@/lib/bank/secure-deal-room-discord-types";
import { buildNotificationDmPayload } from "@/lib/discord/notification-dm";
import { prisma } from "@/server/db";
import { sendDiscordUserDm } from "@/server/discord-dm.service";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

const ALTA_CREDIT_DESK_NAME = "Alta Credit Desk";

const PENDING_REPLY_TTL_MS = 5 * 60 * 1000;
const pendingDiscordReplies = new Map<
  string,
  { content: string; hasAttachments: boolean; expiresAt: number }
>();

export function resetPendingDiscordRepliesForTests(): void {
  pendingDiscordReplies.clear();
}

export function stashPendingDiscordReply(
  discordUserId: string,
  content: string,
  hasAttachments: boolean,
): void {
  pendingDiscordReplies.set(discordUserId, {
    content,
    hasAttachments,
    expiresAt: Date.now() + PENDING_REPLY_TTL_MS,
  });
}

function consumePendingDiscordReply(discordUserId: string): {
  content: string;
  hasAttachments: boolean;
} | null {
  const pending = pendingDiscordReplies.get(discordUserId);
  if (!pending) return null;
  pendingDiscordReplies.delete(discordUserId);
  if (pending.expiresAt < Date.now()) return null;
  return { content: pending.content, hasAttachments: pending.hasAttachments };
}

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

async function deliverDealRoomDm(input: {
  userId: string;
  discordUserId: string;
  dealRoomType: SecureDealRoomType;
  title: string;
  body: string;
  linkUrl: string;
}): Promise<{ sent: boolean; messageId?: string; channelId?: string; reason?: string }> {
  const payload = buildNotificationDmPayload({
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    linkLabel: "Open Deal Room",
  });

  const result = await sendDiscordUserDm(input.discordUserId, payload);
  if (!result.sent) {
    return { sent: false, reason: result.reason };
  }
  return { sent: true, messageId: result.messageId, channelId: result.channelId };
}

async function upsertDiscordSession(input: {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  userId: string;
  discordUserId: string;
  discordChannelId?: string | null;
  lastDiscordMessageId?: string | null;
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
      discordChannelId: input.discordChannelId ?? null,
      lastDiscordMessageId: input.lastDiscordMessageId ?? null,
      status: "ACTIVE",
      contextJson: input.context ?? undefined,
      lastInteractionAt: new Date(),
    },
    update: {
      threadId: input.threadId,
      userId: input.userId,
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId ?? undefined,
      lastDiscordMessageId: input.lastDiscordMessageId ?? undefined,
      status: "ACTIVE",
      contextJson: input.context ?? undefined,
      lastInteractionAt: new Date(),
    },
  });
}

export async function closeDiscordSessionsForDealRoom(
  dealRoomType: SecureDealRoomType,
  dealRoomId: string,
): Promise<void> {
  await prisma.secureDealRoomDiscordSession.updateMany({
    where: { dealRoomType, dealRoomId, status: "ACTIVE" },
    data: { status: "CLOSED", updatedAt: new Date() },
  });
}

async function createInAppDealRoomNotification(input: {
  userId: string;
  dealRoomType: SecureDealRoomType;
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
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function notifyCustomerOfStaffDealRoomMessage(
  input: StaffDealRoomMessageNotifyInput,
): Promise<void> {
  const applicant = await prisma.user.findUnique({
    where: { id: input.applicantUserId },
    select: { id: true, discordId: true, discordUsername: true },
  });

  const linkUrl = resolveCustomerDealRoomUrl(input.dealRoomType, input.dealRoomId, input.context);
  const title = buildStaffDealRoomDmTitle(input.dealRoomType);
  const body = buildStaffDealRoomDmBody({
    dealRoomType: input.dealRoomType,
    staffDisplayName: ALTA_CREDIT_DESK_NAME,
    messageBody: input.messageBody,
  });

  await createInAppDealRoomNotification({
    userId: input.applicantUserId,
    dealRoomType: input.dealRoomType,
    title,
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

  const discordUserId = applicant?.discordId?.trim();
  if (!discordUserId) {
    await writeAuditLog({
      actorUserId: input.staffUserId,
      action: "DEAL_ROOM_DISCORD_DM_FAILED",
      entityType: auditEntityTypeForDealRoom(input.dealRoomType),
      entityId: input.dealRoomId,
      targetUserId: input.applicantUserId,
      description: `Discord DM skipped — customer has no linked Discord account.`,
      metadata: auditMetadata(input, { reason: "no_discord_id" }),
    });
    return;
  }

  const delivery = await deliverDealRoomDm({
    userId: input.applicantUserId,
    discordUserId,
    dealRoomType: input.dealRoomType,
    title,
    body,
    linkUrl,
  });

  if (!delivery.sent) {
    await writeAuditLog({
      actorUserId: input.staffUserId,
      action: "DEAL_ROOM_DISCORD_DM_FAILED",
      entityType: auditEntityTypeForDealRoom(input.dealRoomType),
      entityId: input.dealRoomId,
      targetUserId: input.applicantUserId,
      description: `Discord DM failed for Secure Deal Room message.`,
      metadata: auditMetadata(input, {
        reason: delivery.reason ?? "delivery_failed",
        discordUserId,
      }),
    });

    sendStaffAuditMessage({
      product: "Alta Bank",
      action: "Deal Room: Discord DM failed",
      actorUserId: input.staffUserId,
      details: `${DEAL_ROOM_TYPE_LABELS[input.dealRoomType]} · ${applicant?.discordUsername ?? input.applicantUserId}`,
      internalUrl: resolveInternalDealRoomUrl(input.dealRoomType, input.dealRoomId),
      severity: "WARNING",
      dedupeKey: `deal-room-dm-failed:${input.messageId}`,
    });
    return;
  }

  await upsertDiscordSession({
    dealRoomType: input.dealRoomType,
    dealRoomId: input.dealRoomId,
    threadId: input.threadId,
    userId: input.applicantUserId,
    discordUserId,
    discordChannelId: delivery.channelId,
    lastDiscordMessageId: delivery.messageId,
    context: input.context,
  });

  await writeAuditLog({
    actorUserId: input.staffUserId,
    action: "DEAL_ROOM_DISCORD_DM_SENT",
    entityType: auditEntityTypeForDealRoom(input.dealRoomType),
    entityId: input.dealRoomId,
    targetUserId: input.applicantUserId,
    description: `Discord DM sent for Secure Deal Room staff message.`,
    metadata: auditMetadata(input, {
      discordUserId,
      discordMessageId: delivery.messageId,
      source: "WEBSITE",
    }),
  });
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

function auditMetadata(
  input: StaffDealRoomMessageNotifyInput,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    dealRoomType: input.dealRoomType,
    dealRoomId: input.dealRoomId,
    threadId: input.threadId,
    userId: input.applicantUserId,
    messageId: input.messageId,
    staffUserId: input.staffUserId,
    ...extra,
  };
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

async function canUserReplyAsApplicant(
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

async function insertDiscordApplicantMessage(
  session: SessionRecord,
  userId: string,
  body: string,
): Promise<string> {
  const source: SecureDealRoomMessageSource = "DISCORD";

  switch (session.dealRoomType) {
    case "LOAN_APPLICATION": {
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.loanApplicationThreadMessage.create({
          data: {
            threadId: session.threadId,
            senderUserId: userId,
            senderRole: "APPLICANT",
            source,
            body,
          },
        });
        await tx.loanApplicationThread.update({
          where: { id: session.threadId },
          data: { status: "WAITING_ON_ALTA", updatedAt: new Date() },
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
            senderRole: "APPLICANT",
            source,
            body,
          },
        });
        await tx.altaCardApplicationThread.update({
          where: { id: session.threadId },
          data: { status: "WAITING_ON_ALTA", updatedAt: new Date() },
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
            senderRole: "APPLICANT",
            source,
            body,
          },
        });
        await tx.altaCardReviewThread.update({
          where: { id: session.threadId },
          data: { status: "WAITING_ON_ALTA", updatedAt: new Date() },
        });
        return created;
      });
      return message.id;
    }
    default:
      throw new Error("UNSUPPORTED_DEAL_ROOM_TYPE");
  }
}

function parseSessionContext(session: SessionRecord): SecureDealRoomDiscordContext | null {
  const raw = session.contextJson;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    cardId: typeof record.cardId === "string" ? record.cardId : null,
    companyId: typeof record.companyId === "string" ? record.companyId : null,
  };
}

export async function ingestCustomerDiscordDealRoomReply(
  input: DiscordDealRoomReplyInput,
): Promise<DiscordDealRoomReplyResult> {
  if (input.hasAttachments) {
    const user = await prisma.user.findUnique({
      where: { discordId: input.discordUserId },
      select: { id: true },
    });
    const sessions = user
      ? await prisma.secureDealRoomDiscordSession.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          orderBy: { lastInteractionAt: "desc" },
        })
      : [];
    const session = resolveSessionForReply(sessions, input.referencedDiscordMessageId);
    const linkUrl =
      session && session !== "ambiguous"
        ? resolveCustomerDealRoomUrl(
            session.dealRoomType,
            session.dealRoomId,
            parseSessionContext(session),
          )
        : "/bank";
    return {
      ok: false,
      replyText: DEAL_ROOM_REPLY_FAILURE_COPY.attachment,
      linkUrl,
    };
  }

  const body = sanitizeDiscordReplyContent(input.content);
  if (!body) {
    return { ok: false, replyText: DEAL_ROOM_REPLY_FAILURE_COPY.empty };
  }

  const userRecord = await prisma.user.findUnique({
    where: { discordId: input.discordUserId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) {
    return { ok: false, replyText: DEAL_ROOM_REPLY_FAILURE_COPY.wrongUser };
  }

  const altaUser = mapDbUserToAltaUser(userRecord);
  const sessions = await prisma.secureDealRoomDiscordSession.findMany({
    where: { discordUserId: input.discordUserId, status: "ACTIVE" },
    orderBy: { lastInteractionAt: "desc" },
  });

  const resolved = resolveSessionForReply(sessions, input.referencedDiscordMessageId);
  if (!resolved) {
    return {
      ok: false,
      replyText: DEAL_ROOM_REPLY_FAILURE_COPY.ambiguous,
      linkUrl: "/bank",
    };
  }

  if (resolved === "ambiguous") {
    stashPendingDiscordReply(input.discordUserId, input.content, input.hasAttachments);
    return {
      ok: true,
      kind: "picker",
      pickerText: DEAL_ROOM_REPLY_FAILURE_COPY.pickerPrompt,
      options: sessions
        .filter((s) => s.status === "ACTIVE")
        .slice(0, 5)
        .map((s) => ({
          label: DEAL_ROOM_TYPE_LABELS[s.dealRoomType],
          dealRoomType: s.dealRoomType,
          dealRoomId: s.dealRoomId,
        })),
    };
  }

  const session = resolved;
  if (session.userId !== altaUser.id && !(await canUserReplyAsApplicant(session.dealRoomType, session.threadId, altaUser))) {
    return { ok: false, replyText: DEAL_ROOM_REPLY_FAILURE_COPY.wrongUser };
  }

  if (await isThreadClosed(session.dealRoomType, session.threadId)) {
    await closeDiscordSessionsForDealRoom(session.dealRoomType, session.dealRoomId);
    const linkUrl = resolveCustomerDealRoomUrl(
      session.dealRoomType,
      session.dealRoomId,
      parseSessionContext(session),
    );
    return { ok: false, replyText: DEAL_ROOM_REPLY_FAILURE_COPY.closed, linkUrl };
  }

  if (!(await canUserReplyAsApplicant(session.dealRoomType, session.threadId, altaUser))) {
    return { ok: false, replyText: DEAL_ROOM_REPLY_FAILURE_COPY.wrongUser };
  }

  let messageId: string;
  try {
    messageId = await insertDiscordApplicantMessage(session, altaUser.id, body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    await writeAuditLog({
      actorUserId: altaUser.id,
      action: "DEAL_ROOM_CUSTOMER_REPLY_FAILED",
      entityType: auditEntityTypeForDealRoom(session.dealRoomType),
      entityId: session.dealRoomId,
      targetUserId: session.userId,
      description: "Failed to write Discord reply to Secure Deal Room.",
      metadata: {
        dealRoomType: session.dealRoomType,
        dealRoomId: session.dealRoomId,
        userId: altaUser.id,
        discordUserId: input.discordUserId,
        source: "DISCORD",
        reason,
      },
    });
    return {
      ok: false,
      replyText:
        "Alta could not post your reply right now. Please open your Secure Deal Room on Alta Bank to continue.",
      linkUrl: resolveCustomerDealRoomUrl(
        session.dealRoomType,
        session.dealRoomId,
        parseSessionContext(session),
      ),
    };
  }

  await prisma.secureDealRoomDiscordSession.update({
    where: { id: session.id },
    data: {
      lastInteractionAt: new Date(),
      discordChannelId: input.discordChannelId,
    },
  });

  await writeAuditLog({
    actorUserId: altaUser.id,
    action: "DEAL_ROOM_CUSTOMER_REPLY_RECEIVED",
    entityType: auditEntityTypeForDealRoom(session.dealRoomType),
    entityId: session.dealRoomId,
    targetUserId: session.userId,
    description: "Customer replied to Secure Deal Room via Discord.",
    metadata: {
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      userId: altaUser.id,
      discordUserId: input.discordUserId,
      source: "DISCORD",
      messageId,
    },
  });

  await writeAuditLog({
    actorUserId: altaUser.id,
    action: "DEAL_ROOM_MESSAGE_SOURCE_DISCORD",
    entityType: auditEntityTypeForDealRoom(session.dealRoomType),
    entityId: session.dealRoomId,
    targetUserId: session.userId,
    description: "Secure Deal Room message recorded with Discord source.",
    metadata: {
      dealRoomType: session.dealRoomType,
      dealRoomId: session.dealRoomId,
      userId: altaUser.id,
      discordUserId: input.discordUserId,
      source: "DISCORD",
      messageId,
    },
  });

  sendStaffAuditMessage({
    product: "Alta Bank",
    action: "Deal Room: Customer replied via Discord",
    actorUserId: altaUser.id,
    details: `${DEAL_ROOM_TYPE_LABELS[session.dealRoomType]} · ${userRecord.discordUsername}`,
    internalUrl: resolveInternalDealRoomUrl(session.dealRoomType, session.dealRoomId),
    severity: "INFO",
    dedupeKey: `deal-room-discord-reply:${messageId}`,
  });

  logDealRoomDiscord("customer reply posted", {
    dealRoomType: session.dealRoomType,
    dealRoomId: session.dealRoomId,
    messageId,
  });

  return { ok: true, kind: "message_posted", confirmationText: DEAL_ROOM_REPLY_FAILURE_COPY.posted };
}

export async function ingestCustomerDiscordDealRoomReplyForSession(input: {
  discordUserId: string;
  discordChannelId: string;
  discordMessageId: string;
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  content?: string;
  hasAttachments?: boolean;
}): Promise<DiscordDealRoomReplyResult> {
  const pending = consumePendingDiscordReply(input.discordUserId);
  const content = pending?.content ?? input.content ?? "";
  const hasAttachments = pending?.hasAttachments ?? input.hasAttachments ?? false;

  const session = await prisma.secureDealRoomDiscordSession.findUnique({
    where: {
      dealRoomType_dealRoomId: {
        dealRoomType: input.dealRoomType,
        dealRoomId: input.dealRoomId,
      },
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return {
      ok: false,
      replyText: DEAL_ROOM_REPLY_FAILURE_COPY.ambiguous,
      linkUrl: "/bank",
    };
  }

  return ingestCustomerDiscordDealRoomReply({
    discordUserId: input.discordUserId,
    discordChannelId: input.discordChannelId,
    discordMessageId: input.discordMessageId,
    referencedDiscordMessageId: session.lastDiscordMessageId,
    content,
    hasAttachments,
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

export async function notifyStaffDealRoomMessageBestEffort(
  input: StaffDealRoomMessageNotifyInput,
): Promise<void> {
  try {
    await notifyCustomerOfStaffDealRoomMessage(input);
  } catch (error) {
    logDealRoomDiscord("staff notify failed", {
      dealRoomId: input.dealRoomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
