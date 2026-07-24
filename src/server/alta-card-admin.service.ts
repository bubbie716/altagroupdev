import { randomBytes } from "node:crypto";
import { Prisma, type AltaCardStatus } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type {
  AltaCardDetail,
  AltaCardRow,
  AltaCardStatusCode,
  AltaCardTierCode,
  AltaCardTransactionRow,
  AltaEmployeeCardRow,
  ChangeAltaCardTierInput,
  CreateAltaCardAdjustmentInput,
  InternalAltaCardOperationsContext,
  UpdateAltaCardLimitInput,
  UpdateAltaCardRateInput,
} from "@/lib/bank/alta-card-types";
import { altaCardPaymentDescription } from "@/lib/bank/customer-transaction-copy";
import { getTierDefaultLimit, getTierDefaultRate } from "@/lib/bank/alta-card-tier-config";
import { canAccessBankInternal, isAdmin, isPrivateClient } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import {
  altaCardInclude,
  mapAltaCardDetail,
  mapAltaCardRow,
  mapAltaCardTransactionRow,
  mapAltaEmployeeCardRow,
  toDbAltaCardStatus,
  toDbAltaCardTier,
  altaCardTransactionInclude,
} from "@/server/alta-card-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  getAltaCardRelationshipRecommendation,
  type AltaCardRelationshipRecommendation,
} from "@/server/alta-card-relationship-pricing.service";

const PAYMENT_ALLOWED_STATUSES: AltaCardStatus[] = ["ACTIVE", "FROZEN", "DELINQUENT"];

