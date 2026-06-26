import { Prisma } from "@prisma/client";
import type {
  AltaCardApplicationDetail,
  AltaCardApplicationRow,
  AltaCardApplicationStatusCode,
  AltaCardRow,
  AltaCardTierCode,
  ApproveAltaCardApplicationInput,
  DenyAltaCardApplicationInput,
  InternalAltaCardApplicationFilters,
  InternalAltaCardApplicationReviewContext,
} from "@/lib/bank/alta-card-types";
import { isAdmin, isOperator, isPrivateClient, canManageBusinessTreasury } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import {
  altaCardApplicationInclude,
  altaCardInclude,
  mapAltaCardApplicationDetail,
  mapAltaCardApplicationRow,
  mapAltaCardRow,
  toDbAltaCardApplicationStatus,
  toDbAltaCardTier,
} from "@/server/alta-card-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  createThreadForAltaCardApplication,
  ensureThreadExists,
  getAltaCardThreadContext,
  getAltaCardThreadMessages,
  postAltaCardApplicationSystemMessage,
} from "@/server/alta-card-application-thread.service";

export const OPEN_ALTA_CARD_APPLICATION_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"] as const;

export const BLOCKING_ALTA_CARD_APPLICATION_STATUSES = [
  ...OPEN_ALTA_CARD_APPLICATION_STATUSES,
  "APPROVED",
] as const;

export function blockingPersonalApplicationWhere(applicantUserId: string): Prisma.AltaCardApplicationWhereInput {
  return {
    applicantUserId,
    cardType: "PERSONAL",
    status: { in: [...BLOCKING_ALTA_CARD_APPLICATION_STATUSES] },
    acceptedAt: null,
    card: { is: null },
  };
}

export function blockingBusinessApplicationWhere(companyId: string): Prisma.AltaCardApplicationWhereInput {
  return {
    companyId,
    cardType: "BUSINESS",
    status: { in: [...BLOCKING_ALTA_CARD_APPLICATION_STATUSES] },
    acceptedAt: null,
    card: { is: null },
  };
}

async function assertNoOpenAltaCardForApplication(application: {
  cardType: string;
  applicantUserId: string;
  companyId: string | null;
}): Promise<void> {
  if (application.cardType === "PERSONAL") {
    const existing = await prisma.altaCard.findFirst({
      where: {
        ownerUserId: application.applicantUserId,
        cardType: "PERSONAL",
        status: { not: "CLOSED" },
      },
    });
    if (existing) badRequest("You already have a personal Alta Card");
    return;
  }

  if (application.companyId) {
    const existing = await prisma.altaCard.findFirst({
      where: {
        companyId: application.companyId,
        cardType: "BUSINESS",
        status: { not: "CLOSED" },
      },
    });
    if (existing) badRequest("This company already has a business Alta Card");
  }
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

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function randomCardLastFour(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function assertOperatorOrAdmin(user: AltaUser): void {
  if (!isAdmin(user) && !isOperator(user)) forbidden();
}

function assertCanApproveTier(
  admin: AltaUser,
  tier: AltaCardTierCode,
  applicant: AltaUser,
  goldOverride?: boolean,
): void {
  if (tier === "gold") {
    if (!isAdmin(admin)) forbidden();
    if (!isPrivateClient(applicant) && !goldOverride) {
      badRequest("Gold approval requires Alta Private eligibility or admin override");
    }
  } else {
    assertOperatorOrAdmin(admin);
  }
}

async function auditApplicationEvent(
  actorUserId: string,
  action: string,
  description: string,
  applicationId: string,
  metadata: Record<string, unknown>,
  targetUserId?: string | null,
  targetCompanyId?: string | null,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "ALTA_CARD",
    entityId: applicationId,
    description,
    targetUserId: targetUserId ?? undefined,
    targetCompanyId: targetCompanyId ?? undefined,
    metadata: { applicationId, actorUserId, ...metadata },
  });
}

