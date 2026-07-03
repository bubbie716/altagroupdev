import type {
  AltaCardApplicationThreadSenderRole as DbSenderRole,
  AltaCardApplicationThreadStatus as DbThreadStatus,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { ALTA_CARD_APPLICATION_THREAD_WELCOME_MESSAGE, buildAltaCardApplicationAcceptedSystemMessage } from "@/lib/bank/secure-deal-room-system-copy";
import {
  canManageBusinessTreasury,
  isAdmin,
  isOperator,
} from "@/lib/auth/permissions";
import type {
  AltaCardApplicationThreadContext,
  AltaCardApplicationThreadMessageRow,
  AltaCardApplicationThreadStatusCode,
  AltaCardThreadAttachment,
  AltaCardThreadSenderRoleCode,
  AssignAltaCardThreadStaffInput,
  SendAltaCardThreadMessageInput,
  UpdateAltaCardThreadStatusInput,
} from "@/lib/bank/alta-card-application-thread-types";
import {
  ALTA_CARD_THREAD_STATUS_LABELS,
  ALTA_CARD_THREAD_STATUS_LABELS_INTERNAL,
} from "@/lib/bank/alta-card-application-thread-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { enrichLegacyThreadMessage, sanitizeThreadMessageBodyForAudience } from "@/lib/bank/thread-message-utils";
import type { ThreadMessageAudience } from "@/lib/bank/thread-message-utils";
import { sourceCodeFromDb } from "@/lib/bank/secure-deal-room-discord-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { toAltaCardApplicationStatusCode, toAltaCardTierCode, toAltaCardTypeCode } from "@/server/alta-card-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  assertSecureThreadUploadAccess,
  SECURE_THREAD_CLOSED_UPLOAD_MESSAGES,
} from "@/server/secure-thread-attachment-access";
import {
  closeDiscordSessionsForDealRoom,
  notifyCustomerDealRoomOpenedBestEffort,
  notifyStaffDealRoomMessageBestEffort,
  resolveDealRoomContextForStaffMessage,
  syncWebsiteMessageToDiscordBestEffort,
} from "@/server/secure-deal-room-discord.service";

const ALTA_CREDIT_DESK_NAME = "Alta Credit Desk";

const STATUS_FROM_DB: Record<DbThreadStatus, AltaCardApplicationThreadStatusCode> = {
  OPEN: "open",
  WAITING_ON_APPLICANT: "waiting_on_applicant",
  WAITING_ON_ALTA: "waiting_on_alta",
  CLOSED: "closed",
};

const STATUS_TO_DB: Record<AltaCardApplicationThreadStatusCode, DbThreadStatus> = {
  open: "OPEN",
  waiting_on_applicant: "WAITING_ON_APPLICANT",
  waiting_on_alta: "WAITING_ON_ALTA",
  closed: "CLOSED",
};

const ROLE_FROM_DB: Record<DbSenderRole, AltaCardThreadSenderRoleCode> = {
  APPLICANT: "applicant",
  ALTA_STAFF: "alta_staff",
  SYSTEM: "system",
};

const threadInclude = {
  application: {
    include: {
      applicant: { select: { discordUsername: true, discordId: true, discordAvatar: true } },
      company: { select: { name: true } },
    },
  },
  assignedStaff: { select: { id: true, discordUsername: true } },
} satisfies Prisma.AltaCardApplicationThreadInclude;

type ThreadRecord = Prisma.AltaCardApplicationThreadGetPayload<{ include: typeof threadInclude }>;

