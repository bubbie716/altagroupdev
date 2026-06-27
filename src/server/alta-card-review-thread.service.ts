import type {
  AltaCardApplicationThreadSenderRole as DbSenderRole,
  AltaCardApplicationThreadStatus as DbThreadStatus,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { ALTA_CARD_REVIEW_THREAD_WELCOME_MESSAGE } from "@/lib/bank/secure-deal-room-system-copy";
import {
  canManageBusinessTreasury,
  isAdmin,
  isOperator,
} from "@/lib/auth/permissions";
import type {
  AltaCardReviewThreadContext,
  AltaCardReviewThreadMessageRow,
  AltaCardReviewThreadStatusCode,
  AltaCardReviewThreadSenderRoleCode,
  AssignAltaCardReviewThreadStaffInput,
  SendAltaCardReviewThreadMessageInput,
  UpdateAltaCardReviewThreadStatusInput,
} from "@/lib/bank/alta-card-review-thread-types";
import {
  ALTA_CARD_REVIEW_THREAD_STATUS_LABELS,
  ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL,
} from "@/lib/bank/alta-card-review-thread-types";
import {
  ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE,
  ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE,
  reviewDisplayStatusLabel,
} from "@/lib/bank/alta-card-review-helpers";
import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { enrichLegacyThreadMessage } from "@/lib/bank/thread-message-utils";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { prisma } from "@/server/db";
import {
  toAltaCardReviewStatusCode,
  toAltaCardTierCode,
  toAltaCardTypeCode,
} from "@/server/alta-card-review-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  assertSecureThreadUploadAccess,
  SECURE_THREAD_CLOSED_UPLOAD_MESSAGES,
} from "@/server/secure-thread-attachment-access";

const ALTA_CREDIT_DESK_NAME = "Alta Credit Desk";

const STATUS_FROM_DB: Record<DbThreadStatus, AltaCardReviewThreadStatusCode> = {
  OPEN: "open",
  WAITING_ON_APPLICANT: "waiting_on_applicant",
  WAITING_ON_ALTA: "waiting_on_alta",
  CLOSED: "closed",
};

const STATUS_TO_DB: Record<AltaCardReviewThreadStatusCode, DbThreadStatus> = {
  open: "OPEN",
  waiting_on_applicant: "WAITING_ON_APPLICANT",
  waiting_on_alta: "WAITING_ON_ALTA",
  closed: "CLOSED",
};

const ROLE_FROM_DB: Record<DbSenderRole, AltaCardReviewThreadSenderRoleCode> = {
  APPLICANT: "applicant",
  ALTA_STAFF: "alta_staff",
  SYSTEM: "system",
};

const threadInclude = {
  reviewRequest: {
    include: {
      applicantUser: { select: { discordUsername: true, discordId: true, discordAvatar: true } },
      company: { select: { name: true } },
      altaCard: { select: { cardType: true, tier: true } },
    },
  },
  assignedStaff: { select: { id: true, discordUsername: true } },
} satisfies Prisma.AltaCardReviewThreadInclude;

