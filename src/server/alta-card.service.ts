import { Prisma } from "@prisma/client";
import type {
  AltaCardApplicationRow,
  AltaCardDetail,
  AltaCardRow,
  AltaCardStatusCode,
  AltaCardTierCode,
  AltaEmployeeCardRow,
  ApproveAltaCardApplicationInput,
  ChangeAltaCardTierInput,
  CreateBusinessAltaCardApplicationInput,
  CreateEmployeeCardInput,
  CreatePersonalAltaCardApplicationInput,
  DenyAltaCardApplicationInput,
  InternalAltaCardFilters,
  UpdateAltaCardLimitInput,
  UpdateAltaCardRateInput,
  UpdateEmployeeCardLimitInput,
  UserEmployeeAltaCardDetail,
  UserEmployeeAltaCardSummary,
} from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_DEFAULT_LIMITS,
  ALTA_CARD_DEFAULT_RATES,
} from "@/lib/bank/alta-card-types";
import {
  canManageBusinessTreasury,
  canViewBusinessTreasury,
  canViewCompanyAltaCard,
  canManageCompanyAltaCard,
  isAdmin,
  isOperator,
  isPrivateClient,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  altaCardApplicationInclude,
  altaCardInclude,
  mapAltaCardApplicationRow,
  mapAltaCardDetail,
  mapAltaCardRow,
  mapAltaEmployeeCardRow,
  toAltaCardTierCode,
  toDbAltaCardStatus,
  toDbAltaCardTier,
  toDbAltaCardType,
} from "@/server/alta-card-mapper";
import { mapAutopaySettingsForCard } from "@/server/alta-card-autopay.service";
import {
  BLOCKING_ALTA_CARD_APPLICATION_STATUSES,
  blockingBusinessApplicationWhere,
  blockingPersonalApplicationWhere,
  createThreadForAltaCardApplication,
} from "@/server/alta-card-application.service";

const ACTIVE_CARD_STATUSES = ["ACTIVE", "FROZEN", "LOST", "DELINQUENT"] as const;

async function getPendingBusinessApplicationForCompany(
  companyId: string,
): Promise<AltaCardApplicationRow | null> {
  const application = await prisma.altaCardApplication.findFirst({
    where: blockingBusinessApplicationWhere(companyId),
    include: altaCardApplicationInclude,
    orderBy: { createdAt: "desc" },
  });
  return application ? mapAltaCardApplicationRow(application) : null;
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

function randomCardLastFour(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function earliestPaymentDueDate(cards: AltaCardRow[]): string | null {
  return earliestIsoDate(cards.map((card) => card.paymentDueDate ?? card.dueDate));
}

function earliestIsoDate(values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => !!value).sort();
  return dates[0] ?? null;
}

async function enrichAltaCardRowBillingDates(row: AltaCardRow): Promise<AltaCardRow> {
  const { resolveAltaCardBillingDates } = await import("@/server/alta-card-statement.service");
  const billingDates = await resolveAltaCardBillingDates(prisma, row.id);

  return {
    ...row,
    paymentDueDate: billingDates.paymentDueDate?.toISOString() ?? null,
    dueDate: billingDates.paymentDueDate?.toISOString() ?? null,
    nextStatementDate: billingDates.nextStatementDate?.toISOString() ?? null,
    currentBillingCycleStart: billingDates.billingPeriodStart?.toISOString() ?? row.currentBillingCycleStart,
    currentBillingCycleEnd: billingDates.billingPeriodEnd?.toISOString() ?? row.currentBillingCycleEnd,
  };
}

function aggregateCompanyBusinessCardRow(primary: AltaCardRow, cards: AltaCardRow[]): AltaCardRow {
  if (cards.length <= 1) return primary;

  const paymentDueDate = earliestPaymentDueDate(cards);
  const nextStatementDate = earliestIsoDate(cards.map((card) => card.nextStatementDate));

  return {
    ...primary,
    currentBalance: roundMoney(cards.reduce((sum, card) => sum + card.currentBalance, 0)),
    availableCredit: roundMoney(cards.reduce((sum, card) => sum + card.availableCredit, 0)),
    creditLimit: roundMoney(cards.reduce((sum, card) => sum + card.creditLimit, 0)),
    statementBalance: roundMoney(cards.reduce((sum, card) => sum + card.statementBalance, 0)),
    minimumPaymentDue: roundMoney(cards.reduce((sum, card) => sum + card.minimumPaymentDue, 0)),
    paymentDueDate,
    dueDate: paymentDueDate,
    nextStatementDate,
  };
}

async function loadAggregatedCompanyBusinessCard(
  companyId: string,
  primaryCardId?: string,
): Promise<{ businessCard: AltaCardRow | null; hasMultipleBusinessCards: boolean }> {
  const companyBusinessCards = await prisma.altaCard.findMany({
    where: { companyId, cardType: "BUSINESS", status: { not: "CLOSED" } },
    include: altaCardInclude,
    orderBy: { createdAt: "asc" },
  });
  if (companyBusinessCards.length === 0) {
    return { businessCard: null, hasMultipleBusinessCards: false };
  }

  const { reconcileBusinessCardLedger } = await import("@/server/alta-card-transaction.service");
  for (const card of companyBusinessCards) {
    await reconcileBusinessCardLedger(prisma, card.id);
  }
  const refreshedCards = await prisma.altaCard.findMany({
    where: { companyId, cardType: "BUSINESS", status: { not: "CLOSED" } },
    include: altaCardInclude,
    orderBy: { createdAt: "asc" },
  });
  const mappedCards = await Promise.all(refreshedCards.map((card) => enrichAltaCardRowBillingDates(mapAltaCardRow(card))));
  const primaryDb =
    refreshedCards.find((card) => card.id === primaryCardId) ??
    refreshedCards.find((card) => card.employeeCards.some((employee) => employee.status !== "CLOSED")) ??
    refreshedCards[0]!;
  const primary = mappedCards.find((card) => card.id === primaryDb.id) ?? mappedCards[0]!;

  return {
    businessCard: aggregateCompanyBusinessCardRow(primary, mappedCards),
    hasMultipleBusinessCards: refreshedCards.length > 1,
  };
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

function assertGoldTierAllowed(user: AltaUser, tier: AltaCardTierCode): void {
  if (tier === "gold" && !isPrivateClient(user)) {
    badRequest("Alta Gold requires Alta Private eligibility");
  }
}

async function auditCardEvent(
  actorUserId: string,
  action: string,
  description: string,
  cardId: string,
  metadata?: Record<string, unknown>,
  targetUserId?: string | null,
  targetCompanyId?: string | null,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "ALTA_CARD",
    entityId: cardId,
    description,
    targetUserId: targetUserId ?? undefined,
    targetCompanyId: targetCompanyId ?? undefined,
    metadata,
  });
}