function discordAvatarUrl(discordId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function isStaff(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function canViewThread(user: AltaUser, thread: ThreadRecord): boolean {
  if (isStaff(user)) return true;
  if (thread.applicantUserId === user.id) return true;
  if (thread.companyId && canManageBusinessTreasury(user, { companyId: thread.companyId })) return true;
  return false;
}

function canSendAsApplicant(user: AltaUser, thread: ThreadRecord): boolean {
  if (thread.status === "CLOSED") return false;
  if (thread.applicantUserId === user.id) return true;
  if (thread.companyId && canManageBusinessTreasury(user, { companyId: thread.companyId })) return true;
  return false;
}

function parseAttachments(value: Prisma.JsonValue | null): AltaCardThreadAttachment[] {
  if (!value || !Array.isArray(value)) return [];
  return value.filter((item): item is AltaCardThreadAttachment => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    if (typeof row.type !== "string") return false;
    if (row.type === "LINK") return typeof row.url === "string";
    return (
      typeof row.url === "string" ||
      (typeof row.storageKey === "string" && typeof row.downloadPath === "string")
    );
  });
}

function mapMessageRow(
  msg: Prisma.AltaCardApplicationThreadMessageGetPayload<{
    include: { sender: { select: { discordUsername: true; discordId: true; discordAvatar: true } } };
  }>,
  audience: ThreadMessageAudience = "customer",
): AltaCardApplicationThreadMessageRow {
  const senderRole = ROLE_FROM_DB[msg.senderRole];
  return {
    id: msg.id,
    senderUserId: msg.senderUserId,
    senderRole,
    senderName:
      msg.senderRole === "SYSTEM"
        ? ALTA_CREDIT_DESK_NAME
        : msg.senderRole === "ALTA_STAFF"
          ? ALTA_CREDIT_DESK_NAME
          : (msg.sender?.discordUsername ?? "Applicant"),
    senderAvatarUrl:
      msg.senderRole === "APPLICANT" && msg.sender
        ? discordAvatarUrl(msg.sender.discordId, msg.sender.discordAvatar)
        : null,
    body: sanitizeThreadMessageBodyForAudience(msg.body, senderRole, audience),
    attachments: parseAttachments(msg.attachments),
    source: sourceCodeFromDb(msg.source),
    createdAt: msg.createdAt.toISOString(),
    createdAtLabel: formatActivityDateTime(msg.createdAt),
  };
}

function mapThreadContext(
  thread: ThreadRecord,
  user: AltaUser,
  variant: "user" | "internal",
): AltaCardApplicationThreadContext {
  const app = thread.application;
  const status = STATUS_FROM_DB[thread.status];
  const labels = variant === "internal" ? ALTA_CARD_THREAD_STATUS_LABELS_INTERNAL : ALTA_CARD_THREAD_STATUS_LABELS;
  const appStatus = toAltaCardApplicationStatusCode(app.status);

  return {
    threadId: thread.id,
    applicationId: thread.applicationId,
    viewerUserId: user.id,
    status,
    statusLabel: labels[status],
    assignedStaffId: null,
    assignedStaffName: null,
    canSend: isStaff(user) ? thread.status !== "CLOSED" : canSendAsApplicant(user, thread),
    applicantName: app.applicant.discordUsername,
    applicantAvatarUrl: discordAvatarUrl(app.applicant.discordId, app.applicant.discordAvatar),
    companyName: app.company?.name ?? null,
    cardTypeLabel: toAltaCardTypeCode(app.cardType) === "personal" ? "Personal" : "Business",
    requestedTierLabel: ALTA_CARD_TIER_LABELS[toAltaCardTierCode(app.requestedTier)],
    requestedLimit: app.requestedLimit ? Number(app.requestedLimit) : null,
    applicationStatus: appStatus,
    applicationStatusLabel: appStatus.replaceAll("_", " "),
    submittedAt: app.createdAt.toISOString(),
    submittedAtLabel: formatActivityDateTime(app.createdAt),
  };
}

async function getThreadByApplicationId(applicationId: string): Promise<ThreadRecord> {
  const thread = await prisma.altaCardApplicationThread.findUnique({
    where: { applicationId },
    include: threadInclude,
  });
  if (!thread) notFound();
  return thread;
}

async function assertThreadAccess(userId: string, applicationId: string): Promise<{
  user: AltaUser;
  thread: ThreadRecord;
}> {
  const [user, thread] = await Promise.all([getAltaUser(userId), getThreadByApplicationId(applicationId)]);
  if (!canViewThread(user, thread)) forbidden();
  return { user, thread };
}

export async function ensureThreadExists(userId: string, applicationId: string): Promise<void> {
  const existing = await prisma.altaCardApplicationThread.findUnique({
    where: { applicationId },
    select: { id: true },
  });
  if (existing) return;

  const application = await prisma.altaCardApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) notFound();

  const user = await getAltaUser(userId);
  const allowed =
    isStaff(user) ||
    application.applicantUserId === userId ||
    (application.companyId != null && canManageBusinessTreasury(user, { companyId: application.companyId }));
  if (!allowed) forbidden();

  await createThreadForAltaCardApplication(userId, applicationId);
}