type ThreadRecord = Prisma.AltaCardReviewThreadGetPayload<{ include: typeof threadInclude }>;

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
  msg: Prisma.AltaCardReviewThreadMessageGetPayload<{
    include: { sender: { select: { discordUsername: true; discordId: true; discordAvatar: true } } };
  }>,
): AltaCardReviewThreadMessageRow {
  return {
    id: msg.id,
    senderUserId: msg.senderUserId,
    senderRole: ROLE_FROM_DB[msg.senderRole],
    senderName:
      msg.senderRole === "SYSTEM"
        ? ALTA_CREDIT_DESK_NAME
        : msg.senderRole === "ALTA_STAFF"
          ? ALTA_CREDIT_DESK_NAME
          : (msg.sender?.discordUsername ?? "Cardholder"),
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
): AltaCardReviewThreadContext {
  const review = thread.reviewRequest;
  const status = STATUS_FROM_DB[thread.status];
  const labels =
    variant === "internal"
      ? ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL
      : ALTA_CARD_REVIEW_THREAD_STATUS_LABELS;
  const reviewStatus = toAltaCardReviewStatusCode(review.status);

  return {
    threadId: thread.id,
    reviewRequestId: thread.reviewRequestId,
    viewerUserId: user.id,
    status,
    statusLabel: labels[status],
    assignedStaffId: null,
    assignedStaffName: null,
    canSend: isStaff(user) ? thread.status !== "CLOSED" : canSendAsApplicant(user, thread),
    applicantName: review.applicantUser.discordUsername,
    applicantAvatarUrl: discordAvatarUrl(
      review.applicantUser.discordId,
      review.applicantUser.discordAvatar,
    ),
    companyName: review.company?.name ?? null,
    cardTypeLabel:
      toAltaCardTypeCode(review.altaCard.cardType) === "personal" ? "Personal" : "Business",
    currentTierLabel: ALTA_CARD_TIER_LABELS[toAltaCardTierCode(review.altaCard.tier)],
    reviewStatus,
    reviewStatusLabel: reviewDisplayStatusLabel(
      { status: reviewStatus, threadStatus: status },
      variant,
    ),
    submittedAt: review.createdAt.toISOString(),
    submittedAtLabel: formatActivityDateTime(review.createdAt),
  };
}

async function getThreadByReviewRequestId(reviewRequestId: string): Promise<ThreadRecord> {
  const thread = await prisma.altaCardReviewThread.findUnique({
    where: { reviewRequestId },
    include: threadInclude,
  });
  if (!thread) notFound();
  return thread;
}

async function assertThreadAccess(
  userId: string,
  reviewRequestId: string,
): Promise<{ user: AltaUser; thread: ThreadRecord }> {
  const [user, thread] = await Promise.all([
    getAltaUser(userId),
    getThreadByReviewRequestId(reviewRequestId),
  ]);
  if (!canViewThread(user, thread)) forbidden();
  return { user, thread };
}

export async function createThreadForReviewRequest(
  actorUserId: string,
  reviewRequestId: string,
  systemMessage = ALTA_CARD_REVIEW_THREAD_WELCOME_MESSAGE,
): Promise<{ threadId: string; reviewRequestId: string }> {
  const review = await prisma.altaCardReviewRequest.findUnique({ where: { id: reviewRequestId } });
  if (!review) notFound();

  const existing = await prisma.altaCardReviewThread.findUnique({
    where: { reviewRequestId },
    select: { id: true, reviewRequestId: true },
  });
  if (existing) return { threadId: existing.id, reviewRequestId: existing.reviewRequestId };

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.altaCardReviewThread.create({
      data: {
        reviewRequestId: review.id,
        applicantUserId: review.applicantUserId,
        companyId: review.companyId,
        status: "WAITING_ON_ALTA",
      },
    });

    await tx.altaCardReviewThreadMessage.create({
      data: { threadId: created.id, senderRole: "SYSTEM", body: systemMessage },
    });

    return created;
  });

  return { threadId: thread.id, reviewRequestId: review.id };
}

export async function ensureReviewThreadExists(
  _actorUserId: string,
  reviewRequestId: string,
  options?: { silent?: boolean },
): Promise<{ threadId: string; reviewRequestId: string }> {
  const existing = await prisma.altaCardReviewThread.findUnique({
    where: { reviewRequestId },
    select: { id: true, reviewRequestId: true },
  });
  if (existing) return existing;

  const review = await prisma.altaCardReviewRequest.findUnique({ where: { id: reviewRequestId } });
  if (!review) notFound();

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.altaCardReviewThread.create({
      data: {
        reviewRequestId: review.id,
        applicantUserId: review.applicantUserId,
        companyId: review.companyId,
        status: options?.silent ? "CLOSED" : "WAITING_ON_ALTA",
        closedAt: options?.silent ? new Date() : null,
      },
    });

    if (!options?.silent) {
      await tx.altaCardReviewThreadMessage.create({
        data: {
          threadId: created.id,
          senderRole: "SYSTEM",
          body: ALTA_CARD_REVIEW_THREAD_WELCOME_MESSAGE,
        },
      });
    }

    return created;
  });

  return { threadId: thread.id, reviewRequestId: thread.reviewRequestId };
}