async function getCardOrThrow(cardId: string) {
  const card = await prisma.altaCard.findUnique({
    where: { id: cardId },
    include: altaCardInclude,
  });
  if (!card) notFound();
  return card;
}

export async function assertCompanyAltaCardViewAccess(userId: string, companyId: string): Promise<AltaUser> {
  const user = await getAltaUser(userId);
  if (!canViewCompanyAltaCard(user, companyId)) forbidden();
  return user;
}

export async function assertCardAccess(userId: string, card: { ownerUserId: string | null; companyId: string | null; cardType: string }): Promise<AltaUser> {
  const user = await getAltaUser(userId);
  if (isAdmin(user) || isOperator(user)) return user;

  if (card.cardType === "PERSONAL" && card.ownerUserId === userId) return user;

  if (card.cardType === "BUSINESS" && card.companyId) {
    if (canViewCompanyAltaCard(user, card.companyId)) return user;
  }

  forbidden();
}

export async function getUserAltaCard(userId: string): Promise<AltaCardRow | null> {
  const card = await prisma.altaCard.findFirst({
    where: {
      ownerUserId: userId,
      cardType: "PERSONAL",
      status: { in: [...ACTIVE_CARD_STATUSES, "PENDING"] },
    },
    include: altaCardInclude,
    orderBy: { createdAt: "desc" },
  });
  return card ? mapAltaCardRow(card) : null;
}

export async function resolveCompanyBusinessCard(companyId: string) {
  const cards = await prisma.altaCard.findMany({
    where: { companyId, cardType: "BUSINESS", status: { not: "CLOSED" } },
    include: altaCardInclude,
    orderBy: { createdAt: "asc" },
  });
  if (cards.length === 0) return null;

  const withEmployees = cards.find((card) =>
    card.employeeCards.some((employee) => employee.status !== "CLOSED"),
  );
  if (withEmployees) return withEmployees;

  const active = cards.filter((card) => card.status === "ACTIVE");
  const pool = active.length > 0 ? active : cards;
  return pool.sort((a, b) => Number(b.currentBalance) - Number(a.currentBalance))[0] ?? cards[0]!;
}