export async function createThreadForAltaCardApplication(
  actorUserId: string,
  applicationId: string,
  systemMessage = ALTA_CARD_APPLICATION_THREAD_WELCOME_MESSAGE,
): Promise<{ threadId: string; applicationId: string }> {
  const application = await prisma.altaCardApplication.findUnique({ where: { id: applicationId } });
  if (!application) notFound();

  const existing = await prisma.altaCardApplicationThread.findUnique({
    where: { applicationId },
    select: { id: true, applicationId: true },
  });
  if (existing) {
    return { threadId: existing.id, applicationId: existing.applicationId };
  }

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.altaCardApplicationThread.create({
      data: {
        applicationId: application.id,
        applicantUserId: application.applicantUserId,
        companyId: application.companyId,
        status: "WAITING_ON_ALTA",
      },
    });

    await tx.altaCardApplicationThreadMessage.create({
      data: {
        threadId: created.id,
        senderRole: "SYSTEM",
        source: "SYSTEM",
        body: systemMessage,
      },
    });

    return created;
  });

  void notifyCustomerDealRoomOpenedBestEffort({
    dealRoomType: "ALTA_CARD_APPLICATION",
    dealRoomId: application.id,
    threadId: thread.id,
    applicantUserId: application.applicantUserId,
    welcomeBody: systemMessage,
    context: await resolveDealRoomContextForStaffMessage("ALTA_CARD_APPLICATION", application.id),
  });

  return { threadId: thread.id, applicationId: application.id };
}

