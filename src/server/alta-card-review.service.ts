import { Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canManageCompanyAltaCard,
  isAdmin,
  isOperator,
  isPrivateClient,
} from "@/lib/auth/permissions";
import type {
  AltaCardReviewFormContext,
  AltaCardReviewHistoryRow,
  AltaCardReviewQueueRow,
  AltaCardReviewRequestRow,
  InternalAltaCardReviewDetail,
  ProcessAltaCardReviewDecisionInput,
  SubmitAltaCardReviewAttachmentInput,
  SubmitAltaCardReviewInput,
} from "@/lib/bank/alta-card-review-types";
import { ALTA_CARD_REVIEW_STATUS_LABELS } from "@/lib/bank/alta-card-review-types";
import {
  formatReviewCancelledThreadMessage,
  formatReviewDeniedThreadMessage,
  formatReviewChangesSummary,
  formatReviewDecisionThreadMessage,
  getEligibleTierUpgrades,
  ALTA_CARD_REVIEW_ACTIVE_MESSAGE,
  ALTA_CARD_REVIEW_ACTIVE_STATUSES,
  ALTA_CARD_REVIEW_COOLDOWN_MS,
  ALTA_CARD_REVIEW_TERMINAL_STATUSES,
  formatReviewCooldownBlockMessage,
  formatReviewCooldownRemaining,
  reviewStatusTriggersCooldown,
} from "@/lib/bank/alta-card-review-helpers";
import { formatReviewNeedsInformationThreadMessage } from "@/lib/bank/secure-deal-room-system-copy";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";
import type { AltaCardReviewThreadStatusCode } from "@/lib/bank/alta-card-review-thread-types";
import { resolveAltaCardThreadAttachmentMime } from "@/lib/storage/alta-card-thread-attachment.constants";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { altaCardInclude } from "@/server/alta-card-mapper";
import { toAltaCardTierCode, toDbAltaCardTier } from "@/server/alta-card-mapper";
import {
  isTerminalReviewStatus,
  toAltaCardReviewStatusCode,
  toDbAltaCardReviewStatus,
} from "@/server/alta-card-review-mapper";
import { createThreadForReviewRequest, finalizeReviewThreadDecision, postReviewSystemMessage } from "@/server/alta-card-review-thread.service";
import { getAltaCardRelationshipRecommendation } from "@/server/alta-card-relationship-pricing.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

const OPEN_REVIEW_STATUSES = ALTA_CARD_REVIEW_ACTIVE_STATUSES;

async function getCardReviewEligibility(
  cardId: string,
): Promise<AltaCardReviewEligibility> {
  const [openReview, lastTerminal] = await Promise.all([
    prisma.altaCardReviewRequest.findFirst({
      where: { altaCardId: cardId, status: { in: [...OPEN_REVIEW_STATUSES] } },
      select: { id: true },
    }),
    prisma.altaCardReviewRequest.findFirst({
      where: {
        altaCardId: cardId,
        status: { in: [...ALTA_CARD_REVIEW_TERMINAL_STATUSES] },
      },
      orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
      select: { status: true, reviewedAt: true, updatedAt: true },
    }),
  ]);

  if (openReview) {
    return {
      canRequestReview: false,
      hasActiveReview: true,
      activeReviewId: openReview.id,
      inCooldown: false,
      cooldownEndsAt: null,
      cooldownRemainingLabel: null,
      blockMessage: ALTA_CARD_REVIEW_ACTIVE_MESSAGE,
    };
  }

  if (lastTerminal && reviewStatusTriggersCooldown(lastTerminal.status)) {
    const completedAt = lastTerminal.reviewedAt ?? lastTerminal.updatedAt;
    const cooldownEndsAt = new Date(completedAt.getTime() + ALTA_CARD_REVIEW_COOLDOWN_MS);
    const now = new Date();

    if (cooldownEndsAt.getTime() > now.getTime()) {
      const cooldownRemainingLabel = formatReviewCooldownRemaining(cooldownEndsAt, now);
      return {
        canRequestReview: false,
        hasActiveReview: false,
        activeReviewId: null,
        inCooldown: true,
        cooldownEndsAt: cooldownEndsAt.toISOString(),
        cooldownRemainingLabel,
        blockMessage: formatReviewCooldownBlockMessage(cooldownEndsAt, now),
      };
    }
  }

  return {
    canRequestReview: true,
    hasActiveReview: false,
    activeReviewId: null,
    inCooldown: false,
    cooldownEndsAt: null,
    cooldownRemainingLabel: null,
    blockMessage: null,
  };
}