export async function getCompanyAltaCards(userId: string, companyId: string): Promise<{
  businessCard: AltaCardRow | null;
  employeeCards: AltaEmployeeCardRow[];
  companyTransactions: import("@/lib/bank/alta-card-types").AltaCardTransactionRow[];
  pendingApplication: AltaCardApplicationRow | null;
  employeeMemberOptions: import("@/lib/bank/alta-card-types").CompanyEmployeeCardMemberOption[];
  canManageTreasury: boolean;
  hasMultipleBusinessCards: boolean;
}> {
  const user = await getAltaUser(userId);
  await assertCompanyAltaCardViewAccess(userId, companyId);
  const canManageTreasury =
    isAdmin(user) || isOperator(user) || canManageCompanyAltaCard(user, companyId);

  const [businessCard, employeeCards, pendingApplication, employeeMemberOptions] = await Promise.all([
    resolveCompanyBusinessCard(companyId),
    prisma.altaEmployeeCard.findMany({
      where: { companyId, status: { not: "CLOSED" } },
      include: {
        authorizedUser: { select: { discordUsername: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPendingBusinessApplicationForCompany(companyId),
    canManageTreasury ? listCompanyEmployeeCardMemberOptions(userId, companyId) : Promise.resolve([]),
  ]);

  let companyTransactions: import("@/lib/bank/alta-card-types").AltaCardTransactionRow[] = [];
  let mappedBusinessCard: AltaCardRow | null = null;
  let mappedEmployeeCards = employeeCards.map(mapAltaEmployeeCardRow);
  let hasMultipleBusinessCards = false;
  if (businessCard) {
    const { listCompanyBusinessCardTransactions } = await import(
      "@/server/alta-card-transaction.service"
    );
    const aggregated = await loadAggregatedCompanyBusinessCard(companyId, businessCard.id);
    mappedBusinessCard = aggregated.businessCard;
    hasMultipleBusinessCards = aggregated.hasMultipleBusinessCards;
    companyTransactions = await listCompanyBusinessCardTransactions(companyId, 100);
    const refreshedEmployees = await prisma.altaEmployeeCard.findMany({
      where: { companyId, status: { not: "CLOSED" } },
      include: {
        authorizedUser: { select: { discordUsername: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    mappedEmployeeCards = refreshedEmployees.map(mapAltaEmployeeCardRow);
  }

  return {
    businessCard: mappedBusinessCard,
    employeeCards: mappedEmployeeCards,
    companyTransactions,
    pendingApplication,
    employeeMemberOptions,
    canManageTreasury,
    hasMultipleBusinessCards,
  };
}

export async function listCompanyEmployeeCardMemberOptions(
  actorUserId: string,
  companyId: string,
): Promise<import("@/lib/bank/alta-card-types").CompanyEmployeeCardMemberOption[]> {
  const user = await getAltaUser(actorUserId);
  if (!canManageBusinessTreasury(user, { companyId }) && !isAdmin(user) && !isOperator(user)) {
    forbidden();
  }

  const [memberships, activeEmployeeCards] = await Promise.all([
    prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: { select: { id: true, discordUsername: true } } },
      orderBy: { user: { discordUsername: "asc" } },
    }),
    prisma.altaEmployeeCard.findMany({
      where: { companyId, status: { not: "CLOSED" } },
      select: { authorizedUserId: true },
    }),
  ]);

  const activeCardUserIds = new Set(activeEmployeeCards.map((card) => card.authorizedUserId));

  return memberships.map((membership) => ({
    userId: membership.userId,
    username: membership.user.discordUsername,
    role: membership.role.toLowerCase(),
    hasActiveEmployeeCard: activeCardUserIds.has(membership.userId),
  }));
}

export async function getAltaCardDetail(userId: string, cardId: string): Promise<AltaCardDetail> {
  const card = await getCardOrThrow(cardId);
  await assertCardAccess(userId, card);
  if (card.cardType === "BUSINESS") {
    const { reconcileBusinessCardLedger } = await import("@/server/alta-card-transaction.service");
    await reconcileBusinessCardLedger(prisma, cardId);
    const refreshed = await getCardOrThrow(cardId);
    const { listAltaCardTransactions } = await import("@/server/alta-card-transaction.service");
    const recentTransactions = await listAltaCardTransactions(cardId, { limit: 50 });
    return mapAltaCardDetail(refreshed, recentTransactions);
  }
  const { listAltaCardTransactions } = await import("@/server/alta-card-transaction.service");
  const recentTransactions = await listAltaCardTransactions(cardId, { limit: 50 });
  return mapAltaCardDetail(card, recentTransactions);
}

export async function createPersonalAltaCardApplication(
  userId: string,
  input: CreatePersonalAltaCardApplicationInput,
): Promise<AltaCardApplicationRow> {
  const { assertCreditDeskAcceptingApplications } = await import("@/server/platform-settings.service");
  await assertCreditDeskAcceptingApplications();

  const user = await getAltaUser(userId);
  if (!input.acknowledged) badRequest("You must acknowledge the application terms");
  if (input.requestedTier === "gold" && !isPrivateClient(user)) {
    badRequest("Alta Gold is invitation only — contact Alta Private");
  }

  const existingCard = await prisma.altaCard.findFirst({
    where: {
      ownerUserId: userId,
      cardType: "PERSONAL",
      status: { not: "CLOSED" },
    },
  });
  if (existingCard) badRequest("You already have a personal Alta Card");

  const pendingApplication = await prisma.altaCardApplication.findFirst({
    where: blockingPersonalApplicationWhere(userId),
  });
  if (pendingApplication) badRequest("You already have a pending Alta Card application");

  if (input.paymentSourceAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: input.paymentSourceAccountId, userId, companyId: null, status: "ACTIVE" },
    });
    if (!account) badRequest("Select a valid payment source account");
  }

  const application = await prisma.altaCardApplication.create({
    data: {
      applicantUserId: userId,
      cardType: "PERSONAL",
      requestedTier: toDbAltaCardTier(input.requestedTier),
      requestedLimit: input.requestedLimit != null ? toDecimal(input.requestedLimit) : undefined,
      purpose: input.purpose?.trim() || null,
      paymentSourceAccountId: input.paymentSourceAccountId ?? null,
      status: "SUBMITTED",
    },
    include: altaCardApplicationInclude,
  });

  await createThreadForAltaCardApplication(userId, application.id);

  await writeAuditLog({
    actorUserId: userId,
    action: "ALTA_CARD_APPLICATION_CREATED",
    entityType: "ALTA_CARD",
    entityId: application.id,
    description: `Personal Alta Card application submitted (${input.requestedTier})`,
    targetUserId: userId,
    metadata: {
      applicationId: application.id,
      applicantUserId: userId,
      requestedTier: input.requestedTier,
      requestedLimit: input.requestedLimit ?? null,
      actorUserId: userId,
    },
  });

  return mapAltaCardApplicationRow(application);
}

export async function createBusinessAltaCardApplication(
  userId: string,
  input: CreateBusinessAltaCardApplicationInput,
): Promise<AltaCardApplicationRow> {
  const { assertCreditDeskAcceptingApplications } = await import("@/server/platform-settings.service");
  await assertCreditDeskAcceptingApplications();

  const user = await getAltaUser(userId);
  if (!input.acknowledged) badRequest("You must acknowledge the application terms");
  if (!canManageBusinessTreasury(user, { companyId: input.companyId })) forbidden();
  if (input.requestedTier === "gold" && !isPrivateClient(user)) {
    badRequest("Alta Gold is invitation only — contact Alta Private");
  }

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) notFound();
  if (company.verificationStatus !== "VERIFIED") {
    badRequest("Company must be verified before applying for a business Alta Card");
  }

  const existingCard = await prisma.altaCard.findFirst({
    where: {
      companyId: input.companyId,
      cardType: "BUSINESS",
      status: { not: "CLOSED" },
    },
  });
  if (existingCard) badRequest("This company already has a business Alta Card");

  const pendingApplication = await prisma.altaCardApplication.findFirst({
    where: blockingBusinessApplicationWhere(input.companyId),
  });
  if (pendingApplication) badRequest("This company already has a pending Alta Card application");

  const application = await prisma.altaCardApplication.create({
    data: {
      applicantUserId: userId,
      companyId: input.companyId,
      cardType: "BUSINESS",
      requestedTier: toDbAltaCardTier(input.requestedTier),
      requestedLimit: input.requestedLimit != null ? toDecimal(input.requestedLimit) : undefined,
      purpose: input.purpose?.trim() || null,
      expectedMonthlySpend:
        input.expectedMonthlySpend != null ? toDecimal(input.expectedMonthlySpend) : undefined,
      employeeCardsNeeded: input.employeeCardsNeeded ?? null,
      status: "SUBMITTED",
    },
    include: altaCardApplicationInclude,
  });

  await createThreadForAltaCardApplication(userId, application.id);

  await writeAuditLog({
    actorUserId: userId,
    action: "ALTA_CARD_APPLICATION_CREATED",
    entityType: "ALTA_CARD",
    entityId: application.id,
    description: `Business Alta Card application submitted for ${company.name}`,
    targetUserId: userId,
    targetCompanyId: input.companyId,
    metadata: {
      applicationId: application.id,
      applicantUserId: userId,
      companyId: input.companyId,
      requestedTier: input.requestedTier,
      requestedLimit: input.requestedLimit ?? null,
      actorUserId: userId,
    },
  });

  return mapAltaCardApplicationRow(application);
}

export {
  approveAltaCardApplication,
  denyAltaCardApplication,
  acceptAltaCardApplication,
  updateAltaCardApplicationStatus,
  getAltaCardApplicationDetail,
  getUserPendingAltaCardApplication,
  listInternalAltaCardApplicationsFiltered,
  getInternalAltaCardApplicationReviewContext,
} from "@/server/alta-card-application.service";

export async function activateAltaCard(actorUserId: string, cardId: string): Promise<AltaCardRow> {
  const card = await getCardOrThrow(cardId);
  const user = await assertCardAccess(actorUserId, card);
  const isStaff = isAdmin(user) || isOperator(user);

  if (card.status !== "PENDING") badRequest("Only pending cards can be activated");
  if (!isStaff && card.cardType === "PERSONAL" && card.ownerUserId !== actorUserId) forbidden();

  const updated = await prisma.$transaction(async (tx) => {
    const activated = await tx.altaCard.update({
      where: { id: cardId },
      data: {
        status: "ACTIVE",
        openedAt: new Date(),
      },
      include: altaCardInclude,
    });

    const { initializeBillingCycleForCard } = await import("@/server/alta-card-statement.service");
    await initializeBillingCycleForCard(tx, cardId, new Date());

    return tx.altaCard.findUnique({ where: { id: cardId }, include: altaCardInclude });
  });

  if (!updated) notFound();

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_ACTIVATED",
    "Alta Card activated",
    cardId,
    undefined,
    card.ownerUserId,
    card.companyId,
  );

  try {
    const { notifyAltaCardActivated } = await import("@/server/banking-notification.service");
    await notifyAltaCardActivated(card.ownerUserId, cardId, card.cardLastFour);
  } catch (error) {
    console.error("[alta-card] activation notification failed", error);
  }

  return mapAltaCardRow(updated);
}

export async function freezeAltaCard(actorUserId: string, cardId: string): Promise<AltaCardRow> {
  const card = await getCardOrThrow(cardId);
  await assertCardAccess(actorUserId, card);
  if (card.status !== "ACTIVE") badRequest("Only active cards can be frozen");

  const updated = await prisma.altaCard.update({
    where: { id: cardId },
    data: { status: "FROZEN" },
    include: altaCardInclude,
  });

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_FROZEN",
    "Alta Card frozen",
    cardId,
    undefined,
    card.ownerUserId,
    card.companyId,
  );

  return mapAltaCardRow(updated);
}

export async function unfreezeAltaCard(actorUserId: string, cardId: string): Promise<AltaCardRow> {
  const card = await getCardOrThrow(cardId);
  await assertCardAccess(actorUserId, card);
  if (card.status !== "FROZEN") badRequest("Only frozen cards can be unfrozen");

  const updated = await prisma.altaCard.update({
    where: { id: cardId },
    data: { status: "ACTIVE" },
    include: altaCardInclude,
  });

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_UNFROZEN",
    "Alta Card unfrozen",
    cardId,
    undefined,
    card.ownerUserId,
    card.companyId,
  );

  return mapAltaCardRow(updated);
}