export async function postAltaCardApplicationSystemMessage(
  applicationId: string,
  body: string,
  closeThread = false,
): Promise<void> {
  const thread = await prisma.altaCardApplicationThread.findUnique({ where: { applicationId } });
  if (!thread) return;

  await prisma.$transaction(async (tx) => {
    await tx.altaCardApplicationThreadMessage.create({
      data: { threadId: thread.id, senderRole: "SYSTEM", source: "SYSTEM", body },
    });
    if (closeThread) {
      await tx.altaCardApplicationThread.update({
        where: { id: thread.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await closeDiscordSessionsForDealRoom("ALTA_CARD_APPLICATION", applicationId);
    }
  });
}

export async function getAltaCardThreadContext(
  userId: string,
  applicationId: string,
  variant: "user" | "internal",
): Promise<AltaCardApplicationThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, applicationId);
  return mapThreadContext(thread, user, variant);
}

export async function getAltaCardThreadMessages(
  userId: string,
  applicationId: string,
  audience: ThreadMessageAudience = "customer",
): Promise<AltaCardApplicationThreadMessageRow[]> {
  await assertThreadAccess(userId, applicationId);
  const thread = await getThreadByApplicationId(applicationId);

  const messages = await prisma.altaCardApplicationThreadMessage.findMany({
    where: { threadId: thread.id, deletedAt: null },
    include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((msg) =>
    enrichLegacyThreadMessage(mapMessageRow(msg, audience), { applicantUserId: thread.applicantUserId }),
  );
}

export async function sendAltaCardThreadMessage(
  userId: string,
  input: SendAltaCardThreadMessageInput,
  as: "applicant" | "staff",
): Promise<AltaCardApplicationThreadMessageRow> {
  const { user, thread } = await assertThreadAccess(userId, input.applicationId);

  const body = input.body?.trim() || null;
  const attachments = input.attachments ?? [];
  if (!body && attachments.length === 0) badRequest("Message body or attachment is required.");

  if (as === "staff") {
    if (!isStaff(user)) forbidden();
    if (thread.status === "CLOSED") badRequest("This secure deal room is closed.");
  } else {
    if (!canSendAsApplicant(user, thread)) forbidden();
  }

  const senderRole: DbSenderRole = as === "staff" ? "ALTA_STAFF" : "APPLICANT";
  const nextStatus: DbThreadStatus = as === "staff" ? "WAITING_ON_APPLICANT" : "WAITING_ON_ALTA";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.altaCardApplicationThreadMessage.create({
      data: {
        threadId: thread.id,
        senderUserId: userId,
        senderRole,
        source: "WEBSITE",
        body,
        attachments: attachments.length ? attachments : undefined,
      },
      include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    });

    if (thread.status !== "CLOSED") {
      await tx.altaCardApplicationThread.update({
        where: { id: thread.id },
        data: { status: nextStatus },
      });
    }

    return created;
  });

  await writeAuditLog({
    actorUserId: userId,
    action: "ALTA_CARD_APPLICATION_MESSAGE_SENT",
    entityType: "ALTA_CARD",
    entityId: input.applicationId,
    description: "Alta Card application thread message sent",
    metadata: {
      applicationId: input.applicationId,
      threadId: thread.id,
      senderRole,
      actorUserId: userId,
    },
  });

  if (as === "staff") {
    void notifyStaffDealRoomMessageBestEffort({
      dealRoomType: "ALTA_CARD_APPLICATION",
      dealRoomId: input.applicationId,
      threadId: thread.id,
      applicantUserId: thread.applicantUserId,
      staffUserId: userId,
      staffDisplayName: user.discordUsername,
      messageId: message.id,
      messageBody: body,
      context: await resolveDealRoomContextForStaffMessage("ALTA_CARD_APPLICATION", input.applicationId),
    });
  }

  void syncWebsiteMessageToDiscordBestEffort({
    dealRoomType: "ALTA_CARD_APPLICATION",
    dealRoomId: input.applicationId,
    threadId: thread.id,
    messageId: message.id,
    messageBody: body,
    senderUserId: userId,
    senderDisplayName: user.discordUsername,
    senderRole: as === "staff" ? "ALTA_STAFF" : "APPLICANT",
    context: await resolveDealRoomContextForStaffMessage("ALTA_CARD_APPLICATION", input.applicationId),
  });

  return mapMessageRow(message);
}

export async function updateAltaCardThreadStatus(
  staffUserId: string,
  input: UpdateAltaCardThreadStatusInput,
): Promise<AltaCardApplicationThreadContext> {
  const user = await getAltaUser(staffUserId);
  if (!isStaff(user)) forbidden();

  const thread = await getThreadByApplicationId(input.applicationId);
  const updated = await prisma.altaCardApplicationThread.update({
    where: { id: thread.id },
    data: {
      status: STATUS_TO_DB[input.status],
      closedAt: input.status === "closed" ? new Date() : null,
    },
    include: threadInclude,
  });

  if (input.status === "closed") {
    await closeDiscordSessionsForDealRoom("ALTA_CARD_APPLICATION", input.applicationId);
  }

  return mapThreadContext(updated, user, "internal");
}

/** @deprecated V1 threads are not staff-assigned. Returns current context without changes. */
export async function assignAltaCardThreadStaff(
  staffUserId: string,
  input: AssignAltaCardThreadStaffInput,
): Promise<AltaCardApplicationThreadContext> {
  const user = await getAltaUser(staffUserId);
  if (!isStaff(user)) forbidden();

  const thread = await getThreadByApplicationId(input.applicationId);
  return mapThreadContext(thread, user, "internal");
}

export async function closeAltaCardApplicationThread(
  staffUserId: string,
  applicationId: string,
): Promise<AltaCardApplicationThreadContext> {
  return updateAltaCardThreadStatus(staffUserId, { applicationId, status: "closed" });
}

export async function reopenAltaCardApplicationThread(
  staffUserId: string,
  applicationId: string,
): Promise<AltaCardApplicationThreadContext> {
  const user = await getAltaUser(staffUserId);
  if (!isStaff(user)) forbidden();

  const thread = await getThreadByApplicationId(applicationId);
  const updated = await prisma.altaCardApplicationThread.update({
    where: { id: thread.id },
    data: { status: "WAITING_ON_ALTA", closedAt: null },
    include: threadInclude,
  });

  await writeAuditLog({
    actorUserId: staffUserId,
    action: "ALTA_CARD_APPLICATION_THREAD_REOPENED",
    entityType: "ALTA_CARD",
    entityId: applicationId,
    description: "Alta Card application thread reopened",
    metadata: { applicationId, threadId: thread.id },
  });

  return mapThreadContext(updated, user, "internal");
}

export async function assertAltaCardThreadAccessForUpload(
  userId: string,
  applicationId: string,
): Promise<{ user: AltaUser; thread: ThreadRecord }> {
  const { user, thread } = await assertThreadAccess(userId, applicationId);
  assertSecureThreadUploadAccess({
    user,
    isStaff,
    threadClosed: thread.status === "CLOSED",
    canSendAsApplicant: canSendAsApplicant(user, thread),
    closedMessage: SECURE_THREAD_CLOSED_UPLOAD_MESSAGES.application,
  });
  return { user, thread };
}

/** View/download attachments on open or closed threads. */
export async function assertAltaCardThreadAccessForDownload(
  userId: string,
  applicationId: string,
): Promise<{ user: AltaUser; thread: ThreadRecord }> {
  return assertThreadAccess(userId, applicationId);
}

const APPROVAL_TERMS_NEEDLE = "Approved terms:";

const LEGACY_ALTA_CARD_APPROVAL_PREFIXES = [
  "Your Alta Card application has been approved",
  "Your Alta Card application has been accepted",
] as const;

export function altaCardApplicationApprovalMessageNeedsTermsBackfill(
  body: string | null | undefined,
): boolean {
  const trimmed = body?.trim();
  if (!trimmed) return false;
  if (trimmed.includes(APPROVAL_TERMS_NEEDLE)) return false;
  return LEGACY_ALTA_CARD_APPROVAL_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/** Rewrite legacy Alta Card application approval SYSTEM messages with approved terms. */
export async function backfillAltaCardApplicationApprovalMessages(): Promise<{
  updated: number;
  skipped: number;
}> {
  const messages = await prisma.altaCardApplicationThreadMessage.findMany({
    where: {
      senderRole: "SYSTEM",
      deletedAt: null,
      OR: LEGACY_ALTA_CARD_APPROVAL_PREFIXES.map((prefix) => ({
        body: { startsWith: prefix },
      })),
      thread: { application: { status: "APPROVED" } },
    },
    select: {
      id: true,
      body: true,
      thread: {
        select: {
          application: {
            select: {
              approvedTier: true,
              approvedLimit: true,
              approvedInterestRate: true,
              reviewNote: true,
            },
          },
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const message of messages) {
    if (!altaCardApplicationApprovalMessageNeedsTermsBackfill(message.body)) continue;

    const application = message.thread.application;
    if (
      !application.approvedTier ||
      application.approvedLimit == null ||
      application.approvedInterestRate == null
    ) {
      skipped += 1;
      continue;
    }

    const body = buildAltaCardApplicationAcceptedSystemMessage({
      tier: toAltaCardTierCode(application.approvedTier),
      approvedLimit: Number(application.approvedLimit.toString()),
      interestRate: Number(application.approvedInterestRate.toString()),
      reviewNote: application.reviewNote,
    });

    await prisma.altaCardApplicationThreadMessage.update({
      where: { id: message.id },
      data: { body },
    });
    updated += 1;
  }

  return { updated, skipped };
}