const STATUS_TRANSITIONS: Record<AltaCardStatusCode, AltaCardStatusCode[]> = {
  pending: ["active"],
  active: ["frozen", "lost", "closed", "delinquent"],
  frozen: ["active"],
  lost: ["closed"],
  expired: ["closed"],
  closed: [],
  delinquent: ["active"],
};

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

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateCardTxReference(prefix: string): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ACARD-${prefix}-${date}-${suffix}`;
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
  if (!canAccessBankInternal(user)) forbidden();
}

function assertAdmin(user: AltaUser): void {
  if (!canAccessBankInternal(user)) forbidden();
}

async function auditAdminEvent(
  actorUserId: string,
  action: string,
  cardId: string,
  description: string,
  metadata: Record<string, unknown>,
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
    metadata: { cardId, actorUserId, ...metadata },
  });
}

async function getCardOrThrow(cardId: string) {
  const card = await prisma.altaCard.findUnique({ where: { id: cardId }, include: altaCardInclude });
  if (!card) notFound();
  return card;
}

export type AdminCardActionInput = {
  cardId: string;
  reason: string;
  adminOverride?: boolean;
};

export type ChangeCardStatusInput = AdminCardActionInput & {
  status: AltaCardStatusCode;
};

export type UpdateCardLimitAdminInput = UpdateAltaCardLimitInput &
  AdminCardActionInput;

export type UpdateCardRateAdminInput = UpdateAltaCardRateInput & AdminCardActionInput;

export type ChangeCardTierAdminInput = ChangeAltaCardTierInput &
  AdminCardActionInput & {
    applyTierDefaults?: boolean;
    goldOverride?: boolean;
  };

export type AdminManualPaymentInput = AdminCardActionInput & {
  amount: number;
};

export type AdminManualFeeInput = AdminCardActionInput & {
  amount: number;
  feeType?: "late_payment" | "manual";
};

export type InternalAltaCardOperationsContext = import("@/lib/bank/alta-card-types").InternalAltaCardOperationsContext;

export async function getInternalCardOperationsContext(
  staffUserId: string,
  cardId: string,
): Promise<InternalAltaCardOperationsContext> {
  const staff = await getAltaUser(staffUserId);
  assertOperatorOrAdmin(staff);

  const card = await getCardOrThrow(cardId);
  const { listAltaCardTransactions } = await import("@/server/alta-card-transaction.service");
  const recentTransactions = await listAltaCardTransactions(cardId, { limit: 50 });

  const lastPayment =
    recentTransactions.find((t) => t.type === "payment" && t.status === "completed") ?? null;
  const lastTransaction = recentTransactions[0] ?? null;

  const mappedCard = mapAltaCardDetail(card, recentTransactions);
  const utilization =
    mappedCard.creditLimit > 0
      ? roundMoney((mappedCard.currentBalance / mappedCard.creditLimit) * 100)
      : 0;

  const relationship = await getAltaCardRelationshipRecommendation(
    card.ownerUserId ?? staffUserId,
    card.companyId,
  );

  await auditAdminEvent(
    staffUserId,
    "ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED",
    cardId,
    "Relationship pricing recommendation viewed",
    {
      relationshipScore: relationship.relationshipScore,
      recommendedTier: relationship.recommendedTier,
    },
    card.ownerUserId,
    card.companyId,
  );

  const tier = card.tier.toLowerCase() as AltaCardTierCode;

  const employeeMemberOptions =
    card.companyId && card.cardType === "BUSINESS"
      ? await (
          await import("@/server/alta-card.service")
        ).listCompanyEmployeeCardMemberOptions(staffUserId, card.companyId)
      : [];

  return {
    card: mappedCard,
    utilization,
    lastPayment,
    lastTransaction,
    relationship,
    tierDefaultLimit: getTierDefaultLimit(tier),
    tierDefaultRate: getTierDefaultRate(tier),
    employeeMemberOptions,
  };
}

export async function changeAltaCardStatus(
  actorUserId: string,
  input: ChangeCardStatusInput,
): Promise<AltaCardRow> {
  const actor = await getAltaUser(actorUserId);
  assertOperatorOrAdmin(actor);
  if (!input.reason.trim()) badRequest("Reason is required");

  const card = await getCardOrThrow(input.cardId);
  const current = card.status.toLowerCase() as AltaCardStatusCode;
  const target = input.status;

  if (current === "closed" && target !== "closed") {
    if (!canAccessBankInternal(actor) || !input.adminOverride) {
      badRequest("Closed cards cannot be reopened without admin override");
    }
  }

  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (target !== current && !allowed.includes(target) && !(current === "closed" && input.adminOverride)) {
    badRequest(`Cannot transition from ${current} to ${target}`);
  }

  const data: Prisma.AltaCardUpdateInput = {
    status: toDbAltaCardStatus(target),
  };
  if (target === "closed") data.closedAt = new Date();
  if (target === "active" && current === "pending") data.openedAt = new Date();

  const updated = await prisma.altaCard.update({
    where: { id: input.cardId },
    data,
    include: altaCardInclude,
  });

  if (target === "active" && current === "pending") {
    const { initializeBillingCycleForCard } = await import("@/server/alta-card-statement.service");
    await prisma.$transaction((tx) => initializeBillingCycleForCard(tx, input.cardId, new Date()));
  }

  await auditAdminEvent(
    actorUserId,
    "ALTA_CARD_STATUS_CHANGED",
    input.cardId,
    `Card status changed to ${target}`,
    {
      oldValue: current,
      newValue: target,
      reason: input.reason.trim(),
      adminOverride: input.adminOverride ?? false,
    },
    card.ownerUserId,
    card.companyId,
  );

  return mapAltaCardRow(updated);
}

export async function updateAltaCardLimitAdmin(
  adminUserId: string,
  input: UpdateCardLimitAdminInput,
): Promise<AltaCardRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (!input.reason.trim()) badRequest("Reason is required");
  if (input.creditLimit <= 0) badRequest("Credit limit must be greater than zero");

  const card = await getCardOrThrow(input.cardId);
  const balance = decimalToNumber(card.currentBalance);
  const previousLimit = decimalToNumber(card.creditLimit);

  if (input.creditLimit < balance) {
    if (!canAccessBankInternal(admin) || !input.adminOverride) {
      badRequest("New limit cannot be below current balance without admin override");
    }
  }

  const availableCredit = Math.max(0, input.creditLimit - balance);

  const updated = await prisma.altaCard.update({
    where: { id: input.cardId },
    data: {
      creditLimit: toDecimal(input.creditLimit),
      availableCredit: toDecimal(availableCredit),
    },
    include: altaCardInclude,
  });

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_LIMIT_CHANGED",
    input.cardId,
    `Credit limit changed to ${input.creditLimit}`,
    {
      oldValue: previousLimit,
      newValue: input.creditLimit,
      previousLimit,
      newLimit: input.creditLimit,
      reason: input.reason.trim(),
      adminOverride: input.adminOverride ?? false,
    },
    card.ownerUserId,
    card.companyId,
  );

  if (card.ownerUserId && input.creditLimit > previousLimit) {
    const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
    const { formatAltaCardLimitIncreaseTimelineCopy } = await import(
      "@/lib/bank/relationship-timeline-historical"
    );
    const upgradeCopy = formatAltaCardLimitIncreaseTimelineCopy(previousLimit, input.creditLimit, {
      business: !!card.companyId,
    });
    const timelineEvent = {
      eventType: "ALTA_CARD_LIMIT_CHANGED" as const,
      title: upgradeCopy.title,
      description: upgradeCopy.description ?? undefined,
      occurredAt: new Date(),
      relatedEntityType: "ALTA_CARD" as const,
      relatedEntityId: input.cardId,
      metadata: { previousLimit, newLimit: input.creditLimit },
      dedupeKey: `limit:${input.cardId}:${input.creditLimit}`,
      actorUserId: adminUserId,
    };
    if (card.companyId) {
      const { recordCompanyTimelineEventIfBusiness } = await import(
        "@/server/company-relationship-timeline.service"
      );
      await recordCompanyTimelineEventIfBusiness(card.companyId, timelineEvent);
    } else {
      await recordRelationshipTimelineEvent({
        userId: card.ownerUserId,
        ...timelineEvent,
      });
    }
  }

  const { refreshFromAltaCardContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
  await refreshFromAltaCardContextBestEffort(
    { ownerUserId: card.ownerUserId, companyId: card.companyId },
    "alta-card-limit-changed",
  );

  return mapAltaCardRow(updated);
}

export async function updateAltaCardRateAdmin(
  adminUserId: string,
  input: UpdateCardRateAdminInput,
): Promise<AltaCardRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (!input.reason.trim()) badRequest("Reason is required");
  if (input.interestRate < 0) badRequest("Interest rate cannot be negative");

  const card = await getCardOrThrow(input.cardId);
  const previousRate = decimalToNumber(card.interestRate);

  const updated = await prisma.altaCard.update({
    where: { id: input.cardId },
    data: { interestRate: toDecimal(input.interestRate) },
    include: altaCardInclude,
  });

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_RATE_CHANGED",
    input.cardId,
    `Interest rate changed to ${input.interestRate}%`,
    {
      oldValue: previousRate,
      newValue: input.interestRate,
      previousRate,
      newRate: input.interestRate,
      reason: input.reason.trim(),
    },
    card.ownerUserId,
    card.companyId,
  );

  if (card.ownerUserId && input.interestRate < previousRate) {
    const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
    const { formatAltaCardRateReductionTimelineCopy } = await import(
      "@/lib/bank/relationship-timeline-historical"
    );
    const reductionCopy = formatAltaCardRateReductionTimelineCopy(previousRate, input.interestRate, {
      business: !!card.companyId,
    });
    const timelineEvent = {
      eventType: "ALTA_CARD_RATE_CHANGED" as const,
      title: reductionCopy.title,
      description: reductionCopy.description ?? undefined,
      occurredAt: new Date(),
      relatedEntityType: "ALTA_CARD" as const,
      relatedEntityId: input.cardId,
      metadata: { previousRate, newRate: input.interestRate },
      dedupeKey: `rate:${input.cardId}:${input.interestRate}`,
      actorUserId: adminUserId,
    };
    if (card.companyId) {
      const { recordCompanyTimelineEventIfBusiness } = await import(
        "@/server/company-relationship-timeline.service"
      );
      await recordCompanyTimelineEventIfBusiness(card.companyId, timelineEvent);
    } else {
      await recordRelationshipTimelineEvent({
        userId: card.ownerUserId,
        ...timelineEvent,
      });
    }
  }

  return mapAltaCardRow(updated);
}

export async function changeAltaCardTierAdmin(
  adminUserId: string,
  input: ChangeCardTierAdminInput,
): Promise<AltaCardRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (!input.reason.trim()) badRequest("Reason is required");

  const card = await getCardOrThrow(input.cardId);
  const previousTier = card.tier.toLowerCase() as AltaCardTierCode;

  if (input.tier === "gold") {
    if (!canAccessBankInternal(admin)) forbidden();
    if (card.ownerUserId) {
      const owner = await getAltaUser(card.ownerUserId);
      if (!isPrivateClient(owner) && !input.goldOverride) {
        badRequest("Gold tier requires private client status or admin override");
      }
    }
  }

  const updateData: Prisma.AltaCardUpdateInput = {
    tier: toDbAltaCardTier(input.tier),
  };

  if (input.applyTierDefaults) {
    const defaultLimit = getTierDefaultLimit(input.tier);
    const defaultRate = getTierDefaultRate(input.tier);
    if (defaultLimit != null) {
      const balance = decimalToNumber(card.currentBalance);
      updateData.creditLimit = toDecimal(defaultLimit);
      updateData.availableCredit = toDecimal(Math.max(0, defaultLimit - balance));
    }
    if (defaultRate != null) {
      updateData.interestRate = toDecimal(defaultRate);
    }
  }

  const updated = await prisma.altaCard.update({
    where: { id: input.cardId },
    data: updateData,
    include: altaCardInclude,
  });

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_TIER_CHANGED",
    input.cardId,
    `Tier changed to ${input.tier}`,
    {
      oldValue: previousTier,
      newValue: input.tier,
      previousTier,
      newTier: input.tier,
      applyTierDefaults: input.applyTierDefaults ?? false,
      reason: input.reason.trim(),
      goldOverride: input.goldOverride ?? false,
    },
    card.ownerUserId,
    card.companyId,
  );

  if (card.ownerUserId) {
    const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
    const { formatAltaCardTierUpgradeTimelineCopy } = await import("@/lib/bank/relationship-timeline-historical");
    const upgradeCopy = formatAltaCardTierUpgradeTimelineCopy(previousTier, input.tier, {
      business: !!card.companyId,
    });
    const timelineEvent = {
      eventType: "ALTA_CARD_TIER_CHANGED" as const,
      title: upgradeCopy.title,
      description: upgradeCopy.description ?? undefined,
      occurredAt: new Date(),
      relatedEntityType: "ALTA_CARD" as const,
      relatedEntityId: input.cardId,
      metadata: { previousTier, newTier: input.tier },
      dedupeKey: `tier:${input.cardId}:${input.tier}`,
      actorUserId: adminUserId,
    };
    if (card.companyId) {
      const { recordCompanyTimelineEventIfBusiness } = await import(
        "@/server/company-relationship-timeline.service"
      );
      await recordCompanyTimelineEventIfBusiness(card.companyId, {
        ...timelineEvent,
        dedupeKey: `audit:tier:${input.cardId}:${input.tier}`,
      });
    } else {
      await recordRelationshipTimelineEvent({
        userId: card.ownerUserId,
        ...timelineEvent,
      });
    }
  }

  const { refreshFromAltaCardContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
  await refreshFromAltaCardContextBestEffort(
    { ownerUserId: card.ownerUserId, companyId: card.companyId },
    "alta-card-tier-changed",
  );

  return mapAltaCardRow(updated);
}

export async function submitAdminManualCardPayment(
  adminUserId: string,
  input: AdminManualPaymentInput,
): Promise<AltaCardTransactionRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (!input.reason.trim()) badRequest("Reason is required");
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const card = await loadCardForPayment(input.cardId);
  const referenceCode = generateCardTxReference("PAY");

  const row = await prisma.$transaction(async (tx) => {
    const freshCard = await tx.altaCard.findUnique({ where: { id: card.id } });
    if (!freshCard) notFound();
    assertPaymentAllowed(freshCard.status);

    const { applyPaymentInTx } = await import("@/server/alta-card-transaction.service");
    const paymentAmount = roundMoney(Math.min(input.amount, decimalToNumber(freshCard.currentBalance)));
    if (paymentAmount <= 0) badRequest("No balance due on this card");

    await applyPaymentInTx(tx, freshCard, paymentAmount);

    const created = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        type: "PAYMENT",
        status: "COMPLETED",
        amount: toDecimal(paymentAmount),
        description: altaCardPaymentDescription(card.cardLastFour),
        referenceCode,
        createdByUserId: adminUserId,
        settledAt: new Date(),
        metadata: { adminManual: true, reason: input.reason.trim() },
      },
      include: altaCardTransactionInclude,
    });

    const { allocatePaymentToStatements } = await import("@/server/alta-card-statement.service");
    await allocatePaymentToStatements(tx, card.id, paymentAmount, adminUserId);

    return mapAltaCardTransactionRow(created);
  });

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_MANUAL_PAYMENT",
    input.cardId,
    `Manual payment of ${input.amount}`,
    { amount: input.amount, reason: input.reason.trim(), transactionId: row.id },
    card.ownerUserId,
    card.companyId,
  );

  return row;
}

export async function applyAdminManualFee(
  adminUserId: string,
  input: AdminManualFeeInput,
): Promise<{ feeId: string; transactionId: string }> {
  const admin = await getAltaUser(adminUserId);
  assertAdmin(admin);
  if (!input.reason.trim()) badRequest("Reason is required");
  if (input.amount <= 0) badRequest("Fee amount must be greater than zero");

  const { applyManualFeeForCard } = await import("@/server/alta-card-fee.service");
  const result = await applyManualFeeForCard(adminUserId, input.cardId, input.amount, input.reason.trim());

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_FEE_APPLIED",
    input.cardId,
    `Manual fee of ${input.amount} applied`,
    { feeAmount: input.amount, reason: input.reason.trim(), feeId: result.feeId },
    null,
    null,
  );

  return result;
}

export async function createAdminAdjustmentWithAudit(
  adminUserId: string,
  input: CreateAltaCardAdjustmentInput & { reason: string },
): Promise<AltaCardTransactionRow> {
  const { createAdminAltaCardAdjustment } = await import("@/server/alta-card-transaction.service");
  const row = await createAdminAltaCardAdjustment(adminUserId, input);

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_ADMIN_ADJUSTMENT",
    input.cardId,
    `Admin ${input.kind} adjustment`,
    { amount: input.amount, kind: input.kind, reason: input.reason },
    null,
    null,
  );

  return row;
}

export async function reverseAltaCardTransactionAdmin(
  adminUserId: string,
  input: { transactionId: string; reason: string },
): Promise<AltaCardTransactionRow> {
  if (!input.reason.trim()) badRequest("Reason is required");
  const { reverseAltaCardTransaction } = await import("@/server/alta-card-transaction.service");
  const row = await reverseAltaCardTransaction(adminUserId, input.transactionId, input.reason.trim());

  await auditAdminEvent(
    adminUserId,
    "ALTA_CARD_TRANSACTION_REVERSED",
    row.altaCardId,
    `Transaction ${input.transactionId} reversed`,
    { transactionId: input.transactionId, reason: input.reason.trim() },
    null,
    null,
  );

  return row;
}

export async function unfreezeEmployeeCard(
  actorUserId: string,
  employeeCardId: string,
  reason: string,
): Promise<AltaEmployeeCardRow> {
  const employeeCard = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
  });
  if (!employeeCard) notFound();
  if (!reason.trim()) badRequest("Reason is required");

  const user = await getAltaUser(actorUserId);
  const isStaff = canAccessBankInternal(user);
  const { canManageBusinessTreasury } = await import("@/lib/auth/permissions");
  if (!isStaff && !canManageBusinessTreasury(user, { companyId: employeeCard.companyId })) {
    forbidden();
  }
  if (employeeCard.status !== "FROZEN") badRequest("Only frozen employee cards can be unfrozen");

  const updated = await prisma.altaEmployeeCard.update({
    where: { id: employeeCardId },
    data: { status: "ACTIVE" },
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "ALTA_CARD_EMPLOYEE_CARD_UPDATED",
    entityType: "ALTA_CARD",
    entityId: employeeCardId,
    description: "Employee card unfrozen",
    targetUserId: employeeCard.authorizedUserId,
    targetCompanyId: employeeCard.companyId,
    metadata: { reason: reason.trim(), status: "active" },
  });

  return mapAltaEmployeeCardRow(updated);
}

async function loadCardForPayment(cardId: string) {
  return getCardOrThrow(cardId);
}

function assertPaymentAllowed(status: AltaCardStatus): void {
  if (!PAYMENT_ALLOWED_STATUSES.includes(status)) {
    badRequest("Payments are not allowed for this card status");
  }
}

export { PAYMENT_ALLOWED_STATUSES };