export async function postReviewSystemMessage(
  reviewRequestId: string,
  body: string,
  closeThread = false,
): Promise<void> {
  const thread = await prisma.altaCardReviewThread.findUnique({ where: { reviewRequestId } });
  if (!thread) return;

  await prisma.$transaction(async (tx) => {
    await tx.altaCardReviewThreadMessage.create({
      data: { threadId: thread.id, senderRole: "SYSTEM", body },
    });
    if (closeThread) {
      await tx.altaCardReviewThread.update({
        where: { id: thread.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }
  });
}

export async function finalizeReviewThreadDecision(
  actorUserId: string,
  reviewRequestId: string,
  body: string,
): Promise<void> {
  await ensureReviewThreadExists(actorUserId, reviewRequestId, { silent: true });
  await postReviewSystemMessage(reviewRequestId, body, true);
}

export async function getReviewThreadContext(
  userId: string,
  reviewRequestId: string,
  variant: "user" | "internal",
): Promise<AltaCardReviewThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, reviewRequestId);
  return mapThreadContext(thread, user, variant);
}

export async function getReviewThreadMessages(
  userId: string,
  reviewRequestId: string,
): Promise<AltaCardReviewThreadMessageRow[]> {
  await assertThreadAccess(userId, reviewRequestId);
  const thread = await getThreadByReviewRequestId(reviewRequestId);

  const messages = await prisma.altaCardReviewThreadMessage.findMany({
    where: { threadId: thread.id, deletedAt: null },
    include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((msg) =>
    enrichLegacyThreadMessage(mapMessageRow(msg), { applicantUserId: thread.applicantUserId }),
  );
}

export async function sendReviewThreadMessage(
  userId: string,
  input: SendAltaCardReviewThreadMessageInput,
  as: "applicant" | "staff",
): Promise<AltaCardReviewThreadMessageRow> {
  const { user, thread } = await assertThreadAccess(userId, input.reviewRequestId);

  const body = input.body?.trim() || null;
  const attachments = input.attachments ?? [];
  if (!body && attachments.length === 0) badRequest("Message body or attachment is required.");

  if (as === "staff") {
    if (!isStaff(user)) forbidden();
    if (thread.status === "CLOSED") badRequest("This secure review thread is closed.");
  } else {
    if (!canSendAsApplicant(user, thread)) forbidden();
  }

  const senderRole: DbSenderRole = as === "staff" ? "ALTA_STAFF" : "APPLICANT";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.altaCardReviewThreadMessage.create({
      data: {
        threadId: thread.id,
        senderUserId: userId,
        senderRole,
        body,
        attachments: attachments.length ? attachments : undefined,
      },
      include: { sender: { select: { discordUsername: true, discordId: true, discordAvatar: true } } },
    });

    if (as === "staff" && thread.reviewRequest.status === "SUBMITTED") {
      await tx.altaCardReviewRequest.update({
        where: { id: thread.reviewRequestId },
        data: { status: "UNDER_REVIEW" },
      });
    }

    return created;
  });

  return mapMessageRow(message);
}

export async function updateReviewThreadStatus(
  userId: string,
  input: UpdateAltaCardReviewThreadStatusInput,
): Promise<AltaCardReviewThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, input.reviewRequestId);
  if (!isStaff(user)) forbidden();

  const updated = await prisma.altaCardReviewThread.update({
    where: { id: thread.id },
    data: {
      status: STATUS_TO_DB[input.status],
      closedAt: input.status === "closed" ? new Date() : null,
    },
    include: threadInclude,
  });

  return mapThreadContext(updated, user, "internal");
}

/** @deprecated V1 review threads are not staff-assigned. Returns current context without changes. */
export async function assignReviewThreadStaff(
  userId: string,
  input: AssignAltaCardReviewThreadStaffInput,
): Promise<AltaCardReviewThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, input.reviewRequestId);
  if (!isStaff(user)) forbidden();

  return mapThreadContext(thread, user, "internal");
}

export async function closeReviewThread(
  userId: string,
  reviewRequestId: string,
): Promise<AltaCardReviewThreadContext> {
  return updateReviewThreadStatus(userId, { reviewRequestId, status: "closed" });
}

export async function reopenReviewThread(
  userId: string,
  reviewRequestId: string,
): Promise<AltaCardReviewThreadContext> {
  const { user, thread } = await assertThreadAccess(userId, reviewRequestId);
  if (!isStaff(user)) forbidden();

  const { isTerminalReviewStatus, toAltaCardReviewStatusCode } = await import(
    "@/server/alta-card-review-mapper"
  );
  const reviewStatus = toAltaCardReviewStatusCode(thread.reviewRequest.status);
  if (isTerminalReviewStatus(reviewStatus)) {
    badRequest("This account review is closed and the secure deal room cannot be reopened.");
  }

  const updated = await prisma.altaCardReviewThread.update({
    where: { id: thread.id },
    data: { status: "WAITING_ON_ALTA", closedAt: null },
    include: threadInclude,
  });

  return mapThreadContext(updated, user, "internal");
}

