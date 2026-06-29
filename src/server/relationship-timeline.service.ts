import type {
  RelationshipTimelineEventType as DbTimelineEventType,
  Prisma,
} from "@prisma/client";
import { florin } from "@/lib/bank/api";
import {
  formatAltaCardOpenedTimelineCopy,
  firstTierChangePreviousTier,
  resolveAltaCardOpeningTierCode,
} from "@/lib/bank/alta-card-timeline.helpers";
import {
  formatAltaPayMilestoneCopy,
  formatBankAccountOpenedCopy,
  formatDepositMilestoneCopy,
  formatLoanPaidOffCopy,
  formatPrivateBankingClientCopy,
  formatPrivateBankingEligibleCopy,
  formatAltaPrivateInvitedCopy,
  formatRelationshipEstablishedCopy,
  formatTotalAltaAssetsMilestoneCopy,
  formatWithdrawalMilestoneCopy,
  extractLimitPairFromTimelineRow,
  extractRatePairFromTimelineRow,
} from "@/lib/bank/relationship-timeline-customer-copy";
import { formatAltaCardTierUpgradeTimelineCopy, formatAltaCardLimitIncreaseTimelineCopy, formatAltaCardRateReductionTimelineCopy, formatLoanApprovedTimelineCopy, formatRelationshipTierChangedCustomerCopy } from "@/lib/bank/relationship-timeline-historical";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import type {
  CustomerRelationshipTimelineEntry,
  RelationshipTimelineEventRow,
  RelationshipTimelineEventTypeCode,
  RelationshipTimelineSummary,
} from "@/lib/bank/relationship-intelligence-types";
import {
  ALTA_PAY_VOLUME_MILESTONES,
  CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES,
  LIFETIME_DEPOSITS_MILESTONES,
  LIFETIME_WITHDRAWALS_MILESTONES,
  TOTAL_ALTA_ASSETS_MILESTONES,
  milestoneDedupeKey,
} from "@/lib/bank/relationship-timeline-config";
import { enrichPersonalCustomerTimeline } from "@/server/relationship-timeline-customer-enrichment.service";
import { sortTimelineEventsNewestFirst } from "@/lib/bank/relationship-timeline-display";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
import { fromDbBankTransactionType } from "@/server/bank-mapper";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireAuth } from "@/server/auth.service";
import { requireOperator } from "@/server/permissions.service";

export type CreateRelationshipTimelineEventInput = {
  userId: string;
  profileId?: string | null;
  eventType: RelationshipTimelineEventTypeCode;
  title: string;
  description?: string | null;
  occurredAt: Date;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string;
  actorUserId?: string;
  skipAudit?: boolean;
};

const PRODUCT_EVENT_TYPES = new Set<RelationshipTimelineEventTypeCode>([
  "BANK_ACCOUNT_OPENED",
  "BUSINESS_ACCOUNT_OPENED",
  "ALTA_CARD_OPENED",
  "LOAN_APPLICATION_SUBMITTED",
  "LOAN_ACCEPTED",
  "LOAN_FUNDED",
  "LOAN_PAID_OFF",
  "PRIVATE_BANKING_CLIENT",
  "ALTA_PRIVATE_INVITED",
]);

const MILESTONE_EVENT_TYPES = new Set<RelationshipTimelineEventTypeCode>([
  "DEPOSIT_MILESTONE",
  "WITHDRAWAL_MILESTONE",
  "ALTA_PAY_MILESTONE",
]);

function eventTypeToCode(type: DbTimelineEventType): RelationshipTimelineEventTypeCode {
  return type as RelationshipTimelineEventTypeCode;
}

