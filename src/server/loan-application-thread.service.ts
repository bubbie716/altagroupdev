import type {
  LoanApplicationThreadSenderRole as DbSenderRole,
  LoanApplicationThreadStatus as DbThreadStatus,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessInternal,
  canManageBusinessTreasury,
  canViewCompanyDealRoom,
  isAdmin,
  isOperator,
} from "@/lib/auth/permissions";
import type {
  AssignThreadStaffInput,
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
  LoanApplicationThreadStatusCode,
  SendThreadMessageInput,
  ThreadAttachment,
  ThreadSenderRoleCode,
  UpdateThreadStatusInput,
} from "@/lib/bank/loan-application-thread-types";
import {
  buildLendingApplicationAcceptedSystemMessage,
  buildLendingApplicationDeniedSystemMessage,
  LENDING_THREAD_WELCOME_MESSAGE,
} from "@/lib/bank/secure-deal-room-system-copy";
import { applicationListStatusLabel, THREAD_STATUS_LABELS, THREAD_STATUS_LABELS_INTERNAL } from "@/lib/bank/loan-application-thread-types";
import { LOAN_PRODUCT_LABELS } from "@/lib/bank/lending-types";
import { sourceCodeFromDb } from "@/lib/bank/secure-deal-room-discord-types";
import type { ThreadMessageAudience } from "@/lib/bank/thread-message-utils";
import { enrichLegacyThreadMessage, sanitizeThreadMessageBodyForAudience } from "@/lib/bank/thread-message-utils";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fromDbLoanProductType } from "@/server/lending-mapper";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  assertSecureThreadUploadAccess,
  SECURE_THREAD_CLOSED_UPLOAD_MESSAGES,
} from "@/server/secure-thread-attachment-access";
import {
  closeDiscordSessionsForDealRoom,
  notifyCustomerDealRoomOpenedBestEffort,
  notifyStaffDealRoomMessageBestEffort,
  resyncDealRoomDiscordOnReopenBestEffort,
  resolveDealRoomContextForStaffMessage,
  syncWebsiteMessageToDiscordBestEffort,
} from "@/server/secure-deal-room-discord.service";

const INITIAL_SYSTEM_MESSAGE = LENDING_THREAD_WELCOME_MESSAGE;

const ALTA_CREDIT_DESK_NAME = "Alta Credit Desk";

export function buildApplicationApprovedSystemMessage(reviewNote?: string | null): string {
  return buildLendingApplicationAcceptedSystemMessage(reviewNote);
}

export function buildApplicationDeniedSystemMessage(reviewNote?: string | null): string {
  return buildLendingApplicationDeniedSystemMessage(reviewNote);
}

const STATUS_FROM_DB: Record<DbThreadStatus, LoanApplicationThreadStatusCode> = {
  OPEN: "open",
  WAITING_ON_APPLICANT: "waiting_on_applicant",
  WAITING_ON_ALTA: "waiting_on_alta",
  CLOSED: "closed",
};

const STATUS_TO_DB: Record<LoanApplicationThreadStatusCode, DbThreadStatus> = {
  open: "OPEN",
  waiting_on_applicant: "WAITING_ON_APPLICANT",
  waiting_on_alta: "WAITING_ON_ALTA",
  closed: "CLOSED",
};

const ROLE_FROM_DB: Record<DbSenderRole, ThreadSenderRoleCode> = {
  APPLICANT: "applicant",
  ALTA_STAFF: "alta_staff",
  SYSTEM: "system",
};

const threadInclude = {
  loanApplication: {
    include: {
      applicantUser: { select: { discordUsername: true, discordId: true, discordAvatar: true } },
      company: { select: { name: true } },
    },
  },
} satisfies Prisma.LoanApplicationThreadInclude;

function discordAvatarUrl(discordId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}