export async function closeAltaCard(actorUserId: string, cardId: string): Promise<AltaCardRow> {
  const card = await getCardOrThrow(cardId);
  const user = await assertCardAccess(actorUserId, card);
  const isStaff = isAdmin(user) || isOperator(user);
  if (!isStaff && card.cardType === "BUSINESS") forbidden();
  if (card.status === "CLOSED") badRequest("Card is already closed");

  const updated = await prisma.altaCard.update({
    where: { id: cardId },
    data: { status: "CLOSED", closedAt: new Date() },
    include: altaCardInclude,
  });

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_CLOSED",
    "Alta Card closed",
    cardId,
    undefined,
    card.ownerUserId,
    card.companyId,
  );

  return mapAltaCardRow(updated);
}

/** @deprecated Do not call from UI. Use alta-card-admin.service.ts (updateAltaCardLimitAdmin). */
export async function updateAltaCardLimit(
  adminUserId: string,
  input: UpdateAltaCardLimitInput,
): Promise<AltaCardRow> {
  void adminUserId;
  void input;
  badRequest("Use the internal card detail ops panel to change credit limits.");
}

/** @deprecated Do not call from UI. Use alta-card-admin.service.ts (updateAltaCardRateAdmin). */
export async function updateAltaCardRate(
  adminUserId: string,
  input: UpdateAltaCardRateInput,
): Promise<AltaCardRow> {
  void adminUserId;
  void input;
  badRequest("Use the internal card detail ops panel to change interest rates.");
}