async function createCardFromApplication(
  tx: Prisma.TransactionClient,
  application: Prisma.AltaCardApplicationGetPayload<object>,
  tier: AltaCardTierCode,
  approvedLimit: number,
  interestRate: number,
  billingCycleDay: number | null,
  activate: boolean,
): Promise<Prisma.AltaCardGetPayload<{ include: typeof altaCardInclude }>> {
  if (application.cardType === "PERSONAL") {
    const existing = await tx.altaCard.findFirst({
      where: {
        ownerUserId: application.applicantUserId,
        cardType: "PERSONAL",
        status: { not: "CLOSED" },
      },
    });
    if (existing) badRequest("Applicant already has a personal Alta Card");
  }

  if (application.cardType === "BUSINESS" && application.companyId) {
    const existing = await tx.altaCard.findFirst({
      where: {
        companyId: application.companyId,
        cardType: "BUSINESS",
        status: { not: "CLOSED" },
      },
    });
    if (existing) badRequest("Company already has a business Alta Card");
  }

  const created = await tx.altaCard.create({
    data: {
      ownerUserId: application.cardType === "PERSONAL" ? application.applicantUserId : null,
      companyId: application.companyId,
      applicationId: application.id,
      tier: toDbAltaCardTier(tier),
      cardType: application.cardType,
      status: activate ? "ACTIVE" : "PENDING",
      creditLimit: toDecimal(approvedLimit),
      availableCredit: toDecimal(approvedLimit),
      interestRate: toDecimal(interestRate),
      billingCycleDay,
      cardLastFour: randomCardLastFour(),
      openedAt: activate ? new Date() : null,
    },
    include: altaCardInclude,
  });

  if (activate) {
    const { initializeBillingCycleForCard } = await import("@/server/alta-card-statement.service");
    const anchor = billingCycleDay
      ? new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(billingCycleDay, 28))
      : new Date();
    await initializeBillingCycleForCard(tx, created.id, anchor);
  }

  return created;
}

export async function updateAltaCardApplicationStatus(
  staffUserId: string,
  applicationId: string,
  status: AltaCardApplicationStatusCode,
): Promise<AltaCardApplicationRow> {
  const staff = await getAltaUser(staffUserId);
  assertOperatorOrAdmin(staff);

  const application = await prisma.altaCardApplication.findUnique({ where: { id: applicationId } });
  if (!application) notFound();
  if (!OPEN_ALTA_CARD_APPLICATION_STATUSES.includes(application.status as (typeof OPEN_ALTA_CARD_APPLICATION_STATUSES)[number]) && status !== "cancelled") {
    badRequest("Application is no longer open for status changes");
  }

  const updated = await prisma.altaCardApplication.update({
    where: { id: applicationId },
    data: { status: toDbAltaCardApplicationStatus(status) },
    include: altaCardApplicationInclude,
  });

  await auditApplicationEvent(
    staffUserId,
    "ALTA_CARD_APPLICATION_STATUS_CHANGED",
    `Application status changed to ${status}`,
    applicationId,
    { previousStatus: application.status.toLowerCase(), newStatus: status },
    application.applicantUserId,
    application.companyId,
  );

  return mapAltaCardApplicationRow(updated);
}

export async function approveAltaCardApplication(
  adminUserId: string,
  input: ApproveAltaCardApplicationInput,
): Promise<{ application: AltaCardApplicationRow; card: AltaCardRow | null }> {
  const admin = await getAltaUser(adminUserId);

  const application = await prisma.altaCardApplication.findUnique({
    where: { id: input.applicationId },
    include: { applicant: { include: userWithMembershipsInclude } },
  });
  if (!application || !OPEN_ALTA_CARD_APPLICATION_STATUSES.includes(application.status as (typeof OPEN_ALTA_CARD_APPLICATION_STATUSES)[number])) {
    notFound();
  }

  const applicant = mapDbUserToAltaUser(application.applicant);
  const tier = input.tier ?? (application.requestedTier.toLowerCase() as AltaCardTierCode);
  assertCanApproveTier(admin, tier, applicant, input.goldOverride);

  if (input.approvedLimit <= 0) badRequest("Approved limit must be greater than zero");
  if (input.interestRate < 0) badRequest("Interest rate cannot be negative");
  if (input.billingCycleDay != null && (input.billingCycleDay < 1 || input.billingCycleDay > 28)) {
    badRequest("Billing cycle day must be between 1 and 28");
  }

  await assertNoOpenAltaCardForApplication(application);

  if (input.goldOverride && tier === "gold" && !isPrivateClient(applicant)) {
    await auditApplicationEvent(
      adminUserId,
      "ALTA_CARD_GOLD_OVERRIDE",
      "Gold tier approved with admin override",
      application.id,
      { applicantUserId: application.applicantUserId, approvedTier: tier },
      application.applicantUserId,
      application.companyId,
    );
  }

  const activate = input.approveAndActivate === true;

  const result = await prisma.$transaction(async (tx) => {
    const updatedApp = await tx.altaCardApplication.update({
      where: { id: application.id },
      data: {
        status: "APPROVED",
        approvedTier: toDbAltaCardTier(tier),
        approvedLimit: toDecimal(input.approvedLimit),
        approvedInterestRate: toDecimal(input.interestRate),
        billingCycleDay: input.billingCycleDay ?? null,
        reviewNote: input.reviewNote,
        goldOverride: input.goldOverride ?? false,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        acceptedAt: activate ? new Date() : null,
      },
      include: altaCardApplicationInclude,
    });

    let card: Prisma.AltaCardGetPayload<{ include: typeof altaCardInclude }> | null = null;
    if (activate) {
      card = await createCardFromApplication(
        tx,
        application,
        tier,
        input.approvedLimit,
        input.interestRate,
        input.billingCycleDay ?? null,
        true,
      );
    }

    return { application: updatedApp, card };
  });

  await postAltaCardApplicationSystemMessage(
    application.id,
    "Your Alta Card application has been approved.",
    true,
  );

  await auditApplicationEvent(
    adminUserId,
    "ALTA_CARD_APPLICATION_APPROVED",
    `Alta Card application approved (${tier}, limit ${input.approvedLimit})`,
    application.id,
    {
      approvedTier: tier,
      approvedLimit: input.approvedLimit,
      approvedInterestRate: input.interestRate,
      approveAndActivate: activate,
      cardId: result.card?.id ?? null,
    },
    application.applicantUserId,
    application.companyId,
  );

  if (result.card) {
    await auditApplicationEvent(
      adminUserId,
      "ALTA_CARD_CREATED_FROM_APPLICATION",
      "Alta Card created and activated from application",
      application.id,
      { cardId: result.card.id, approvedTier: tier },
      application.applicantUserId,
      application.companyId,
    );
  }

  return {
    application: mapAltaCardApplicationRow(result.application),
    card: result.card ? mapAltaCardRow(result.card) : null,
  };
}