export async function assertReviewThreadAccessForUpload(
  userId: string,
  reviewRequestId: string,
): Promise<{ user: AltaUser; thread: ThreadRecord }> {
  const { user, thread } = await assertThreadAccess(userId, reviewRequestId);
  assertSecureThreadUploadAccess({
    user,
    isStaff,
    threadClosed: thread.status === "CLOSED",
    canSendAsApplicant: canSendAsApplicant(user, thread),
    closedMessage: SECURE_THREAD_CLOSED_UPLOAD_MESSAGES.review,
  });
  return { user, thread };
}

/** View/download attachments on open or closed threads. */
export async function assertReviewThreadAccessForDownload(
  userId: string,
  reviewRequestId: string,
): Promise<{ user: AltaUser; thread: ThreadRecord }> {
  return assertThreadAccess(userId, reviewRequestId);
}

const CANCELLED_REAPPLY_NEEDLES = ["no cooldown applies", "submit a new account review request immediately"];
const COOLDOWN_APPLIES_NEEDLES = ["days before submitting", "after 30 days"];

const LEGACY_CANCELLED_PREFIX = "Account review cancelled";
const CANCELLED_PREFIX = "This account review has been cancelled";

const LEGACY_REVIEW_DECISION_PREFIXES = [
  "Account review approved",
  "Account review partially approved",
  "Account review denied",
] as const;

const REVIEW_DECISION_PREFIXES = [
  "Your account review has been accepted",
  "Your account review has been partially accepted",
  "Your account review has been denied",
] as const;

function isCancelledReviewMessage(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith(CANCELLED_PREFIX) || trimmed.startsWith(LEGACY_CANCELLED_PREFIX);
}

function isReviewDecisionMessage(body: string): boolean {
  const trimmed = body.trim();
  return (
    LEGACY_REVIEW_DECISION_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ||
    REVIEW_DECISION_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  );
}

export function cancelledReviewMessageNeedsReapplyNote(body: string | null | undefined): boolean {
  if (!body?.trim() || !isCancelledReviewMessage(body)) return false;
  const lower = body.toLowerCase();
  return !CANCELLED_REAPPLY_NEEDLES.some((needle) => lower.includes(needle));
}

export function reviewMessageNeedsCooldownNote(body: string | null | undefined): boolean {
  const trimmed = body?.trim();
  if (!trimmed || !isReviewDecisionMessage(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  return !COOLDOWN_APPLIES_NEEDLES.some((needle) => lower.includes(needle));
}

/** Append the immediate reapply note to legacy cancellation system messages. */
export async function backfillCancelledReviewThreadMessages(): Promise<{ updated: number }> {
  const messages = await prisma.altaCardReviewThreadMessage.findMany({
    where: {
      senderRole: "SYSTEM",
      deletedAt: null,
      OR: [
        { body: { startsWith: LEGACY_CANCELLED_PREFIX } },
        { body: { startsWith: CANCELLED_PREFIX } },
      ],
      thread: { reviewRequest: { status: "CANCELLED" } },
    },
    select: { id: true, body: true },
  });

  let updated = 0;
  for (const message of messages) {
    if (!cancelledReviewMessageNeedsReapplyNote(message.body)) continue;

    await prisma.altaCardReviewThreadMessage.update({
      where: { id: message.id },
      data: { body: `${message.body!.trimEnd()} ${ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE}` },
    });
    updated += 1;
  }

  return { updated };
}

/** Append the cooldown note to legacy approved, partial, and denied system messages. */
export async function backfillCooldownReviewThreadMessages(): Promise<{ updated: number }> {
  const messages = await prisma.altaCardReviewThreadMessage.findMany({
    where: {
      senderRole: "SYSTEM",
      deletedAt: null,
      OR: [
        { body: { startsWith: LEGACY_REVIEW_DECISION_PREFIXES[0] } },
        { body: { startsWith: LEGACY_REVIEW_DECISION_PREFIXES[1] } },
        { body: { startsWith: LEGACY_REVIEW_DECISION_PREFIXES[2] } },
        { body: { startsWith: REVIEW_DECISION_PREFIXES[0] } },
        { body: { startsWith: REVIEW_DECISION_PREFIXES[1] } },
        { body: { startsWith: REVIEW_DECISION_PREFIXES[2] } },
      ],
      thread: {
        reviewRequest: { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "DENIED"] } },
      },
    },
    select: { id: true, body: true },
  });

  let updated = 0;
  for (const message of messages) {
    if (!reviewMessageNeedsCooldownNote(message.body)) continue;

    await prisma.altaCardReviewThreadMessage.update({
      where: { id: message.id },
      data: { body: `${message.body!.trimEnd()}\n\n${ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE}` },
    });
    updated += 1;
  }

  return { updated };
}