/** @deprecated Do not call from UI. Use alta-card-admin.service.ts (changeAltaCardTierAdmin). */
export async function changeAltaCardTier(
  adminUserId: string,
  input: ChangeAltaCardTierInput,
): Promise<AltaCardRow> {
  void adminUserId;
  void input;
  badRequest("Use the internal card detail ops panel to change card tier.");
}

export async function createEmployeeCard(
  actorUserId: string,
  input: CreateEmployeeCardInput,
): Promise<AltaEmployeeCardRow> {
  const user = await getAltaUser(actorUserId);
  if (!canManageBusinessTreasury(user, { companyId: input.companyId })) forbidden();
  if (input.employeeSpendLimit <= 0) badRequest("Employee spend limit must be greater than zero");

  const employeeCard = await prisma.$transaction(async (tx) => {
    const businessCard = await tx.altaCard.findFirst({
      where: {
        companyId: input.companyId,
        cardType: "BUSINESS",
        status: "ACTIVE",
      },
    });
    if (!businessCard) badRequest("Company must have an active business Alta Card");

    const { syncBusinessCardAvailableCredit } = await import("@/server/alta-card-transaction.service");
    await syncBusinessCardAvailableCredit(tx, businessCard.id);
    const refreshedBusinessCard = await tx.altaCard.findUnique({ where: { id: businessCard.id } });
    const companyAvailable = Number(refreshedBusinessCard?.availableCredit ?? businessCard.availableCredit);
    if (input.employeeSpendLimit > companyAvailable) {
      badRequest("Employee spend limit cannot exceed company available credit");
    }

    const membership = await tx.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: input.authorizedUserId,
          companyId: input.companyId,
        },
      },
    });
    if (!membership) badRequest("Authorized user must be a company member");

    const existingEmployeeCard = await tx.altaEmployeeCard.findFirst({
      where: {
        companyId: input.companyId,
        authorizedUserId: input.authorizedUserId,
        status: { not: "CLOSED" },
      },
    });
    if (existingEmployeeCard) badRequest("This member already has an active employee card");

    const created = await tx.altaEmployeeCard.create({
      data: {
        companyId: input.companyId,
        authorizedUserId: input.authorizedUserId,
        parentBusinessCardId: businessCard.id,
        status: "ACTIVE",
        employeeSpendLimit: toDecimal(input.employeeSpendLimit),
        employeeAvailableLimit: toDecimal(input.employeeSpendLimit),
        cardLastFour: randomCardLastFour(),
        openedAt: new Date(),
      },
      include: {
        authorizedUser: { select: { discordUsername: true } },
        company: { select: { name: true } },
      },
    });

    await syncBusinessCardAvailableCredit(tx, businessCard.id);
    return created;
  });

  await writeAuditLog({
    actorUserId,
    action: "ALTA_EMPLOYEE_CARD_CREATED",
    entityType: "ALTA_CARD",
    entityId: employeeCard.id,
    description: `Employee Alta Card created for ${employeeCard.authorizedUser.discordUsername}`,
    targetUserId: input.authorizedUserId,
    targetCompanyId: input.companyId,
    metadata: {
      parentBusinessCardId: employeeCard.parentBusinessCardId,
      employeeSpendLimit: input.employeeSpendLimit,
    },
  });

  return mapAltaEmployeeCardRow(employeeCard);
}