function eventTypeToDb(type: RelationshipTimelineEventTypeCode): DbTimelineEventType {
  return type as DbTimelineEventType;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function mapTimelineRow(row: {
  id: string;
  userId: string;
  profileId: string | null;
  eventType: DbTimelineEventType;
  title: string;
  description: string | null;
  occurredAt: Date;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): RelationshipTimelineEventRow {
  return {
    id: row.id,
    userId: row.userId,
    profileId: row.profileId,
    eventType: eventTypeToCode(row.eventType),
    title: row.title,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function resolveProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.relationshipProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function resolveAuditActorId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const systemUser = await prisma.user.findFirst({
    where: { tags: { some: { tag: "SYSTEM" } } },
    select: { id: true },
  });
  if (systemUser) return systemUser.id;
  const admin = await prisma.user.findFirst({
    where: { tags: { some: { tag: "ADMIN" } } },
    select: { id: true },
  });
  if (!admin) throw new Error("NO_SYSTEM_ACTOR");
  return admin.id;
}

async function hasDedupeKey(userId: string, dedupeKey: string): Promise<boolean> {
  const existing = await prisma.relationshipTimelineEvent.findFirst({
    where: {
      userId,
      metadata: { path: ["dedupeKey"], equals: dedupeKey },
    },
    select: { id: true },
  });
  return existing != null;
}

async function hasEntityEvent(
  userId: string,
  eventType: RelationshipTimelineEventTypeCode,
  relatedEntityId: string,
): Promise<boolean> {
  const existing = await prisma.relationshipTimelineEvent.findFirst({
    where: { userId, eventType: eventTypeToDb(eventType), relatedEntityId },
  });
  return existing != null;
}

export async function createRelationshipTimelineEvent(
  input: CreateRelationshipTimelineEventInput,
): Promise<RelationshipTimelineEventRow | null> {
  if (input.dedupeKey && (await hasDedupeKey(input.userId, input.dedupeKey))) {
    return null;
  }
  if (
    input.relatedEntityId &&
    !input.dedupeKey &&
    (await hasEntityEvent(input.userId, input.eventType, input.relatedEntityId))
  ) {
    return null;
  }

  const profileId = input.profileId ?? (await resolveProfileId(input.userId));
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
  };

  const row = await prisma.relationshipTimelineEvent.create({
    data: {
      userId: input.userId,
      profileId,
      eventType: eventTypeToDb(input.eventType),
      title: input.title,
      description: input.description ?? null,
      occurredAt: input.occurredAt,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  });

  if (!input.skipAudit) {
    const actor = await resolveAuditActorId(input.actorUserId);
    await writeAuditLog({
      actorUserId: actor,
      targetUserId: input.userId,
      action: "RELATIONSHIP_TIMELINE_EVENT_CREATED",
      entityType: "USER",
      entityId: row.id,
      description: `Timeline event: ${input.title}`,
      metadata: {
        userId: input.userId,
        eventType: input.eventType,
        eventId: row.id,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  }

  return mapTimelineRow(row);
}

/** Safe wrapper for integrations — never throws. */
export async function recordRelationshipTimelineEvent(
  input: CreateRelationshipTimelineEventInput,
): Promise<void> {
  try {
    await createRelationshipTimelineEvent(input);
  } catch {
    // Timeline is best-effort alongside primary flows.
  }
}

export async function getRelationshipTimeline(
  userId: string,
  options?: { customerView?: boolean },
): Promise<RelationshipTimelineEventRow[]> {
  if (options?.customerView) {
    const auth = await requireAuth();
    if (auth.id !== userId) await requireOperator();
  } else {
    await requireOperator();
  }

  const rows = await prisma.relationshipTimelineEvent.findMany({
    where: { userId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  const mapped = sortTimelineEventsNewestFirst(rows.map(mapTimelineRow));
  if (!options?.customerView) return mapped;

  const customerVisible = mapped.filter((row) => {
    if (!CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES.has(row.eventType)) return false;
    if (row.eventType === "ALTA_CARD_LIMIT_CHANGED") {
      const { previousLimit, newLimit } = extractLimitPairFromTimelineRow({
        eventType: row.eventType,
        title: row.title,
        description: row.description,
        occurredAt: row.occurredAt,
        relatedEntityId: row.relatedEntityId,
        metadata: row.metadata,
      });
      if (previousLimit != null && newLimit != null && newLimit <= previousLimit) return false;
    }
    if (row.eventType === "ALTA_CARD_RATE_CHANGED") {
      const { previousRate, newRate } = extractRatePairFromTimelineRow({
        eventType: row.eventType,
        title: row.title,
        description: row.description,
        occurredAt: row.occurredAt,
        relatedEntityId: row.relatedEntityId,
        metadata: row.metadata,
      });
      if (previousRate != null && newRate != null && newRate >= previousRate) return false;
    }
    return true;
  });

  const { excludeBusinessScopedPersonalTimelineRows } = await import(
    "@/server/relationship-timeline-personal-filter.service"
  );
  return excludeBusinessScopedPersonalTimelineRows(customerVisible);
}

export async function getCustomerRelationshipTimeline(
  userId: string,
): Promise<CustomerRelationshipTimelineEntry[]> {
  const rows = await getRelationshipTimeline(userId, { customerView: true });
  const { dedupeCustomerTimelineRows } = await import(
    "@/lib/bank/relationship-timeline-customer-view"
  );
  return enrichPersonalCustomerTimeline(dedupeCustomerTimelineRows(rows));
}

export async function getRelationshipTimelineSummary(
  userId: string,
): Promise<RelationshipTimelineSummary> {
  await requireOperator();

  const [events, profile, user] = await Promise.all([
    prisma.relationshipTimelineEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.relationshipProfile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  const mapped = events.map(mapTimelineRow);
  const latestEvent = mapped[0] ?? null;
  const majorMilestoneCount = mapped.filter((e) => MILESTONE_EVENT_TYPES.has(e.eventType)).length;
  const productHistoryCount = mapped.filter((e) => PRODUCT_EVENT_TYPES.has(e.eventType)).length;
  const relationshipSince =
    profile?.relationshipSince.toISOString() ??
    mapped.find((e) => e.eventType === "RELATIONSHIP_STARTED")?.occurredAt ??
    user?.createdAt.toISOString() ??
    null;

  return {
    relationshipSince,
    latestEvent,
    majorMilestoneCount,
    productHistoryCount,
    lastActivityAt: latestEvent?.occurredAt ?? null,
  };
}

export async function createManualRelationshipNote(
  userId: string,
  input: { title: string; body: string },
  actorUserId: string,
): Promise<RelationshipTimelineEventRow> {
  await requireOperator();
  const trimmedBody = input.body.trim();
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle || !trimmedBody) throw new Error("TITLE_AND_BODY_REQUIRED");

  const row = await createRelationshipTimelineEvent({
    userId,
    eventType: "MANUAL_NOTE",
    title: trimmedTitle,
    description: trimmedBody,
    occurredAt: new Date(),
    metadata: { actorUserId, internalOnly: true },
    actorUserId,
  });
  if (!row) throw new Error("NOTE_CREATE_FAILED");

  await writeAuditLog({
    actorUserId,
    targetUserId: userId,
    action: "RELATIONSHIP_MANUAL_NOTE_CREATED",
    entityType: "USER",
    entityId: row.id,
    description: trimmedTitle,
    metadata: {
      userId,
      eventId: row.id,
      body: trimmedBody,
      actorUserId,
    },
  });

  return row;
}

async function resolveUserAccountIds(userId: string): Promise<string[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { userId, companyId: null },
    select: { id: true },
  });
  return accounts.map((account) => account.id);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function findTimelineEventByDedupeKey(userId: string, dedupeKey: string) {
  return prisma.relationshipTimelineEvent.findFirst({
    where: {
      userId,
      metadata: { path: ["dedupeKey"], equals: dedupeKey },
    },
    select: { id: true, occurredAt: true, metadata: true },
  });
}

async function updateTimelineEventOccurredAtByDedupeKey(
  userId: string,
  dedupeKey: string,
  occurredAt: Date,
): Promise<number> {
  const existing = await findTimelineEventByDedupeKey(userId, dedupeKey);
  if (!existing || existing.occurredAt.getTime() === occurredAt.getTime()) return 0;
  await prisma.relationshipTimelineEvent.update({
    where: { id: existing.id },
    data: { occurredAt },
  });
  return 1;
}

/** Replay approved bank activity to find when total assets first crossed each threshold. */
async function computeTotalAssetsMilestoneDatesForAccounts(
  accountIds: string[],
): Promise<Map<number, Date>> {
  const result = new Map<number, Date>();
  if (accountIds.length === 0) return result;

  const transactions = await prisma.bankTransaction.findMany({
    where: { bankAccountId: { in: accountIds }, status: "APPROVED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { bankAccountId: true, type: true, amount: true, createdAt: true },
  });

  const balances = new Map<string, number>();
  for (const accountId of accountIds) balances.set(accountId, 0);

  const reached = new Set<number>();
  for (const tx of transactions) {
    const type = fromDbBankTransactionType(tx.type);
    const signed = getSignedBankTransactionAmount(type, decimalToNumber(tx.amount));
    balances.set(tx.bankAccountId, roundMoney((balances.get(tx.bankAccountId) ?? 0) + signed));
    const totalAssets = roundMoney([...balances.values()].reduce((sum, balance) => sum + balance, 0));

    for (const threshold of TOTAL_ALTA_ASSETS_MILESTONES) {
      if (totalAssets >= threshold && !reached.has(threshold)) {
        reached.add(threshold);
        result.set(threshold, tx.createdAt);
      }
    }
  }

  return result;
}

export async function computeTotalAltaAssetsMilestoneDates(userId: string): Promise<Map<number, Date>> {
  const accountIds = await resolveUserAccountIds(userId);
  return computeTotalAssetsMilestoneDatesForAccounts(accountIds);
}

export async function computeTotalBusinessAssetsMilestoneDates(
  companyId: string,
): Promise<Map<number, Date>> {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    select: { id: true },
  });
  return computeTotalAssetsMilestoneDatesForAccounts(accounts.map((account) => account.id));
}

export async function computeVolumeMilestoneDates(
  accountIds: string[],
  txType: "DEPOSIT" | "WITHDRAWAL" | "ALTA_PAY",
  thresholds: readonly number[],
): Promise<Map<number, Date>> {
  const result = new Map<number, Date>();
  if (accountIds.length === 0) return result;

  let whereClause: Prisma.BankTransactionWhereInput;
  if (txType === "ALTA_PAY") {
    whereClause = {
      bankAccountId: { in: accountIds },
      status: "APPROVED",
      description: { contains: "Alta Pay", mode: "insensitive" },
    };
  } else {
    whereClause = {
      bankAccountId: { in: accountIds },
      status: "APPROVED",
      type: txType,
    };
  }

  const transactions = await prisma.bankTransaction.findMany({
    where: whereClause,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { amount: true, createdAt: true },
  });

  let running = 0;
  const reached = new Set<number>();
  for (const tx of transactions) {
    running += Math.abs(decimalToNumber(tx.amount));
    for (const threshold of thresholds) {
      if (running >= threshold && !reached.has(threshold)) {
        reached.add(threshold);
        result.set(threshold, tx.createdAt);
      }
    }
  }

  return result;
}

async function reconcileTierChangeEventFromAudit(
  userId: string,
  audit: { id: string; createdAt: Date; metadata: unknown },
): Promise<number> {
  const meta = audit.metadata as Record<string, unknown> | null;
  const oldTier = typeof meta?.oldTier === "string" ? meta.oldTier : null;
  const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
  if (!newTier) return 0;

  if (oldTier) {
    const updatedByTierPair = await updateTimelineEventOccurredAtByDedupeKey(
      userId,
      `tier:${oldTier}->${newTier}`,
      audit.createdAt,
    );
    if (updatedByTierPair > 0) return updatedByTierPair;
  }

  const updatedByDedupe = await updateTimelineEventOccurredAtByDedupeKey(
    userId,
    `audit:relationship-tier:${audit.id}`,
    audit.createdAt,
  );
  if (updatedByDedupe > 0) return updatedByDedupe;

  const events = await prisma.relationshipTimelineEvent.findMany({
    where: { userId, eventType: "RELATIONSHIP_TIER_CHANGED" },
    select: { id: true, occurredAt: true, metadata: true },
  });
  const match = events.find((event) => {
    const eventMeta =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;
    if (!eventMeta || eventMeta.newTier !== newTier) return false;
    if (oldTier && eventMeta.oldTier && eventMeta.oldTier !== oldTier) return false;
    return true;
  });
  if (!match || match.occurredAt.getTime() === audit.createdAt.getTime()) return 0;

  await prisma.relationshipTimelineEvent.update({
    where: { id: match.id },
    data: { occurredAt: audit.createdAt },
  });
  return 1;
}

/** Correct milestone and tier dates from platform records (best-effort, idempotent). */
export async function reconcileRelationshipTimelineDates(userId: string): Promise<number> {
  const accountIds = await resolveUserAccountIds(userId);
  let updates = 0;

  for (const [threshold, occurredAt] of await computeTotalAltaAssetsMilestoneDates(userId)) {
    updates += await updateTimelineEventOccurredAtByDedupeKey(
      userId,
      milestoneDedupeKey("assets", threshold),
      occurredAt,
    );
  }

  const volumeConfigs = [
    {
      category: "deposits" as const,
      txType: "DEPOSIT" as const,
      thresholds: LIFETIME_DEPOSITS_MILESTONES,
    },
    {
      category: "withdrawals" as const,
      txType: "WITHDRAWAL" as const,
      thresholds: LIFETIME_WITHDRAWALS_MILESTONES,
    },
    {
      category: "alta_pay" as const,
      txType: "ALTA_PAY" as const,
      thresholds: ALTA_PAY_VOLUME_MILESTONES,
    },
  ];

  for (const config of volumeConfigs) {
    const dates = await computeVolumeMilestoneDates(accountIds, config.txType, config.thresholds);
    for (const [threshold, occurredAt] of dates) {
      updates += await updateTimelineEventOccurredAtByDedupeKey(
        userId,
        milestoneDedupeKey(config.category, threshold),
        occurredAt,
      );
    }
  }

  const tierAudits = await prisma.auditLog.findMany({
    where: { targetUserId: userId, action: "RELATIONSHIP_TIER_CHANGED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, metadata: true },
  });
  for (const audit of tierAudits) {
    updates += await reconcileTierChangeEventFromAudit(userId, audit);
  }

  const cardTierAudits = await prisma.auditLog.findMany({
    where: { targetUserId: userId, action: "ALTA_CARD_TIER_CHANGED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });
  for (const audit of cardTierAudits) {
    updates += await updateTimelineEventOccurredAtByDedupeKey(
      userId,
      `audit:tier:${audit.id}`,
      audit.createdAt,
    );
  }

  return updates;
}

async function backfillVolumeMilestonesFromTransactions(
  userId: string,
  accountIds: string[],
  type: "DEPOSIT_MILESTONE" | "WITHDRAWAL_MILESTONE" | "ALTA_PAY_MILESTONE",
  txType: "DEPOSIT" | "WITHDRAWAL" | "ALTA_PAY",
  thresholds: readonly number[],
  category: "deposits" | "withdrawals" | "alta_pay",
): Promise<number> {
  const dates = await computeVolumeMilestoneDates(accountIds, txType, thresholds);
  let created = 0;

  for (const [threshold, occurredAt] of dates) {
    const copy =
      category === "alta_pay"
        ? formatAltaPayMilestoneCopy(threshold, "personal")
        : category === "deposits"
          ? formatDepositMilestoneCopy(threshold, "personal")
          : formatWithdrawalMilestoneCopy(threshold, "personal");
    const event = await createRelationshipTimelineEvent({
      userId,
      eventType: type,
      title: copy.title,
      description: copy.description,
      occurredAt,
      dedupeKey: milestoneDedupeKey(category, threshold),
      metadata: { threshold, milestoneKind: category.toUpperCase() },
      skipAudit: true,
    });
    if (event) created += 1;
  }

  return created;
}

async function backfillAssetMilestonesFromTransactions(userId: string): Promise<number> {
  const profileId = await resolveProfileId(userId);
  const dates = await computeTotalAltaAssetsMilestoneDates(userId);
  let created = 0;

  for (const [threshold, occurredAt] of dates) {
    const copy = formatTotalAltaAssetsMilestoneCopy(threshold);
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "DEPOSIT_MILESTONE",
      title: copy.title,
      description: copy.description,
      occurredAt,
      dedupeKey: milestoneDedupeKey("assets", threshold),
      metadata: { milestoneKind: "TOTAL_ALTA_ASSETS", threshold },
      skipAudit: true,
    });
    if (event) created += 1;
  }

  return created;
}

export async function createMilestoneEvents(userId: string): Promise<number> {
  const accountIds = await resolveUserAccountIds(userId);
  let created = 0;
  created += await backfillVolumeMilestonesFromTransactions(
    userId,
    accountIds,
    "DEPOSIT_MILESTONE",
    "DEPOSIT",
    LIFETIME_DEPOSITS_MILESTONES,
    "deposits",
  );
  created += await backfillVolumeMilestonesFromTransactions(
    userId,
    accountIds,
    "WITHDRAWAL_MILESTONE",
    "WITHDRAWAL",
    LIFETIME_WITHDRAWALS_MILESTONES,
    "withdrawals",
  );
  created += await backfillVolumeMilestonesFromTransactions(
    userId,
    accountIds,
    "ALTA_PAY_MILESTONE",
    "ALTA_PAY",
    ALTA_PAY_VOLUME_MILESTONES,
    "alta_pay",
  );
  created += await backfillAssetMilestonesFromTransactions(userId);
  return created;
}

/** Idempotent rebuild from platform records — no auth gate (scripts, cron, first-load ensure). */
export async function backfillRelationshipTimelineCore(
  userId: string,
  actorUserId?: string,
): Promise<number> {
  let created = 0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, createdAt: true },
  });
  if (!user) throw new Error("NOT_FOUND");

  const profileId = await resolveProfileId(userId);

  const startedCopy = formatRelationshipEstablishedCopy("personal");
  const started = await createRelationshipTimelineEvent({
    userId,
    profileId,
    eventType: "RELATIONSHIP_STARTED",
    title: startedCopy.title,
    description: startedCopy.description,
    occurredAt: user.createdAt,
    dedupeKey: "relationship:started",
    skipAudit: true,
  });
  if (started) created += 1;

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { userId, companyId: null },
    orderBy: { createdAt: "asc" },
  });

  for (const account of bankAccounts) {
    const accountCopy = formatBankAccountOpenedCopy(account.accountName, "personal");
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "BANK_ACCOUNT_OPENED",
      title: accountCopy.title,
      description: accountCopy.description,
      occurredAt: account.createdAt,
      relatedEntityType: "BANK_ACCOUNT",
      relatedEntityId: account.id,
      metadata: { accountName: account.accountName },
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const cards = await prisma.altaCard.findMany({
    where: { ownerUserId: userId, companyId: null },
    orderBy: { createdAt: "asc" },
    include: { application: { select: { approvedTier: true, requestedTier: true } } },
  });
  const cardIds = cards.map((card) => card.id);
  const tierAuditsForCards =
    cardIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { action: "ALTA_CARD_TIER_CHANGED", entityId: { in: cardIds } },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const firstTierAuditByCard = new Map<string, (typeof tierAuditsForCards)[number]>();
  for (const audit of tierAuditsForCards) {
    if (audit.entityId && !firstTierAuditByCard.has(audit.entityId)) {
      firstTierAuditByCard.set(audit.entityId, audit);
    }
  }

  for (const card of cards) {
    const openingTier = resolveAltaCardOpeningTierCode({
      currentTier: card.tier,
      approvedTier: card.application?.approvedTier ?? null,
      requestedTier: card.application?.requestedTier ?? null,
      firstTierChangePreviousTier: firstTierChangePreviousTier(
        firstTierAuditByCard.get(card.id)?.metadata as Record<string, unknown> | null,
      ),
    });
    const openedCopy = formatAltaCardOpenedTimelineCopy(openingTier);
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "ALTA_CARD_OPENED",
      title: openedCopy.title,
      description: openedCopy.description,
      occurredAt: card.openedAt ?? card.createdAt,
      relatedEntityType: "ALTA_CARD",
      relatedEntityId: card.id,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const tierAudits = await prisma.auditLog.findMany({
    where: {
      targetUserId: userId,
      action: "ALTA_CARD_TIER_CHANGED",
    },
    orderBy: { createdAt: "asc" },
  });
  const tierAuditCardIds = tierAudits
    .map((audit) => audit.entityId)
    .filter((id): id is string => Boolean(id));
  const tierAuditCards =
    tierAuditCardIds.length > 0
      ? await prisma.altaCard.findMany({
          where: { id: { in: tierAuditCardIds } },
          select: { id: true, companyId: true },
        })
      : [];
  const tierAuditCardBusinessById = new Map(
    tierAuditCards.map((card) => [card.id, Boolean(card.companyId)]),
  );

  for (const audit of tierAudits) {
    if (audit.entityId && tierAuditCardBusinessById.get(audit.entityId)) continue;
    const meta = audit.metadata as Record<string, unknown> | null;
    const previousTier =
      typeof meta?.previousTier === "string"
        ? meta.previousTier
        : typeof meta?.oldValue === "string"
          ? meta.oldValue
          : null;
    const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
    const upgradeCopy = formatAltaCardTierUpgradeTimelineCopy(previousTier, newTier);
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "ALTA_CARD_TIER_CHANGED",
      title: upgradeCopy.title,
      description: upgradeCopy.description ?? audit.description,
      occurredAt: audit.createdAt,
      relatedEntityType: audit.entityId ? "ALTA_CARD" : null,
      relatedEntityId: audit.entityId,
      metadata: { previousTier, newTier },
      dedupeKey: `audit:tier:${audit.id}`,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const limitAudits = await prisma.auditLog.findMany({
    where: {
      targetUserId: userId,
      action: "ALTA_CARD_LIMIT_CHANGED",
    },
    orderBy: { createdAt: "asc" },
  });
  const limitAuditCardIds = limitAudits
    .map((audit) => audit.entityId)
    .filter((id): id is string => Boolean(id));
  const limitAuditCards =
    limitAuditCardIds.length > 0
      ? await prisma.altaCard.findMany({
          where: { id: { in: limitAuditCardIds } },
          select: { id: true, companyId: true },
        })
      : [];
  const limitAuditCardBusinessById = new Map(
    limitAuditCards.map((card) => [card.id, Boolean(card.companyId)]),
  );

  for (const audit of limitAudits) {
    if (audit.entityId && limitAuditCardBusinessById.get(audit.entityId)) continue;
    const meta = audit.metadata as Record<string, unknown> | null;
    const previousLimit =
      typeof meta?.previousLimit === "number"
        ? meta.previousLimit
        : typeof meta?.oldValue === "number"
          ? meta.oldValue
          : Number(meta?.oldValue);
    const newLimit =
      typeof meta?.newLimit === "number"
        ? meta.newLimit
        : typeof meta?.newValue === "number"
          ? meta.newValue
          : Number(meta?.newValue);
    if (!Number.isFinite(previousLimit) || !Number.isFinite(newLimit) || newLimit <= previousLimit) {
      continue;
    }
    const upgradeCopy = formatAltaCardLimitIncreaseTimelineCopy(previousLimit, newLimit, {
      business: audit.entityId ? limitAuditCardBusinessById.get(audit.entityId) : false,
    });
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "ALTA_CARD_LIMIT_CHANGED",
      title: upgradeCopy.title,
      description: upgradeCopy.description ?? audit.description,
      occurredAt: audit.createdAt,
      relatedEntityType: audit.entityId ? "ALTA_CARD" : null,
      relatedEntityId: audit.entityId,
      metadata: { previousLimit, newLimit },
      dedupeKey: audit.entityId ? `limit:${audit.entityId}:${newLimit}` : `audit:limit:${audit.id}`,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const rateAudits = await prisma.auditLog.findMany({
    where: {
      targetUserId: userId,
      action: "ALTA_CARD_RATE_CHANGED",
    },
    orderBy: { createdAt: "asc" },
  });
  const rateAuditCardIds = rateAudits
    .map((audit) => audit.entityId)
    .filter((id): id is string => Boolean(id));
  const rateAuditCards =
    rateAuditCardIds.length > 0
      ? await prisma.altaCard.findMany({
          where: { id: { in: rateAuditCardIds } },
          select: { id: true, companyId: true },
        })
      : [];
  const rateAuditCardBusinessById = new Map(
    rateAuditCards.map((card) => [card.id, Boolean(card.companyId)]),
  );

  for (const audit of rateAudits) {
    if (audit.entityId && rateAuditCardBusinessById.get(audit.entityId)) continue;
    const meta = audit.metadata as Record<string, unknown> | null;
    const previousRate =
      typeof meta?.previousRate === "number"
        ? meta.previousRate
        : typeof meta?.oldValue === "number"
          ? meta.oldValue
          : Number(meta?.oldValue);
    const newRate =
      typeof meta?.newRate === "number"
        ? meta.newRate
        : typeof meta?.newValue === "number"
          ? meta.newValue
          : Number(meta?.newValue);
    if (!Number.isFinite(previousRate) || !Number.isFinite(newRate) || newRate >= previousRate) {
      continue;
    }
    const reductionCopy = formatAltaCardRateReductionTimelineCopy(previousRate, newRate, {
      business: audit.entityId ? rateAuditCardBusinessById.get(audit.entityId) : false,
    });
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "ALTA_CARD_RATE_CHANGED",
      title: reductionCopy.title,
      description: reductionCopy.description ?? audit.description,
      occurredAt: audit.createdAt,
      relatedEntityType: audit.entityId ? "ALTA_CARD" : null,
      relatedEntityId: audit.entityId,
      metadata: { previousRate, newRate },
      dedupeKey: audit.entityId ? `rate:${audit.entityId}:${newRate}` : `audit:rate:${audit.id}`,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const applications = await prisma.loanApplication.findMany({
    where: { applicantUserId: userId, companyId: null },
    orderBy: { createdAt: "asc" },
  });
  for (const app of applications) {
    const submitted = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "LOAN_APPLICATION_SUBMITTED",
      title: "Lending application submitted",
      description: `Requested ${florin(decimalToNumber(app.requestedAmount))}.`,
      occurredAt: app.createdAt,
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: app.id,
      skipAudit: true,
    });
    if (submitted) created += 1;

    if (app.status === "APPROVED" && app.reviewedAt) {
      const accepted = await createRelationshipTimelineEvent({
        userId,
        profileId,
        eventType: "LOAN_ACCEPTED",
        title: "Lending application accepted",
        occurredAt: app.reviewedAt,
        relatedEntityType: "LOAN_APPLICATION",
        relatedEntityId: app.id,
        dedupeKey: `loan:accepted:${app.id}`,
        skipAudit: true,
      });
      if (accepted) created += 1;
    }
    if (app.status === "DENIED" && app.reviewedAt) {
      const denied = await createRelationshipTimelineEvent({
        userId,
        profileId,
        eventType: "LOAN_DENIED",
        title: "Lending application denied",
        occurredAt: app.reviewedAt,
        relatedEntityType: "LOAN_APPLICATION",
        relatedEntityId: app.id,
        dedupeKey: `loan:denied:${app.id}`,
        skipAudit: true,
      });
      if (denied) created += 1;
    }
  }

  const loans = await prisma.loan.findMany({
    where: { borrowerUserId: userId, companyId: null },
    orderBy: { createdAt: "asc" },
  });
  for (const loan of loans) {
    if (loan.approvedAt) {
      const loanCopy = formatLoanApprovedTimelineCopy(decimalToNumber(loan.principalAmount));
      const funded = await createRelationshipTimelineEvent({
        userId,
        profileId,
        eventType: "LOAN_FUNDED",
        title: loanCopy.title,
        description: loanCopy.description,
        occurredAt: loan.approvedAt,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.id,
        skipAudit: true,
      });
      if (funded) created += 1;
    }
    if (loan.status === "PAID_OFF") {
      const paidOff = await prisma.loanLedgerEntry.findFirst({
        where: { loanId: loan.id, type: "STATUS_CHANGE", description: { contains: "paid off" } },
        orderBy: { createdAt: "desc" },
      });
      const occurredAt = paidOff?.createdAt ?? loan.updatedAt;
      const paidOffCopy = formatLoanPaidOffCopy("personal");
      const event = await createRelationshipTimelineEvent({
        userId,
        profileId,
        eventType: "LOAN_PAID_OFF",
        title: paidOffCopy.title,
        description: paidOffCopy.description,
        occurredAt,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.id,
        skipAudit: true,
      });
      if (event) created += 1;
    }
  }

  const privateTag = await prisma.userTagAssignment.findFirst({
    where: { userId, tag: "PRIVATE_CLIENT" },
  });
  if (privateTag) {
    const privateCopy = formatPrivateBankingClientCopy("personal");
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "PRIVATE_BANKING_CLIENT",
      title: privateCopy.title,
      description: privateCopy.description,
      occurredAt: privateTag.createdAt,
      relatedEntityType: "USER",
      relatedEntityId: userId,
      dedupeKey: "private:client",
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const altaPrivateInvitations = await prisma.altaPrivateInvitation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });
  for (const invitation of altaPrivateInvitations) {
    const invitedCopy = formatAltaPrivateInvitedCopy("personal");
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "ALTA_PRIVATE_INVITED",
      title: invitedCopy.title,
      description: invitedCopy.description,
      occurredAt: invitation.createdAt,
      relatedEntityType: "USER",
      relatedEntityId: invitation.id,
      metadata: { invitationId: invitation.id },
      dedupeKey: `private:invited:${invitation.id}`,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const eligibleAudit = (
    await prisma.auditLog.findMany({
      where: { targetUserId: userId, action: "PRIVATE_BANKING_ELIGIBILITY_CHANGED" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, metadata: true },
    })
  ).find((audit) => {
    const meta = audit.metadata as Record<string, unknown> | null;
    return meta?.newEligible === true;
  });
  if (eligibleAudit) {
    const eligibleCopy = formatPrivateBankingEligibleCopy("personal");
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "PRIVATE_BANKING_ELIGIBLE",
      title: eligibleCopy.title,
      description: eligibleCopy.description,
      occurredAt: eligibleAudit.createdAt,
      dedupeKey: "private:eligible",
      skipAudit: true,
    });
    if (event) created += 1;
  }

  const relationshipTierAudits = await prisma.auditLog.findMany({
    where: { targetUserId: userId, action: "RELATIONSHIP_TIER_CHANGED" },
    orderBy: { createdAt: "asc" },
  });
  for (const audit of relationshipTierAudits) {
    const meta = audit.metadata as Record<string, unknown> | null;
    const oldTier = typeof meta?.oldTier === "string" ? meta.oldTier : null;
    const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
    if (!newTier || newTier === "PRIVATE_ELIGIBLE" || newTier === "PRIVATE_CLIENT") continue;
    const tierCopy = formatRelationshipTierChangedCustomerCopy(
      oldTier,
      newTier,
      RELATIONSHIP_TIER_LABELS,
    );
    const event = await createRelationshipTimelineEvent({
      userId,
      profileId,
      eventType: "RELATIONSHIP_TIER_CHANGED",
      title: tierCopy.title,
      description: tierCopy.description,
      occurredAt: audit.createdAt,
      metadata: { oldTier, newTier },
      dedupeKey: oldTier ? `tier:${oldTier}->${newTier}` : `tier:->${newTier}`,
      skipAudit: true,
    });
    if (event) created += 1;
  }

  created += await createMilestoneEvents(userId);

  const actor = await resolveAuditActorId(actorUserId);
  await writeAuditLog({
    actorUserId: actor,
    targetUserId: userId,
    action: "RELATIONSHIP_TIMELINE_BACKFILLED",
    entityType: "USER",
    entityId: profileId ?? userId,
    description: `Backfilled ${created} relationship timeline event(s)`,
    metadata: { userId, eventsCreated: created, actorUserId: actor },
  });

  try {
    const { refreshStoredPersonalTimelineCopy } = await import(
      "@/server/relationship-timeline-customer-enrichment.service"
    );
    await refreshStoredPersonalTimelineCopy(userId);
  } catch {
    // Legacy copy refresh is best-effort after backfill.
  }

  return created;
}

export async function backfillRelationshipTimeline(userId: string, actorUserId?: string): Promise<number> {
  await requireOperator();
  return backfillRelationshipTimelineCore(userId, actorUserId);
}

/** Backfill once when a user has no timeline rows yet (safe on customer page load). */
export async function ensureRelationshipTimelineBackfilled(userId: string): Promise<number> {
  const existing = await prisma.relationshipTimelineEvent.count({ where: { userId } });
  if (existing > 0) return 0;
  return backfillRelationshipTimelineCore(userId);
}

export async function backfillAllRelationshipTimelinesCore(actorUserId?: string): Promise<{
  processed: number;
  eventsCreated: number;
  failed: number;
}> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let eventsCreated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      eventsCreated += await backfillRelationshipTimelineCore(user.id, actorUserId);
    } catch {
      failed += 1;
    }
  }

  return { processed: users.length, eventsCreated, failed };
}

export async function backfillAllRelationshipTimelines(actorUserId?: string): Promise<{
  processed: number;
  eventsCreated: number;
  failed: number;
}> {
  await requireOperator();
  return backfillAllRelationshipTimelinesCore(actorUserId);
}

export async function syncRelationshipProfileTimelineEvents(input: {
  userId: string;
  actorUserId?: string;
  oldScore?: number | null;
  newScore: number;
  oldTier?: string | null;
  newTier: string;
  oldPrivateEligible?: boolean;
  newPrivateEligible: boolean;
}): Promise<void> {
  const now = new Date();
  if (input.oldScore != null && input.oldScore !== input.newScore) {
    await recordRelationshipTimelineEvent({
      userId: input.userId,
      eventType: "RELATIONSHIP_SCORE_CHANGED",
      title: `Relationship score changed to ${input.newScore}`,
      description: `Previous score: ${input.oldScore}.`,
      occurredAt: now,
      dedupeKey: `score:${input.oldScore}->${input.newScore}`,
      actorUserId: input.actorUserId,
    });
  }
  if (
    input.oldTier &&
    input.oldTier !== input.newTier &&
    input.newTier !== "PRIVATE_ELIGIBLE" &&
    input.newTier !== "PRIVATE_CLIENT"
  ) {
    const tierCopy = formatRelationshipTierChangedCustomerCopy(
      input.oldTier,
      input.newTier,
      RELATIONSHIP_TIER_LABELS,
    );
    await recordRelationshipTimelineEvent({
      userId: input.userId,
      eventType: "RELATIONSHIP_TIER_CHANGED",
      title: tierCopy.title,
      description: tierCopy.description ?? undefined,
      occurredAt: now,
      metadata: { oldTier: input.oldTier, newTier: input.newTier },
      dedupeKey: `tier:${input.oldTier}->${input.newTier}`,
      actorUserId: input.actorUserId,
    });
  }
  if (input.oldPrivateEligible === false && input.newPrivateEligible) {
    const eligibleCopy = formatPrivateBankingEligibleCopy("personal");
    await recordRelationshipTimelineEvent({
      userId: input.userId,
      eventType: "PRIVATE_BANKING_ELIGIBLE",
      title: eligibleCopy.title,
      description: eligibleCopy.description,
      occurredAt: now,
      dedupeKey: "private:eligible",
      actorUserId: input.actorUserId,
    });
  }
  try {
    await createMilestoneEvents(input.userId);
  } catch {
    // best-effort
  }
}