export async function denyAltaCardApplication(
  adminUserId: string,
  input: DenyAltaCardApplicationInput,
): Promise<AltaCardApplicationRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (!input.denialReason?.trim()) badRequest("Denial reason is required");

  const application = await prisma.altaCardApplication.findUnique({
    where: { id: input.applicationId },
  });
  if (!application || !OPEN_ALTA_CARD_APPLICATION_STATUSES.includes(application.status as (typeof OPEN_ALTA_CARD_APPLICATION_STATUSES)[number])) {
    notFound();
  }

  const updated = await prisma.altaCardApplication.update({
    where: { id: application.id },
    data: {
      status: "DENIED",
      denialReason: input.denialReason.trim(),
      reviewedById: adminUserId,
      reviewedAt: new Date(),
    },
    include: altaCardApplicationInclude,
  });

  await postAltaCardApplicationSystemMessage(
    application.id,
    "Your Alta Card application was not approved.",
    true,
  );

  await auditApplicationEvent(
    adminUserId,
    "ALTA_CARD_APPLICATION_DENIED",
    "Alta Card application denied",
    application.id,
    { denialReason: input.denialReason },
    application.applicantUserId,
    application.companyId,
  );

  return mapAltaCardApplicationRow(updated);
}

export async function acceptAltaCardApplication(
  userId: string,
  applicationId: string,
): Promise<AltaCardRow> {
  const application = await prisma.altaCardApplication.findUnique({
    where: { id: applicationId },
    include: altaCardApplicationInclude,
  });
  if (!application || application.status !== "APPROVED") notFound();
  if (application.acceptedAt) badRequest("Application has already been accepted");

  const user = await getAltaUser(userId);
  if (application.applicantUserId !== userId) {
    if (!application.companyId || !canManageBusinessTreasury(user, { companyId: application.companyId })) {
      forbidden();
    }
  }

  await assertNoOpenAltaCardForApplication(application);

  const existingCard = await prisma.altaCard.findFirst({
    where: { applicationId: application.id },
  });
  if (existingCard) {
    if (existingCard.status === "PENDING") {
      const { activateAltaCard } = await import("@/server/alta-card.service");
      return activateAltaCard(userId, existingCard.id);
    }
    badRequest("Card already exists for this application");
  }

  const tier = (application.approvedTier ?? application.requestedTier).toLowerCase() as AltaCardTierCode;
  const approvedLimit = Number(application.approvedLimit);
  const interestRate = Number(application.approvedInterestRate);
  if (!approvedLimit || !application.approvedInterestRate) badRequest("Application is missing approval terms");

  const card = await prisma.$transaction(async (tx) => {
    const created = await createCardFromApplication(
      tx,
      application,
      tier,
      approvedLimit,
      interestRate,
      application.billingCycleDay,
      true,
    );

    await tx.altaCardApplication.update({
      where: { id: application.id },
      data: { acceptedAt: new Date() },
    });

    return created;
  });

  await auditApplicationEvent(
    userId,
    "ALTA_CARD_APPLICATION_ACCEPTED",
    "Applicant accepted Alta Card approval",
    applicationId,
    { cardId: card.id, approvedTier: tier, approvedLimit, approvedInterestRate: interestRate },
    application.applicantUserId,
    application.companyId,
  );

  await auditApplicationEvent(
    userId,
    "ALTA_CARD_CREATED_FROM_APPLICATION",
    "Alta Card created from accepted application",
    applicationId,
    { cardId: card.id },
    application.applicantUserId,
    application.companyId,
  );

  return mapAltaCardRow(card);
}