export async function updateEmployeeCardLimit(
  actorUserId: string,
  input: UpdateEmployeeCardLimitInput,
): Promise<AltaEmployeeCardRow> {
  const employeeCard = await prisma.altaEmployeeCard.findUnique({
    where: { id: input.employeeCardId },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
      parentBusinessCard: true,
    },
  });
  if (!employeeCard) notFound();

  const user = await getAltaUser(actorUserId);
  const isStaff = isAdmin(user) || isOperator(user);
  if (!isStaff && !canManageBusinessTreasury(user, { companyId: employeeCard.companyId })) {
    forbidden();
  }

  if (input.employeeSpendLimit <= 0) badRequest("Employee spend limit must be greater than zero");

  const { syncBusinessCardAvailableCredit } = await import("@/server/alta-card-transaction.service");
  await syncBusinessCardAvailableCredit(prisma, employeeCard.parentBusinessCardId);
  const refreshedParent = await prisma.altaCard.findUnique({
    where: { id: employeeCard.parentBusinessCardId },
  });

  const balance = Number(employeeCard.employeeCurrentBalance);
  const currentReserved = Number(employeeCard.employeeSpendLimit) - balance;
  const newReserved = input.employeeSpendLimit - balance;
  const reserveIncrease = roundMoney(newReserved - currentReserved);
  const companyAvailable = Number(refreshedParent?.availableCredit ?? employeeCard.parentBusinessCard.availableCredit);
  if (reserveIncrease > companyAvailable) {
    badRequest("Employee spend limit cannot exceed company available credit");
  }

  const available = Math.max(0, input.employeeSpendLimit - balance);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.altaEmployeeCard.update({
      where: { id: input.employeeCardId },
      data: {
        employeeSpendLimit: toDecimal(input.employeeSpendLimit),
        employeeAvailableLimit: toDecimal(available),
      },
      include: {
        authorizedUser: { select: { discordUsername: true } },
        company: { select: { name: true } },
      },
    });

    const { syncBusinessCardAvailableCredit } = await import("@/server/alta-card-transaction.service");
    await syncBusinessCardAvailableCredit(tx, employeeCard.parentBusinessCardId);
    return row;
  });

  await writeAuditLog({
    actorUserId,
    action: "ALTA_EMPLOYEE_CARD_LIMIT_CHANGED",
    entityType: "ALTA_CARD",
    entityId: employeeCard.id,
    description: `Employee card limit changed to ${input.employeeSpendLimit}`,
    targetUserId: employeeCard.authorizedUserId,
    targetCompanyId: employeeCard.companyId,
    metadata: {
      previousLimit: Number(employeeCard.employeeSpendLimit),
      newLimit: input.employeeSpendLimit,
    },
  });

  return mapAltaEmployeeCardRow(updated);
}

