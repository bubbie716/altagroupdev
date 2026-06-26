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
  THREAD_STATUS_LABELS,
  THREAD_STATUS_LABELS_INTERNAL,
} from "@/lib/bank/loan-application-thread-types";
import { LOAN_PRODUCT_LABELS } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fromDbLoanProductType } from "@/server/lending-mapper";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

const INITIAL_SYSTEM_MESSAGE =
  "Your application has been received. Alta Credit Desk may reply here if more information is needed.";

const ALTA_CREDIT_DESK_NAME = "Alta Credit Desk";

export function buildApplicationApprovedSystemMessage(reviewNote?: string | null): string {
  const lines = [
    "Your credit application has been approved by Alta Credit Desk.",
    "This conversation is now closed. Your approved facility will proceed through Alta Bank.",
  ];
  const note = reviewNote?.trim();
  if (note) lines.push("", `Note from Alta Credit Desk: ${note}`);
  return lines.join("\n");
}

export function buildApplicationDeniedSystemMessage(reviewNote?: string | null): string {
  const lines = [
    "Your credit application has been denied by Alta Credit Desk.",
    "This conversation is now closed.",
  ];
  const note = reviewNote?.trim();
  if (note) lines.push("", `Note from Alta Credit Desk: ${note}`);
  return lines.join("\n");
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
  assignedStaff: { select: { id: true, discordUsername: true } },
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
    return typeof row.url === "string" && typeof row.type === "string";
  });
}

function mapMessageRow(
  msg: Prisma.LoanApplicationThreadMessageGetPayload<{
    include: { sender: { select: { discordUsername: true; discordId: true; discordAvatar: true } } };
  }>,
): LoanApplicationThreadMessageRow {
  return {
    id: msg.id,
    senderUserId: msg.senderUserId,
    senderRole: ROLE_FROM_DB[msg.senderRole],
    senderName:
      msg.senderRole === "SYSTEM"
        ? ALTA_CREDIT_DESK_NAME
        : msg.senderRole === "ALTA_STAFF"
          ? "Loan Officer"
          : (msg.sender?.discordUsername ?? "Applicant"),
    senderAvatarUrl:
      msg.senderRole === "APPLICANT" && msg.sender
        ? discordAvatarUrl(msg.sender.discordId, msg.sender.discordAvatar)
        : null,
    body: msg.body,
    attachments: parseAttachments(msg.attachments),
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
    assignedStaffId: thread.assignedStaffId,
    assignedStaffName: thread.assignedStaff?.discordUsername ?? null,
    canSend: isStaff(user)
      ? thread.status !== "CLOSED"
      : canSendAsApplicant(user, thread),
    applicantName: app.applicantUser.discordUsername,
    applicantAvatarUrl: discordAvatarUrl(
      app.applicantUser.discordId,
      app.applicantUser.discordAvatar,
    ),
    companyName: app.company?.name ?? null,
    productLabel: LOAN_PRODUCT_LABELS[productType],
    requestedAmount: Number(app.requestedAmount),
    applicationStatus: app.status.toLowerCase(),
    applicationStatusLabel: app.status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
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

  // TODO: Discord notification to staff when new application thread opens.

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
): Promise<LoanApplicationThreadMessageRow[]> {
  await assertThreadAccess(userId, applicationId);
  const thread = await getThreadByApplicationId(applicationId);

  const messages = await prisma.loanApplicationThreadMessage.findMany({
    where: { threadId: thread.id, deletedAt: null },
    include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    orderBy: { createdAt: "asc" },
  });

  return messages.map(mapMessageRow);
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
        senderUserId: senderRole === "SYSTEM" ? null : userId,
        senderRole,
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

  // TODO: Discord notification to applicant when Alta staff replies.
  // TODO: Discord/internal notification to staff when applicant replies.

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

export async function assignThreadStaff(
  actorUserId: string,
  input: AssignThreadStaffInput,
): Promise<LoanApplicationThreadContext> {
  const actor = await getAltaUser(actorUserId);
  if (!isStaff(actor)) forbidden();

  const thread = await getThreadByApplicationId(input.applicationId);

  if (input.staffUserId) {
    const staffUser = await prisma.user.findUnique({ where: { id: input.staffUserId } });
    if (!staffUser) badRequest("Staff user not found.");
  }

  const updated = await prisma.loanApplicationThread.update({
    where: { id: thread.id },
    data: { assignedStaffId: input.staffUserId },
    include: threadInclude,
  });

  await writeAuditLog({
    actorUserId,
    action: "LOAN_THREAD_ASSIGNED",
    entityType: "LOAN_APPLICATION",
    entityId: thread.loanApplicationId,
    description: input.staffUserId
      ? `Staff assigned to application thread.`
      : `Staff unassigned from application thread.`,
    metadata: { threadId: thread.id, staffUserId: input.staffUserId },
  });

  return mapThreadContext(updated, actor, "internal");
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
    description: `Application thread reopened.`,
  });

  return mapThreadContext(updated, actor, "internal");
}

export async function listThreadStaffOptions(): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { tags: { some: { tag: { in: ["ADMIN", "OPERATOR"] } } } },
    select: { id: true, discordUsername: true },
    orderBy: { discordUsername: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.discordUsername }));
}

export async function ensureThreadForApplication(
  actorUserId: string,
  applicationId: string,
): Promise<{ threadId: string; applicationId: string }> {
  const actor = await getAltaUser(actorUserId);
  if (!canAccessInternal(actor)) forbidden();
  return createThreadForLoanApplication(actorUserId, applicationId);
}

export async function assertThreadAccessForUpload(userId: string, applicationId: string): Promise<void> {
  const { user, thread } = await assertThreadAccess(userId, applicationId);
  if (isStaff(user)) {
    if (thread.status === "CLOSED") badRequest("Thread is closed.");
    return;
  }
  if (!canSendAsApplicant(user, thread)) forbidden();
}