export { getCardReviewEligibility };

export async function getCardReviewEligibilityForUser(
  userId: string,
  cardId: string,
): Promise<AltaCardReviewEligibility> {
  const user = await getAltaUser(userId);
  return getCardReviewEligibility(cardId);
}

export async function listCardReviewHistoryForUser(
  userId: string,
  cardId: string,
): Promise<AltaCardReviewHistoryRow[]> {
  const user = await getAltaUser(userId);
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  await assertCanManageCardReview(user, card);

  const reviews = await prisma.altaCardReviewRequest.findMany({
    where: { altaCardId: cardId },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return reviews.map((review) => {
    const row = mapReviewRow(review);
    return {
      id: row.id,
      status: row.status,
      statusLabel: row.statusLabel,
      threadStatus: row.threadStatus,
      createdAtLabel: row.createdAtLabel,
      reviewedAtLabel: row.reviewedAtLabel,
      requestedChangesSummary: formatReviewChangesSummary({
        requestLimitIncrease: row.requestLimitIncrease,
        requestRateReduction: row.requestRateReduction,
        requestTierUpgrade: row.requestTierUpgrade,
        requestedLimit: row.requestedLimit,
        requestedRate: row.requestedRate,
        requestedTier: row.requestedTier,
      }),
    };
  });
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

const MAX_REVIEW_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_REVIEW_ATTACHMENT_COUNT = 10;

function fileFromReviewAttachmentInput(input: SubmitAltaCardReviewAttachmentInput): File {
  const base64 = input.base64.trim();
  if (!base64) badRequest(`Attachment is empty: ${input.fileName}`);
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_REVIEW_ATTACHMENT_BYTES) {
    badRequest(`File exceeds 15 MB limit: ${input.fileName}`);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    badRequest(`Attachment could not be read: ${input.fileName}`);
  }
  if (buffer.byteLength > MAX_REVIEW_ATTACHMENT_BYTES) {
    badRequest(`File exceeds 15 MB limit: ${input.fileName}`);
  }
  if (buffer.byteLength <= 0) {
    badRequest(`Attachment is empty: ${input.fileName}`);
  }

  const mimeType = resolveAltaCardThreadAttachmentMime({
    name: input.fileName,
    type: input.mimeType ?? "",
  });
  if (!mimeType) {
    badRequest(`File type not supported: ${input.fileName}`);
  }

  return new File([buffer], input.fileName, { type: mimeType });
}

async function uploadReviewAttachmentFiles(
  userId: string,
  reviewRequestId: string,
  files: SubmitAltaCardReviewAttachmentInput[],
): Promise<AltaCardThreadAttachment[]> {
  if (files.length > MAX_REVIEW_ATTACHMENT_COUNT) {
    badRequest(`You can attach up to ${MAX_REVIEW_ATTACHMENT_COUNT} files.`);
  }
  const { uploadAltaCardReviewThreadAttachment } = await import(
    "@/server/alta-card-review-thread-upload.service"
  );
  const attachments: AltaCardThreadAttachment[] = [];
  for (const fileInput of files) {
    const file = fileFromReviewAttachmentInput(fileInput);
    attachments.push(await uploadAltaCardReviewThreadAttachment(userId, reviewRequestId, file));
  }
  return attachments;
}

function isStaff(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  return value != null ? Number(value.toString()) : null;
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

async function assertCanManageCardReview(user: AltaUser, card: {
  cardType: string;
  ownerUserId: string | null;
  companyId: string | null;
  status: string;
}): Promise<void> {
  if (card.status === "CLOSED") badRequest("Closed cards cannot request account review");
  if (isStaff(user)) return;
  if (card.cardType === "PERSONAL" && card.ownerUserId === user.id) return;
  if (card.cardType === "BUSINESS" && card.companyId && canManageCompanyAltaCard(user, card.companyId)) {
    return;
  }
  forbidden();
}

const REVIEW_THREAD_STATUS_FROM_DB: Record<
  "OPEN" | "WAITING_ON_APPLICANT" | "WAITING_ON_ALTA" | "CLOSED",
  AltaCardReviewThreadStatusCode
> = {
  OPEN: "open",
  WAITING_ON_APPLICANT: "waiting_on_applicant",
  WAITING_ON_ALTA: "waiting_on_alta",
  CLOSED: "closed",
};

function mapReviewRow(
  review: Prisma.AltaCardReviewRequestGetPayload<{
    include: {
      applicantUser: { select: { discordUsername: true } };
      company: { select: { name: true } };
      reviewer: { select: { discordUsername: true } };
      altaCard: { select: { cardLastFour: true, cardType: true, tier: true, creditLimit: true, interestRate: true } };
      thread: { include: { assignedStaff: { select: { discordUsername: true } } } };
    };
  }>,
  audience: "customer" | "internal" = "internal",
): AltaCardReviewRequestRow {
  const status = toAltaCardReviewStatusCode(review.status);
  const threadStatus = review.thread
    ? REVIEW_THREAD_STATUS_FROM_DB[review.thread.status]
    : null;
  return {
    id: review.id,
    altaCardId: review.altaCardId,
    cardLastFour: review.altaCard.cardLastFour,
    cardType: review.altaCard.cardType.toLowerCase(),
    applicantUserId: review.applicantUserId,
    applicantUsername: review.applicantUser.discordUsername,
    companyId: review.companyId,
    companyName: review.company?.name ?? null,
    currentTier: toAltaCardTierCode(review.altaCard.tier),
    currentLimit: Number(review.altaCard.creditLimit),
    currentRate: Number(review.altaCard.interestRate),
    requestLimitIncrease: review.requestLimitIncrease,
    requestRateReduction: review.requestRateReduction,
    requestTierUpgrade: review.requestTierUpgrade,
    requestedLimit: decimalToNumber(review.requestedLimit),
    requestedRate: decimalToNumber(review.requestedRate),
    requestedTier: review.requestedTier ? toAltaCardTierCode(review.requestedTier) : null,
    notes: review.notes,
    status,
    statusLabel: ALTA_CARD_REVIEW_STATUS_LABELS[status],
    threadStatus,
    approvedLimit: decimalToNumber(review.approvedLimit),
    approvedRate: decimalToNumber(review.approvedRate),
    approvedTier: review.approvedTier ? toAltaCardTierCode(review.approvedTier) : null,
    approvedLimitIncrease: review.approvedLimitIncrease,
    approvedRateReduction: review.approvedRateReduction,
    approvedTierUpgrade: review.approvedTierUpgrade,
    decisionNote:
      audience === "customer" && status !== "needs_information" ? null : review.decisionNote,
    reviewedByUsername: review.reviewer?.discordUsername ?? null,
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
    reviewedAtLabel: review.reviewedAt ? formatActivityDateTime(review.reviewedAt) : null,
    assignedStaffName: null,
    createdAt: review.createdAt.toISOString(),
    createdAtLabel: formatActivityDateTime(review.createdAt),
  };
}

const reviewInclude = {
  applicantUser: { select: { discordUsername: true } },
  company: { select: { name: true } },
  reviewer: { select: { discordUsername: true } },
  altaCard: {
    select: {
      id: true,
      cardLastFour: true,
      cardType: true,
      tier: true,
      creditLimit: true,
      interestRate: true,
    },
  },
  thread: { include: { assignedStaff: { select: { discordUsername: true } } } },
} satisfies Prisma.AltaCardReviewRequestInclude;

export async function getReviewFormContext(
  userId: string,
  cardId: string,
): Promise<AltaCardReviewFormContext> {
  const user = await getAltaUser(userId);
  const card = await prisma.altaCard.findUnique({ where: { id: cardId }, include: altaCardInclude });
  if (!card) notFound();
  await assertCanManageCardReview(user, card);

  const [relationship, eligibility, reviewHistory] = await Promise.all([
    getAltaCardRelationshipRecommendation(userId, card.companyId).catch(() => null),
    getCardReviewEligibility(cardId),
    listCardReviewHistoryForUser(userId, cardId),
  ]);

  const tier = toAltaCardTierCode(card.tier);
  const privateClient = isPrivateClient(user);

  return {
    card: {
      id: card.id,
      tier,
      creditLimit: Number(card.creditLimit),
      interestRate: Number(card.interestRate),
      cardType: card.cardType.toLowerCase(),
      cardLastFour: card.cardLastFour,
      companyId: card.companyId,
    },
    relationship,
    isPrivateClient: privateClient,
    eligibleTierUpgrades: getEligibleTierUpgrades(tier, privateClient),
    eligibility,
    reviewHistory,
    hasOpenReview: eligibility.hasActiveReview,
    openReviewId: eligibility.activeReviewId,
  };
}

export async function submitReviewRequest(
  userId: string,
  input: SubmitAltaCardReviewInput,
): Promise<{ reviewId: string }> {
  const { assertCreditDeskAcceptingApplications } = await import("@/server/platform-settings.service");
  await assertCreditDeskAcceptingApplications();

  const user = await getAltaUser(userId);
  const card = await prisma.altaCard.findUnique({ where: { id: input.cardId } });
  if (!card) notFound();
  await assertCanManageCardReview(user, card);

  if (!input.requestLimitIncrease && !input.requestRateReduction && !input.requestTierUpgrade) {
    badRequest("Select at least one requested improvement");
  }

  const eligibility = await getCardReviewEligibility(input.cardId);

  if (!eligibility.canRequestReview) {
    badRequest(
      eligibility.blockMessage ??
        (eligibility.hasActiveReview
          ? ALTA_CARD_REVIEW_ACTIVE_MESSAGE
          : "Account review cooldown is in effect"),
    );
  }

  const tier = toAltaCardTierCode(card.tier);
  const privateClient = isPrivateClient(user);

  if (input.requestTierUpgrade) {
    if (!input.requestedTier) badRequest("Select a tier upgrade option");
    const eligible = getEligibleTierUpgrades(tier, privateClient);
    if (!eligible.includes(input.requestedTier)) {
      badRequest("Selected tier upgrade is not eligible");
    }
    if (input.requestedTier === "gold" && !privateClient) {
      badRequest("Alta Gold is available exclusively through Alta Private");
    }
  }

  if (input.requestLimitIncrease && input.requestedLimit != null && input.requestedLimit <= Number(card.creditLimit)) {
    badRequest("Requested limit must exceed your current credit limit");
  }

  if (input.requestRateReduction && input.requestedRate != null && input.requestedRate >= Number(card.interestRate)) {
    badRequest("Requested rate must be lower than your current interest rate");
  }

  const review = await prisma.altaCardReviewRequest.create({
    data: {
      altaCardId: card.id,
      applicantUserId: userId,
      companyId: card.companyId,
      requestLimitIncrease: input.requestLimitIncrease,
      requestRateReduction: input.requestRateReduction,
      requestTierUpgrade: input.requestTierUpgrade,
      requestedLimit: input.requestedLimit != null ? input.requestedLimit : null,
      requestedRate: input.requestedRate != null ? input.requestedRate : null,
      requestedTier: input.requestedTier ? toDbAltaCardTier(input.requestedTier) : null,
      notes: input.notes?.trim() || null,
      status: "SUBMITTED",
    },
  });

  await createThreadForReviewRequest(userId, review.id);

  const uploadedAttachments = input.attachmentFiles?.length
    ? await uploadReviewAttachmentFiles(userId, review.id, input.attachmentFiles)
    : [];
  const initialAttachments = [...(input.initialAttachments ?? []), ...uploadedAttachments];

  if (initialAttachments.length || input.notes?.trim()) {
    const { sendReviewThreadMessage } = await import("@/server/alta-card-review-thread.service");
    await sendReviewThreadMessage(
      userId,
      {
        reviewRequestId: review.id,
        body:
          input.notes?.trim() ||
          (initialAttachments.length ? "Supporting documents attached." : ""),
        attachments: initialAttachments.length ? initialAttachments : undefined,
      },
      "applicant",
    );
  }

  await writeAuditLog({
    actorUserId: userId,
    action: "ALTA_CARD_REVIEW_REQUEST_CREATED",
    entityType: "ALTA_CARD",
    entityId: card.id,
    description: "Account review request submitted",
    targetUserId: card.ownerUserId ?? undefined,
    targetCompanyId: card.companyId ?? undefined,
    metadata: {
      cardId: card.id,
      reviewId: review.id,
      requestLimitIncrease: input.requestLimitIncrease,
      requestRateReduction: input.requestRateReduction,
      requestTierUpgrade: input.requestTierUpgrade,
      requestedLimit: input.requestedLimit ?? null,
      requestedRate: input.requestedRate ?? null,
      requestedTier: input.requestedTier ?? null,
      actorUserId: userId,
    },
  });

  return { reviewId: review.id };
}

export async function getReviewRequestDetail(
  userId: string,
  reviewId: string,
): Promise<AltaCardReviewRequestRow> {
  const user = await getAltaUser(userId);
  const review = await prisma.altaCardReviewRequest.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });
  if (!review) notFound();

  const card = await prisma.altaCard.findUnique({ where: { id: review.altaCardId } });
  if (!card) notFound();

  if (!isStaff(user)) {
    if (review.applicantUserId !== userId) {
      if (!(card.companyId && canManageBusinessTreasury(user, { companyId: card.companyId }))) {
        forbidden();
      }
    }
  }

  return mapReviewRow(review, "customer");
}

export async function listInternalReviewQueue(): Promise<AltaCardReviewQueueRow[]> {
  const reviews = await prisma.altaCardReviewRequest.findMany({
    include: reviewInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return reviews.map((review) => {
    const row = mapReviewRow(review);
    return {
      ...row,
      requestedChangesSummary: formatReviewChangesSummary({
        requestLimitIncrease: row.requestLimitIncrease,
        requestRateReduction: row.requestRateReduction,
        requestTierUpgrade: row.requestTierUpgrade,
        requestedLimit: row.requestedLimit,
        requestedRate: row.requestedRate,
        requestedTier: row.requestedTier,
      }),
    };
  });
}

export async function getInternalReviewDetail(
  staffUserId: string,
  reviewId: string,
): Promise<InternalAltaCardReviewDetail> {
  const staff = await getAltaUser(staffUserId);
  if (!isStaff(staff)) forbidden();

  const review = await prisma.altaCardReviewRequest.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });
  if (!review) notFound();

  const relationship = await getAltaCardRelationshipRecommendation(
    review.applicantUserId,
    review.companyId,
  ).catch(() => null);

  return {
    review: mapReviewRow(review),
    relationship,
  };
}

export async function processReviewDecision(
  staffUserId: string,
  input: ProcessAltaCardReviewDecisionInput,
): Promise<AltaCardReviewRequestRow> {
  const staff = await getAltaUser(staffUserId);
  if (!isStaff(staff)) forbidden();
  if (!input.reason.trim()) badRequest("Reason is required");

  const review = await prisma.altaCardReviewRequest.findUnique({
    where: { id: input.reviewId },
    include: reviewInclude,
  });
  if (!review) notFound();

  const cardId = review.altaCardId;

  const currentStatus = toAltaCardReviewStatusCode(review.status);
  if (isTerminalReviewStatus(currentStatus)) {
    badRequest("This review request is already closed");
  }

  if (input.action === "cancel") {
    const updated = await prisma.altaCardReviewRequest.update({
      where: { id: review.id },
      data: {
        status: "CANCELLED",
        decisionNote: input.reason.trim(),
        reviewedByUserId: staffUserId,
        reviewedAt: new Date(),
      },
      include: reviewInclude,
    });
    await finalizeReviewThreadDecision(
      staffUserId,
      review.id,
      formatReviewCancelledThreadMessage(input.reason.trim()),
    );
    return mapReviewRow(updated);
  }

  if (input.action === "needs_information") {
    const updated = await prisma.altaCardReviewRequest.update({
      where: { id: review.id },
      data: { status: "NEEDS_INFORMATION", decisionNote: input.reason.trim() },
      include: reviewInclude,
    });
    await postReviewSystemMessage(
      review.id,
      formatReviewNeedsInformationThreadMessage(input.reason.trim()),
    );
    const { updateReviewThreadStatus } = await import("@/server/alta-card-review-thread.service");
    await updateReviewThreadStatus(staffUserId, {
      reviewRequestId: review.id,
      status: "waiting_on_applicant",
    });
    return mapReviewRow(updated);
  }

  if (input.action === "deny") {
    const updated = await prisma.altaCardReviewRequest.update({
      where: { id: review.id },
      data: {
        status: "DENIED",
        approvedLimit: null,
        approvedRate: null,
        approvedTier: null,
        approvedLimitIncrease: false,
        approvedRateReduction: false,
        approvedTierUpgrade: false,
        decisionNote: input.reason.trim(),
        reviewedByUserId: staffUserId,
        reviewedAt: new Date(),
      },
      include: reviewInclude,
    });

    await writeAuditLog({
      actorUserId: staffUserId,
      action: "ALTA_CARD_REVIEW_DENIED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      description: "Account review denied",
      metadata: {
        reviewId: review.id,
        cardId,
        requestedLimit: decimalToNumber(review.requestedLimit),
        requestedRate: decimalToNumber(review.requestedRate),
        requestedTier: review.requestedTier ? toAltaCardTierCode(review.requestedTier) : null,
        actorUserId: staffUserId,
        reason: input.reason.trim(),
      },
    });

    await finalizeReviewThreadDecision(
      staffUserId,
      review.id,
      formatReviewDeniedThreadMessage(input.reason.trim()),
    );
    return mapReviewRow(updated);
  }

  if (input.action !== "approve") {
    badRequest("Unsupported review action");
  }

  const card = review.altaCard;
  let approvedLimitIncrease: boolean | null = null;
  let approvedRateReduction: boolean | null = null;
  let approvedTierUpgrade: boolean | null = null;
  let approvedLimit: number | null = null;
  let approvedRate: number | null = null;
  let approvedTier = review.approvedTier;

  const {
    updateAltaCardLimitAdmin,
    updateAltaCardRateAdmin,
    changeAltaCardTierAdmin,
  } = await import("@/server/alta-card-admin.service");

  const currentLimit = Number(card.creditLimit);
  const currentRate = Number(card.interestRate);
  const currentTier = toAltaCardTierCode(card.tier);

  const applyLimit = Boolean(input.approveLimitIncrease);
  const applyRate = Boolean(input.approveRateReduction);
  const applyTier = Boolean(input.approveTierUpgrade);

  if (!applyLimit && !applyRate && !applyTier) {
    badRequest("Select at least one term to approve");
  }

  if (applyLimit) {
    approvedLimit = input.approvedLimit ?? decimalToNumber(review.requestedLimit);
    if (approvedLimit == null) badRequest("Approved limit is required");
    if (approvedLimit <= 0) badRequest("Approved limit must be greater than zero");
    if (review.requestLimitIncrease) {
      if (approvedLimit <= currentLimit) badRequest("Approved limit must exceed current limit");
    } else if (approvedLimit === currentLimit) {
      badRequest("Approved limit must differ from current limit");
    }
    approvedLimitIncrease = true;
    await updateAltaCardLimitAdmin(staffUserId, {
      cardId,
      creditLimit: approvedLimit,
      reason: `Account review approval: ${input.reason.trim()}`,
      adminOverride: isAdmin(staff),
    });
    await writeAuditLog({
      actorUserId: staffUserId,
      action: "ALTA_CARD_LIMIT_UPDATED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      description: "Credit limit updated via account review",
      metadata: {
        reviewId: review.id,
        approvedLimit,
        requestedLimit: decimalToNumber(review.requestedLimit),
        actorUserId: staffUserId,
      },
    });
  } else if (review.requestLimitIncrease) {
    approvedLimitIncrease = false;
  }

  if (applyRate) {
    approvedRate = input.approvedRate ?? decimalToNumber(review.requestedRate);
    if (approvedRate == null) badRequest("Approved rate is required");
    if (approvedRate < 0) badRequest("Approved rate cannot be negative");
    if (review.requestRateReduction) {
      if (approvedRate >= currentRate) badRequest("Approved rate must be lower than current rate");
    } else if (approvedRate === currentRate) {
      badRequest("Approved rate must differ from current rate");
    }
    approvedRateReduction = true;
    await updateAltaCardRateAdmin(staffUserId, {
      cardId,
      interestRate: approvedRate,
      reason: `Account review approval: ${input.reason.trim()}`,
    });
    await writeAuditLog({
      actorUserId: staffUserId,
      action: "ALTA_CARD_RATE_UPDATED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      description: "Interest rate updated via account review",
      metadata: {
        reviewId: review.id,
        approvedRate,
        requestedRate: decimalToNumber(review.requestedRate),
        actorUserId: staffUserId,
      },
    });
  } else if (review.requestRateReduction) {
    approvedRateReduction = false;
  }

  if (applyTier) {
    const tierCode =
      input.approvedTier ?? (review.requestedTier ? toAltaCardTierCode(review.requestedTier) : null);
    if (!tierCode) badRequest("Approved tier is required");
    if (!review.requestTierUpgrade && tierCode === currentTier) {
      badRequest("Approved tier must differ from current tier");
    }
    approvedTierUpgrade = true;
    await changeAltaCardTierAdmin(staffUserId, {
      cardId,
      tier: tierCode,
      reason: `Account review approval: ${input.reason.trim()}`,
      applyTierDefaults: false,
      goldOverride: input.goldOverride,
    });
    approvedTier = toDbAltaCardTier(tierCode);
    await writeAuditLog({
      actorUserId: staffUserId,
      action: "ALTA_CARD_TIER_UPDATED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      description: "Card tier updated via account review",
      metadata: {
        reviewId: review.id,
        approvedTier: tierCode,
        requestedTier: review.requestedTier ? toAltaCardTierCode(review.requestedTier) : null,
        actorUserId: staffUserId,
      },
    });
  } else if (review.requestTierUpgrade) {
    approvedTierUpgrade = false;
  }

  const anyApproved =
    approvedLimitIncrease === true || approvedRateReduction === true || approvedTierUpgrade === true;
  const anyRequested =
    review.requestLimitIncrease || review.requestRateReduction || review.requestTierUpgrade;
  const allRequestedApproved =
    (!review.requestLimitIncrease || approvedLimitIncrease === true) &&
    (!review.requestRateReduction || approvedRateReduction === true) &&
    (!review.requestTierUpgrade || approvedTierUpgrade === true);

  let finalStatus: typeof review.status;
  if (!anyApproved) {
    finalStatus = "DENIED";
  } else if (anyRequested && !allRequestedApproved) {
    finalStatus = "PARTIALLY_APPROVED";
  } else {
    finalStatus = "APPROVED";
  }

  const updated = await prisma.altaCardReviewRequest.update({
    where: { id: review.id },
    data: {
      status: finalStatus,
      approvedLimit,
      approvedRate,
      approvedTier,
      approvedLimitIncrease,
      approvedRateReduction,
      approvedTierUpgrade,
      decisionNote: input.reason.trim(),
      reviewedByUserId: staffUserId,
      reviewedAt: new Date(),
    },
    include: reviewInclude,
  });

  const auditAction =
    finalStatus === "APPROVED"
      ? "ALTA_CARD_REVIEW_APPROVED"
      : finalStatus === "PARTIALLY_APPROVED"
        ? "ALTA_CARD_REVIEW_PARTIALLY_APPROVED"
        : "ALTA_CARD_REVIEW_DENIED";

  await writeAuditLog({
    actorUserId: staffUserId,
    action: auditAction,
    entityType: "ALTA_CARD",
    entityId: cardId,
    description: `Account review ${finalStatus.toLowerCase().replaceAll("_", " ")}`,
    metadata: {
      reviewId: review.id,
      cardId,
      requestedLimit: decimalToNumber(review.requestedLimit),
      requestedRate: decimalToNumber(review.requestedRate),
      requestedTier: review.requestedTier ? toAltaCardTierCode(review.requestedTier) : null,
      approvedLimit,
      approvedRate,
      approvedTier: approvedTier ? toAltaCardTierCode(approvedTier) : null,
      actorUserId: staffUserId,
      reason: input.reason.trim(),
    },
  });

  const statusMessage = formatReviewDecisionThreadMessage({
    finalStatus,
    reason: input.reason.trim(),
    currentLimit,
    currentRate,
    currentTier,
    requestLimitIncrease: review.requestLimitIncrease,
    requestRateReduction: review.requestRateReduction,
    requestTierUpgrade: review.requestTierUpgrade,
    approvedLimitIncrease,
    approvedRateReduction,
    approvedTierUpgrade,
    approvedLimit,
    approvedRate,
    approvedTier: approvedTier ? toAltaCardTierCode(approvedTier) : null,
  });

  await finalizeReviewThreadDecision(staffUserId, review.id, statusMessage);

  return mapReviewRow(updated);
}