export async function freezeEmployeeCard(
  actorUserId: string,
  employeeCardId: string,
): Promise<AltaEmployeeCardRow> {
  const employeeCard = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
  });
  if (!employeeCard) notFound();

  const user = await getAltaUser(actorUserId);
  const isStaff = isAdmin(user) || isOperator(user);
  if (!isStaff && !canManageBusinessTreasury(user, { companyId: employeeCard.companyId })) {
    forbidden();
  }
  if (employeeCard.status !== "ACTIVE") badRequest("Only active employee cards can be frozen");

  const updated = await prisma.altaEmployeeCard.update({
    where: { id: employeeCardId },
    data: { status: "FROZEN" },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
  });

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_FROZEN",
    "Employee Alta Card frozen",
    employeeCardId,
    { employeeCard: true },
    employeeCard.authorizedUserId,
    employeeCard.companyId,
  );

  return mapAltaEmployeeCardRow(updated);
}

export async function closeEmployeeCard(
  actorUserId: string,
  employeeCardId: string,
): Promise<AltaEmployeeCardRow> {
  const employeeCard = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
      parentBusinessCard: { select: { id: true } },
    },
  });
  if (!employeeCard) notFound();

  const user = await getAltaUser(actorUserId);
  const isStaff = isAdmin(user) || isOperator(user);
  if (!isStaff && !canManageBusinessTreasury(user, { companyId: employeeCard.companyId })) {
    forbidden();
  }
  if (employeeCard.status === "CLOSED") badRequest("Employee card is already closed");

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.altaEmployeeCard.update({
      where: { id: employeeCardId },
      data: { status: "CLOSED", closedAt: new Date() },
      include: {
        authorizedUser: { select: { discordUsername: true } },
        company: { select: { name: true } },
      },
    });

    const { syncBusinessCardAvailableCredit } = await import("@/server/alta-card-transaction.service");
    await syncBusinessCardAvailableCredit(tx, employeeCard.parentBusinessCard.id);
    return row;
  });

  await auditCardEvent(
    actorUserId,
    "ALTA_CARD_CLOSED",
    "Employee Alta Card closed",
    employeeCardId,
    { employeeCard: true },
    employeeCard.authorizedUserId,
    employeeCard.companyId,
  );

  return mapAltaEmployeeCardRow(updated);
}