export async function getAltaCardApplicationDetail(
  userId: string,
  applicationId: string,
): Promise<AltaCardApplicationDetail> {
  const application = await prisma.altaCardApplication.findUnique({
    where: { id: applicationId },
    include: altaCardApplicationInclude,
  });
  if (!application) notFound();

  const user = await getAltaUser(userId);
  const isStaff = isAdmin(user) || isOperator(user);
  const isApplicant = application.applicantUserId === userId;
  const isCompanyTreasury =
    application.companyId != null && canManageBusinessTreasury(user, { companyId: application.companyId });
  if (!isStaff && !isApplicant && !isCompanyTreasury) forbidden();

  return mapAltaCardApplicationDetail(application);
}

export async function getUserPendingAltaCardApplication(userId: string): Promise<AltaCardApplicationRow | null> {
  const application = await prisma.altaCardApplication.findFirst({
    where: blockingPersonalApplicationWhere(userId),
    include: altaCardApplicationInclude,
    orderBy: { createdAt: "desc" },
  });
  return application ? mapAltaCardApplicationRow(application) : null;
}

export async function listInternalAltaCardApplicationsFiltered(
  filters: InternalAltaCardApplicationFilters = {},
): Promise<AltaCardApplicationRow[]> {
  const and: Prisma.AltaCardApplicationWhereInput[] = [];
  if (filters.status) and.push({ status: toDbAltaCardApplicationStatus(filters.status) });
  if (filters.cardType) and.push({ cardType: filters.cardType.toUpperCase() as "PERSONAL" | "BUSINESS" });
  if (filters.tier) and.push({ requestedTier: toDbAltaCardTier(filters.tier) });
  if (filters.companyId) and.push({ companyId: filters.companyId });
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { applicant: { discordUsername: { contains: q, mode: "insensitive" } } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const applications = await prisma.altaCardApplication.findMany({
    where: and.length ? { AND: and } : undefined,
    include: altaCardApplicationInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return applications.map(mapAltaCardApplicationRow);
}

export async function getInternalAltaCardApplicationReviewContext(
  staffUserId: string,
  applicationId: string,
): Promise<InternalAltaCardApplicationReviewContext> {
  const application = await prisma.altaCardApplication.findUnique({
    where: { id: applicationId },
    include: altaCardApplicationInclude,
  });
  if (!application) notFound();

  await ensureThreadExists(staffUserId, applicationId);

  const [
    applicantAccountCount,
    applicantLoanCount,
    companyAccountCount,
    companyLoanCount,
    relationship,
    threadContext,
    messages,
  ] = await Promise.all([
    prisma.bankAccount.count({ where: { userId: application.applicantUserId, companyId: null, status: "ACTIVE" } }),
    prisma.loan.count({ where: { borrowerUserId: application.applicantUserId } }),
    application.companyId
      ? prisma.bankAccount.count({ where: { companyId: application.companyId, status: "ACTIVE" } })
      : Promise.resolve(null),
    application.companyId
      ? prisma.loan.count({ where: { companyId: application.companyId } })
      : Promise.resolve(null),
    import("@/server/alta-card-relationship-pricing.service").then(({ getAltaCardRelationshipRecommendation }) =>
      getAltaCardRelationshipRecommendation(application.applicantUserId, application.companyId),
    ),
    getAltaCardThreadContext(staffUserId, applicationId, "internal"),
    getAltaCardThreadMessages(staffUserId, applicationId),
  ]);

  return {
    application: mapAltaCardApplicationDetail(application),
    applicantAccountCount,
    applicantLoanCount,
    companyAccountCount,
    companyLoanCount,
    relationship,
    threadContext,
    messages,
  };
}

export { createThreadForAltaCardApplication };