type ThreadRecord = Prisma.LoanApplicationThreadGetPayload<{ include: typeof threadInclude }>;

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function isStaff(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

function canViewThread(user: AltaUser, thread: ThreadRecord): boolean {
  if (isStaff(user)) return true;
  if (thread.applicantUserId === user.id) return true;
  if (thread.companyId && canViewCompanyDealRoom(user, thread.companyId)) return true;
  return false;
}

function canSendAsApplicant(user: AltaUser, thread: ThreadRecord): boolean {
  if (thread.status === "CLOSED") return false;
  if (thread.applicantUserId === user.id) return true;
  if (thread.companyId && canManageBusinessTreasury(user, { companyId: thread.companyId })) return true;
  return false;
}

function parseAttachments(value: Prisma.JsonValue | null): ThreadAttachment[] {
  if (!value || !Array.isArray(value)) return [];
  return value.filter((item): item is ThreadAttachment => {
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
  msg: Prisma.LoanApplicationThreadMessageGetPayload<{
    include: { sender: { select: { discordUsername: true; discordId: true; discordAvatar: true } } };
  }>,
  audience: ThreadMessageAudience = "customer",
): LoanApplicationThreadMessageRow {
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
): LoanApplicationThreadContext {
  const app = thread.loanApplication;
  const productType = fromDbLoanProductType(app.productType);
  const status = STATUS_FROM_DB[thread.status];
  const labels = variant === "internal" ? THREAD_STATUS_LABELS_INTERNAL : THREAD_STATUS_LABELS;

  return {
    threadId: thread.id,
    applicationId: thread.loanApplicationId,
    viewerUserId: user.id,
    status,
    statusLabel: labels[status],
    assignedStaffId: null,
    assignedStaffName: null,
    canSend: isStaff(user)
      ? thread.status !== "CLOSED"
      : canSendAsApplicant(user, thread),
    applicantUserId: app.applicantUserId,
    applicantName: app.applicantUser.discordUsername,
    applicantAvatarUrl: discordAvatarUrl(
      app.applicantUser.discordId,
      app.applicantUser.discordAvatar,
    ),
    companyId: app.companyId,
    companyName: app.company?.name ?? null,
    productLabel: LOAN_PRODUCT_LABELS[productType],
    requestedAmount: Number(app.requestedAmount),
    applicationStatus: app.status.toLowerCase(),
    applicationStatusLabel: applicationListStatusLabel(
      {
        status: app.status.toLowerCase(),
        statusLabel: app.status,
        threadStatus: STATUS_FROM_DB[thread.status],
      },
      variant,
    ),
    submittedAt: app.createdAt.toISOString(),
    submittedAtLabel: formatActivityDateTime(app.createdAt),
  };
}

async function getThreadByApplicationId(applicationId: string): Promise<ThreadRecord> {
  const thread = await prisma.loanApplicationThread.findUnique({
    where: { loanApplicationId: applicationId },
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

export async function createThreadForLoanApplication(
  actorUserId: string,
  loanApplicationId: string,
): Promise<{ threadId: string; applicationId: string }> {
  const application = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
  });
  if (!application) notFound();

  const existing = await prisma.loanApplicationThread.findUnique({
    where: { loanApplicationId },
    select: { id: true, loanApplicationId: true },
  });
  if (existing) {
    return { threadId: existing.id, applicationId: existing.loanApplicationId };
  }

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.loanApplicationThread.create({
      data: {
        loanApplicationId: application.id,
        applicantUserId: application.applicantUserId,
        companyId: application.companyId,
        status: "WAITING_ON_ALTA",
      },
    });

    await tx.loanApplicationThreadMessage.create({
      data: {
        threadId: created.id,
        senderRole: "SYSTEM",
        source: "SYSTEM",
        body: INITIAL_SYSTEM_MESSAGE,
      },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_CREATED",
    entityType: "LOAN_APPLICATION",
    entityId: application.id,
    targetUserId: application.applicantUserId,
    targetCompanyId: application.companyId ?? undefined,
    description: `Application thread opened for loan application ${application.id}.`,
    metadata: { threadId: thread.id },
  });

  void notifyCustomerDealRoomOpenedBestEffort({
    dealRoomType: "LOAN_APPLICATION",
    dealRoomId: application.id,
    threadId: thread.id,
    applicantUserId: application.applicantUserId,
    welcomeBody: INITIAL_SYSTEM_MESSAGE,
    context: await resolveDealRoomContextForStaffMessage("LOAN_APPLICATION", application.id),
  });

  return { threadId: thread.id, applicationId: application.id };
}

export async function ensureThreadExists(userId: string, applicationId: string): Promise<void> {
  const existing = await prisma.loanApplicationThread.findUnique({
    where: { loanApplicationId: applicationId },
    select: { id: true },
  });
  if (existing) return;

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) notFound();

  const user = await getAltaUser(userId);
  const allowed =
    isStaff(user) ||
    application.applicantUserId === userId ||
    (application.companyId != null && canViewCompanyDealRoom(user, application.companyId));
  if (!allowed) forbidden();

  await createThreadForLoanApplication(userId, applicationId);
}

export async function getThreadContext(
  userId: string,
  applicationId: string,
  variant: "user" | "internal",
): Promise<LoanApplicationThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, applicationId);
  return mapThreadContext(thread, user, variant);
}

export async function getThreadMessages(
  userId: string,
  applicationId: string,
  audience: ThreadMessageAudience = "customer",
): Promise<LoanApplicationThreadMessageRow[]> {
  await assertThreadAccess(userId, applicationId);
  const thread = await getThreadByApplicationId(applicationId);

  const messages = await prisma.loanApplicationThreadMessage.findMany({
    where: { threadId: thread.id, deletedAt: null },
    include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((msg) =>
    enrichLegacyThreadMessage(mapMessageRow(msg, audience), { applicantUserId: thread.applicantUserId }),
  );
}

export async function sendThreadMessage(
  userId: string,
  input: SendThreadMessageInput,
  as: "applicant" | "staff",
): Promise<LoanApplicationThreadMessageRow> {
  const { user, thread } = await assertThreadAccess(userId, input.applicationId);

  const body = input.body?.trim() || null;
  const attachments = input.attachments ?? [];
  if (!body && attachments.length === 0) badRequest("Message body or attachment is required.");

  if (as === "staff") {
    if (!isStaff(user)) forbidden();
    if (thread.status === "CLOSED") badRequest("Thread is closed. Reopen before replying.");
  } else {
    if (thread.status === "CLOSED") badRequest("Thread is closed.");
    if (!canSendAsApplicant(user, thread)) forbidden();
  }

  const senderRole: DbSenderRole = as === "staff" ? "ALTA_STAFF" : "APPLICANT";
  const nextStatus: DbThreadStatus = as === "staff" ? "WAITING_ON_APPLICANT" : "WAITING_ON_ALTA";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.loanApplicationThreadMessage.create({
      data: {
        threadId: thread.id,
        senderUserId: userId,
        senderRole,
        source: "WEBSITE",
        body,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    });

    await tx.loanApplicationThread.update({
      where: { id: thread.id },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: userId,
    action: "LOAN_THREAD_MESSAGE_SENT",
    entityType: "LOAN_APPLICATION",
    entityId: thread.loanApplicationId,
    targetUserId: thread.applicantUserId,
    targetCompanyId: thread.companyId ?? undefined,
    description: `Message sent on application thread ${thread.id}.`,
    metadata: { threadId: thread.id, messageId: message.id, senderRole },
  });

  if (as === "staff") {
    void notifyStaffDealRoomMessageBestEffort({
      dealRoomType: "LOAN_APPLICATION",
      dealRoomId: thread.loanApplicationId,
      threadId: thread.id,
      applicantUserId: thread.applicantUserId,
      staffUserId: userId,
      staffDisplayName: user.discordUsername,
      messageId: message.id,
      messageBody: body,
      context: await resolveDealRoomContextForStaffMessage("LOAN_APPLICATION", thread.loanApplicationId),
    });
  }

  void syncWebsiteMessageToDiscordBestEffort({
    dealRoomType: "LOAN_APPLICATION",
    dealRoomId: thread.loanApplicationId,
    threadId: thread.id,
    messageId: message.id,
    messageBody: body,
    senderUserId: userId,
    senderDisplayName: user.discordUsername,
    senderRole: as === "staff" ? "ALTA_STAFF" : "APPLICANT",
    context: await resolveDealRoomContextForStaffMessage("LOAN_APPLICATION", thread.loanApplicationId),
  });

  return mapMessageRow(message);
}

export async function updateThreadStatus(
  actorUserId: string,
  input: UpdateThreadStatusInput,
): Promise<LoanApplicationThreadContext> {
  const actor = await getAltaUser(actorUserId);
  if (!isStaff(actor)) forbidden();

  const thread = await getThreadByApplicationId(input.applicationId);
  const status = STATUS_TO_DB[input.status];

  const updated = await prisma.loanApplicationThread.update({
    where: { id: thread.id },
    data: {
      status,
      closedAt: status === "CLOSED" ? thread.closedAt ?? new Date() : null,
    },
    include: threadInclude,
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_STATUS_CHANGED",
    entityType: "LOAN_APPLICATION",
    entityId: thread.loanApplicationId,
    targetUserId: thread.applicantUserId,
    targetCompanyId: thread.companyId ?? undefined,
    description: `Thread status changed to ${input.status}.`,
    metadata: { threadId: thread.id, status: input.status },
  });

  return mapThreadContext(updated, actor, "internal");
}

/** @deprecated V1 Secure Deal Rooms are not staff-assigned. Returns current context without changes. */
export async function assignThreadStaff(
  actorUserId: string,
  input: AssignThreadStaffInput,
): Promise<LoanApplicationThreadContext> {
  const actor = await getAltaUser(actorUserId);
  if (!isStaff(actor)) forbidden();

  const thread = await getThreadByApplicationId(input.applicationId);
  return mapThreadContext(thread, actor, "internal");
}

export async function closeThread(
  actorUserId: string,
  applicationId: string,
): Promise<LoanApplicationThreadContext> {
  const actor = await getAltaUser(actorUserId);
  if (!isStaff(actor)) forbidden();

  const thread = await getThreadByApplicationId(applicationId);
  const updated = await prisma.loanApplicationThread.update({
    where: { id: thread.id },
    data: { status: "CLOSED", closedAt: new Date() },
    include: threadInclude,
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_CLOSED",
    entityType: "LOAN_APPLICATION",
    entityId: applicationId,
    targetUserId: thread.applicantUserId,
    targetCompanyId: thread.companyId ?? undefined,
    metadata: { threadId: thread.id },
    description: `Application thread closed.`,
  });

  await closeDiscordSessionsForDealRoom("LOAN_APPLICATION", applicationId);

  return mapThreadContext(updated, actor, "internal");
}

export async function closeThreadForApplicationIfOpen(
  actorUserId: string,
  applicationId: string,
  reason: string,
  systemMessage?: string,
): Promise<void> {
  const thread = await prisma.loanApplicationThread.findUnique({
    where: { loanApplicationId: applicationId },
    select: {
      id: true,
      status: true,
      applicantUserId: true,
      companyId: true,
    },
  });
  if (!thread || thread.status === "CLOSED") return;

  await prisma.$transaction(async (tx) => {
    if (systemMessage) {
      await tx.loanApplicationThreadMessage.create({
        data: {
          threadId: thread.id,
          senderRole: "SYSTEM",
          source: "SYSTEM",
          body: systemMessage,
        },
      });
    }

    await tx.loanApplicationThread.update({
      where: { id: thread.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_CLOSED",
    entityType: "LOAN_APPLICATION",
    entityId: applicationId,
    targetUserId: thread.applicantUserId,
    targetCompanyId: thread.companyId ?? undefined,
    metadata: { threadId: thread.id, reason },
    description: reason,
  });

  await closeDiscordSessionsForDealRoom("LOAN_APPLICATION", applicationId);
}

export async function reopenThread(
  actorUserId: string,
  applicationId: string,
): Promise<LoanApplicationThreadContext> {
  const actor = await getAltaUser(actorUserId);
  if (!isStaff(actor)) forbidden();

  const thread = await getThreadByApplicationId(applicationId);

  const updated = await prisma.loanApplicationThread.update({
    where: { id: thread.id },
    data: { status: "WAITING_ON_ALTA", closedAt: null },
    include: threadInclude,
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_REOPENED",
    entityType: "LOAN_APPLICATION",
    entityId: applicationId,
    metadata: { threadId: thread.id },
    description: `Secure Deal Room reopened.`,
  });

  void resyncDealRoomDiscordOnReopenBestEffort({
    dealRoomType: "LOAN_APPLICATION",
    dealRoomId: applicationId,
    threadId: thread.id,
    applicantUserId: thread.applicantUserId,
    welcomeBody: "Your loan application Secure Deal Room has been reopened.",
    context: await resolveDealRoomContextForStaffMessage("LOAN_APPLICATION", applicationId),
  });

  return mapThreadContext(updated, actor, "internal");
}

export async function ensureThreadForApplication(
  actorUserId: string,
  applicationId: string,
): Promise<{ threadId: string; applicationId: string }> {
  const actor = await getAltaUser(actorUserId);
  if (!canAccessInternal(actor)) forbidden();
  return createThreadForLoanApplication(actorUserId, applicationId);
}

export async function assertThreadAccessForUpload(
  userId: string,
  applicationId: string,
): Promise<ThreadRecord> {
  const { user, thread } = await assertThreadAccess(userId, applicationId);
  assertSecureThreadUploadAccess({
    user,
    isStaff,
    threadClosed: thread.status === "CLOSED",
    canSendAsApplicant: canSendAsApplicant(user, thread),
    closedMessage: SECURE_THREAD_CLOSED_UPLOAD_MESSAGES.loan,
  });
  return thread;
}

/** View/download attachments on open or closed threads. */
export async function assertThreadAccessForDownload(
  userId: string,
  applicationId: string,
): Promise<ThreadRecord> {
  const { thread } = await assertThreadAccess(userId, applicationId);
  return thread;
}