export async function listInternalAltaCards(
  filters: InternalAltaCardFilters = {},
): Promise<AltaCardRow[]> {
  const and: Prisma.AltaCardWhereInput[] = [];
  if (filters.tier) and.push({ tier: toDbAltaCardTier(filters.tier) });
  if (filters.status) and.push({ status: toDbAltaCardStatus(filters.status) });
  if (filters.cardType) and.push({ cardType: toDbAltaCardType(filters.cardType) });
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { owner: { discordUsername: { contains: q, mode: "insensitive" } } },
        { company: { name: { contains: q, mode: "insensitive" } } },
        { cardLastFour: { contains: q } },
      ],
    });
  }

  const cards = await prisma.altaCard.findMany({
    where: and.length ? { AND: and } : undefined,
    include: altaCardInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return cards.map(mapAltaCardRow);
}

export async function listInternalAltaCardApplications(): Promise<AltaCardApplicationRow[]> {
  const { listInternalAltaCardApplicationsFiltered } = await import(
    "@/server/alta-card-application.service"
  );
  return listInternalAltaCardApplicationsFiltered();
}

export async function getAltaCardApplyContext(userId: string): Promise<{
  personalCard: AltaCardRow | null;
  pendingPersonalApplication: AltaCardApplicationRow | null;
  businessCompanies: { id: string; name: string; hasCard: boolean; hasPendingApplication: boolean }[];
  paymentSourceAccounts: { id: string; accountName: string; accountNumber: string }[];
  isPrivateClient: boolean;
  defaultLimits: typeof ALTA_CARD_DEFAULT_LIMITS;
  defaultRates: typeof ALTA_CARD_DEFAULT_RATES;
}> {
  const user = await getAltaUser(userId);
  const personalCard = await prisma.altaCard.findFirst({
    where: {
      ownerUserId: userId,
      cardType: "PERSONAL",
      status: { not: "CLOSED" },
    },
    include: altaCardInclude,
    orderBy: { createdAt: "desc" },
  });

  const pendingPersonalApplication = await prisma.altaCardApplication.findFirst({
    where: blockingPersonalApplicationWhere(userId),
    include: altaCardApplicationInclude,
  });

  const treasuryCompanyIds = user.companyMemberships
    .filter((m) => canManageBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);

  const [businessCards, pendingBusinessApps] = await Promise.all([
    prisma.altaCard.findMany({
      where: {
        companyId: { in: treasuryCompanyIds },
        cardType: "BUSINESS",
        status: { not: "CLOSED" },
      },
      select: { companyId: true },
    }),
    prisma.altaCardApplication.findMany({
      where: {
        companyId: { in: treasuryCompanyIds },
        cardType: "BUSINESS",
        status: { in: [...BLOCKING_ALTA_CARD_APPLICATION_STATUSES] },
        acceptedAt: null,
        card: { is: null },
      },
      select: { companyId: true },
    }),
  ]);

  const cardCompanyIds = new Set(businessCards.map((c) => c.companyId).filter(Boolean));
  const pendingCompanyIds = new Set(pendingBusinessApps.map((a) => a.companyId).filter(Boolean));

  const businessCompanies = user.companyMemberships
    .filter((m) => treasuryCompanyIds.includes(m.companyId))
    .map((m) => ({
      id: m.companyId,
      name: m.companyName,
      hasCard: cardCompanyIds.has(m.companyId),
      hasPendingApplication: pendingCompanyIds.has(m.companyId),
    }));

  const paymentSourceAccounts = await prisma.bankAccount.findMany({
    where: { userId, companyId: null, status: "ACTIVE" },
    select: { id: true, accountName: true, accountNumber: true },
    orderBy: { accountName: "asc" },
  });

  return {
    personalCard: personalCard ? mapAltaCardRow(personalCard) : null,
    pendingPersonalApplication: pendingPersonalApplication
      ? mapAltaCardApplicationRow(pendingPersonalApplication)
      : null,
    businessCompanies,
    paymentSourceAccounts,
    isPrivateClient: isPrivateClient(user),
    defaultLimits: ALTA_CARD_DEFAULT_LIMITS,
    defaultRates: ALTA_CARD_DEFAULT_RATES,
  };
}

export async function listUserBusinessAltaCardCompanies(userId: string): Promise<
  {
    companyId: string;
    companyName: string;
    businessCard: AltaCardRow | null;
    pendingApplication: AltaCardApplicationRow | null;
  }[]
> {
  const user = await getAltaUser(userId);
  const treasuryMemberships = user.companyMemberships.filter(
    (membership) =>
      membership.role !== "viewer" &&
      (canViewCompanyAltaCard(user, membership.companyId) ||
        isAdmin(user) ||
        isOperator(user)),
  );

  const results = await Promise.all(
    treasuryMemberships.map(async (m) => {
      const [resolvedCard, pendingApplication] = await Promise.all([
        resolveCompanyBusinessCard(m.companyId),
        getPendingBusinessApplicationForCompany(m.companyId),
      ]);
      const aggregated = resolvedCard
        ? await loadAggregatedCompanyBusinessCard(m.companyId, resolvedCard.id)
        : { businessCard: null, hasMultipleBusinessCards: false };
      return {
        companyId: m.companyId,
        companyName: m.companyName,
        businessCard: aggregated.businessCard,
        pendingApplication,
      };
    }),
  );

  return results;
}

const employeeCardListInclude = {
  authorizedUser: { select: { discordUsername: true } },
  company: { select: { name: true } },
  parentBusinessCard: {
    select: {
      tier: true,
      autopayEnabled: true,
      autopaySourceAccountId: true,
      autopayType: true,
      autopayFixedAmount: true,
      autopayLastRunAt: true,
      autopayLastStatus: true,
      autopayFailureReason: true,
      autopaySourceAccount: { select: { accountName: true, accountNumber: true } },
    },
  },
} as const;

export async function listUserEmployeeAltaCards(userId: string): Promise<UserEmployeeAltaCardSummary[]> {
  const cards = await prisma.altaEmployeeCard.findMany({
    where: {
      authorizedUserId: userId,
      status: { not: "CLOSED" },
    },
    include: employeeCardListInclude,
    orderBy: { createdAt: "desc" },
  });

  return cards.map((row) => ({
    ...mapAltaEmployeeCardRow(row),
    parentTier: toAltaCardTierCode(row.parentBusinessCard.tier),
  }));
}

export async function getUserEmployeeAltaCardDetail(
  userId: string,
  employeeCardId: string,
): Promise<UserEmployeeAltaCardDetail> {
  const card = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: employeeCardListInclude,
  });
  if (!card) notFound();
  if (card.authorizedUserId !== userId) forbidden();

  const { listEmployeeCardTransactions, reconcileBusinessCardLedger } = await import(
    "@/server/alta-card-transaction.service"
  );
  await reconcileBusinessCardLedger(prisma, card.parentBusinessCardId);
  const recentTransactions = await listEmployeeCardTransactions(employeeCardId, 50);

  const refreshedEmployee = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: employeeCardListInclude,
  });
  if (!refreshedEmployee) notFound();

  return {
    ...mapAltaEmployeeCardRow(refreshedEmployee),
    parentTier: toAltaCardTierCode(refreshedEmployee.parentBusinessCard.tier),
    recentTransactions,
    parentAutopay: mapAutopaySettingsForCard(refreshedEmployee.parentBusinessCard, { canManage: false }),
  };
}
