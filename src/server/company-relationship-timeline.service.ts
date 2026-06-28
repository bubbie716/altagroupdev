import type { CompanyRelationshipTimelineEventType as DbEventType, Prisma } from "@prisma/client";
import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import {
  ALTA_PAY_VOLUME_MILESTONES,
  CUSTOMER_VISIBLE_COMPANY_TIMELINE_EVENT_TYPES,
  isCustomerVisibleCompanyTimelineEvent,
  LIFETIME_DEPOSITS_MILESTONES,
  LIFETIME_WITHDRAWALS_MILESTONES,
  milestoneDedupeKey,
} from "@/lib/bank/company-relationship-timeline-config";
import { florin } from "@/lib/bank/api";
import {
  formatAltaCardOpenedTimelineCopy,
  firstTierChangePreviousTier,
  resolveAltaCardOpeningTierCode,
} from "@/lib/bank/alta-card-timeline.helpers";
import {
  formatAltaCardTierUpgradeTimelineCopy,
  formatRelationshipTierChangedCustomerCopy,
} from "@/lib/bank/relationship-timeline-historical";
import { enrichBusinessCustomerTimeline } from "@/server/relationship-timeline-customer-enrichment.service";
import { sortTimelineEventsNewestFirst } from "@/lib/bank/relationship-timeline-display";
import { computeVolumeMilestoneDates } from "@/server/relationship-timeline.service";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireOperator } from "@/server/permissions.service";

function mapTimelineRow(row: {
  id: string;
  companyId: string;
  profileId: string | null;
  eventType: DbEventType;
  title: string;
  description: string | null;
  occurredAt: Date;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): CompanyRelationshipTimelineEventRow {
  return {
    id: row.id,
    companyId: row.companyId,
    profileId: row.profileId,
    eventType: row.eventType,
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

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
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

async function resolveCompanyProfileId(companyId: string): Promise<string | null> {
  const profile = await prisma.companyRelationshipProfile.findUnique({
    where: { companyId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function getCompanyRelationshipTimeline(
  companyId: string,
): Promise<CompanyRelationshipTimelineEventRow[]> {
  await requireOperator();
  const rows = await prisma.companyRelationshipTimelineEvent.findMany({
    where: { companyId },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
  return rows.map(mapTimelineRow);
}

export async function getCustomerCompanyRelationshipTimeline(
  companyId: string,
): Promise<CompanyRelationshipTimelineEventRow[]> {
  try {
    await reconcileCompanyRelationshipTimelineDates(companyId);
  } catch {
    // Date reconciliation is best-effort on customer view load.
  }

  const rows = await prisma.companyRelationshipTimelineEvent.findMany({
    where: { companyId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
  const visible = sortTimelineEventsNewestFirst(
    rows.filter(isCustomerVisibleCompanyTimelineEvent).map(mapTimelineRow),
  );
  return enrichBusinessCustomerTimeline(visible);
}

async function updateCompanyTimelineEventOccurredAtByDedupeKey(
  companyId: string,
  dedupeKey: string,
  occurredAt: Date,
): Promise<number> {
  const existing = await prisma.companyRelationshipTimelineEvent.findFirst({
    where: {
      companyId,
      metadata: { path: ["dedupeKey"], equals: dedupeKey },
    },
    select: { id: true, occurredAt: true },
  });
  if (!existing || existing.occurredAt.getTime() === occurredAt.getTime()) return 0;
  await prisma.companyRelationshipTimelineEvent.update({
    where: { id: existing.id },
    data: { occurredAt },
  });
  return 1;
}

async function reconcileCompanyTierChangeEventFromAudit(
  companyId: string,
  audit: { id: string; createdAt: Date; metadata: unknown },
): Promise<number> {
  const meta = audit.metadata as Record<string, unknown> | null;
  const oldTier = typeof meta?.oldTier === "string" ? meta.oldTier : null;
  const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
  if (!newTier) return 0;

  const updatedByDedupe = await updateCompanyTimelineEventOccurredAtByDedupeKey(
    companyId,
    `audit:relationship-tier:${audit.id}`,
    audit.createdAt,
  );
  if (updatedByDedupe > 0) return updatedByDedupe;

  const events = await prisma.companyRelationshipTimelineEvent.findMany({
    where: { companyId, eventType: "RELATIONSHIP_TIER_CHANGED" },
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

  await prisma.companyRelationshipTimelineEvent.update({
    where: { id: match.id },
    data: { occurredAt: audit.createdAt },
  });
  return 1;
}

/** Correct milestone and tier dates from platform records (best-effort, idempotent). */
export async function reconcileCompanyRelationshipTimelineDates(companyId: string): Promise<number> {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    select: { id: true },
  });
  const accountIds = accounts.map((account) => account.id);
  let updates = 0;

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
      updates += await updateCompanyTimelineEventOccurredAtByDedupeKey(
        companyId,
        milestoneDedupeKey(config.category, threshold),
        occurredAt,
      );
    }
  }

  const tierAudits = await prisma.auditLog.findMany({
    where: { targetCompanyId: companyId, action: "COMPANY_RELATIONSHIP_TIER_CHANGED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, metadata: true },
  });
  for (const audit of tierAudits) {
    updates += await reconcileCompanyTierChangeEventFromAudit(companyId, audit);
  }

  const cardIds = (
    await prisma.altaCard.findMany({ where: { companyId }, select: { id: true } })
  ).map((card) => card.id);
  const cardTierAudits =
    cardIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { action: "ALTA_CARD_TIER_CHANGED", entityId: { in: cardIds } },
          orderBy: { createdAt: "asc" },
          select: { id: true, createdAt: true },
        })
      : [];
  for (const audit of cardTierAudits) {
    updates += await updateCompanyTimelineEventOccurredAtByDedupeKey(
      companyId,
      `audit:tier:${audit.id}`,
      audit.createdAt,
    );
  }

  return updates;
}

export async function createCompanyRelationshipTimelineEvent(input: {
  companyId: string;
  profileId?: string | null;
  eventType: DbEventType;
  title: string;
  description?: string;
  occurredAt: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  actorUserId?: string;
  skipAudit?: boolean;
}): Promise<CompanyRelationshipTimelineEventRow | null> {
  if (input.dedupeKey) {
    const existing = await prisma.companyRelationshipTimelineEvent.findFirst({
      where: {
        companyId: input.companyId,
        metadata: { path: ["dedupeKey"], equals: input.dedupeKey },
      },
    });
    if (existing) return null;
  }

  if (input.relatedEntityId) {
    const entityDup = await prisma.companyRelationshipTimelineEvent.findFirst({
      where: {
        companyId: input.companyId,
        eventType: input.eventType,
        relatedEntityId: input.relatedEntityId,
      },
    });
    if (entityDup) return null;
  }

  const profileId = input.profileId ?? (await resolveCompanyProfileId(input.companyId));

  const row = await prisma.companyRelationshipTimelineEvent.create({
    data: {
      companyId: input.companyId,
      profileId,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? null,
      occurredAt: input.occurredAt,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  if (!input.skipAudit) {
    const actor = await resolveAuditActorId(input.actorUserId);
    await writeAuditLog({
      actorUserId: actor,
      targetCompanyId: input.companyId,
      action: "COMPANY_RELATIONSHIP_TIMELINE_EVENT_CREATED",
      entityType: "COMPANY",
      entityId: row.id,
      description: input.title,
      metadata: { companyId: input.companyId, eventType: input.eventType },
    });
  }

  return mapTimelineRow(row);
}

export async function recordCompanyRelationshipTimelineEvent(
  input: Parameters<typeof createCompanyRelationshipTimelineEvent>[0],
): Promise<void> {
  try {
    await createCompanyRelationshipTimelineEvent(input);
  } catch {
    // Timeline is best-effort alongside primary flows.
  }
}

export async function syncCompanyRelationshipProfileTimelineEvents(input: {
  companyId: string;
  actorUserId?: string;
  oldScore?: number | null;
  newScore: number;
  oldTier?: string | null;
  newTier: string;
  oldCommercialEligible?: boolean;
  newCommercialEligible: boolean;
}): Promise<void> {
  const now = new Date();
  if (input.oldScore != null && input.oldScore !== input.newScore) {
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.companyId,
      eventType: "RELATIONSHIP_SCORE_CHANGED",
      title: `Company relationship score changed to ${input.newScore}`,
      description: `Previous score: ${input.oldScore}.`,
      occurredAt: now,
      dedupeKey: `score:value:${input.newScore}`,
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  }
  if (input.oldTier && input.oldTier !== input.newTier) {
    const tierCopy = formatRelationshipTierChangedCustomerCopy(
      input.oldTier,
      input.newTier,
      COMPANY_RELATIONSHIP_TIER_LABELS,
      { business: true },
    );
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.companyId,
      eventType: "RELATIONSHIP_TIER_CHANGED",
      title: tierCopy.title,
      description: tierCopy.description ?? undefined,
      occurredAt: now,
      metadata: { oldTier: input.oldTier, newTier: input.newTier },
      dedupeKey: `tier:value:${input.newTier}`,
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  }
  if (input.oldCommercialEligible === false && input.newCommercialEligible) {
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.companyId,
      eventType: "COMMERCIAL_BANKING_ELIGIBLE",
      title: "Commercial banking eligibility reached",
      occurredAt: now,
      dedupeKey: "commercial:eligible",
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  }
}

async function backfillCompanyVolumeMilestones(
  companyId: string,
  profileId: string | null | undefined,
  accountIds: string[],
  type: "DEPOSIT_MILESTONE" | "WITHDRAWAL_MILESTONE" | "ALTA_PAY_MILESTONE",
  txType: "DEPOSIT" | "WITHDRAWAL" | "ALTA_PAY",
  thresholds: readonly number[],
  category: "deposits" | "withdrawals" | "alta_pay",
  add: (input: Parameters<typeof createCompanyRelationshipTimelineEvent>[0]) => Promise<void>,
): Promise<void> {
  const dates = await computeVolumeMilestoneDates(accountIds, txType, thresholds);
  for (const [threshold, occurredAt] of dates) {
    await add({
      companyId,
      profileId,
      eventType: type,
      title: `${category === "alta_pay" ? "Alta Pay volume" : category === "deposits" ? "Lifetime deposits" : "Lifetime withdrawals"} reached ${florin(threshold)}`,
      description: `Crossed ${florin(threshold)} in recorded business ${category === "alta_pay" ? "Alta Pay" : category} activity.`,
      occurredAt,
      dedupeKey: milestoneDedupeKey(category, threshold),
      metadata: { threshold, milestoneKind: category.toUpperCase() },
    });
  }
}

/** Idempotent rebuild from platform records — no auth gate (scripts, cron, first-load ensure). */
export async function backfillCompanyRelationshipTimelineCore(
  companyId: string,
  actorUserId?: string,
): Promise<number> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("NOT_FOUND");

  const profile = await prisma.companyRelationshipProfile.findUnique({ where: { companyId } });
  const profileId = profile?.id ?? null;
  let created = 0;

  async function add(input: Parameters<typeof createCompanyRelationshipTimelineEvent>[0]) {
    const row = await createCompanyRelationshipTimelineEvent({ ...input, skipAudit: true });
    if (row) created += 1;
  }

  await add({
    companyId,
    profileId,
    eventType: "RELATIONSHIP_STARTED",
    title: "Company relationship started",
    description: `${company.name} registered with Alta`,
    occurredAt: company.createdAt,
    dedupeKey: `started:${companyId}`,
  });

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  const accountIds = accounts.map((account) => account.id);

  for (const account of accounts) {
    await add({
      companyId,
      profileId,
      eventType: "BUSINESS_ACCOUNT_OPENED",
      title: "Business account opened",
      description: account.accountName,
      occurredAt: account.createdAt,
      relatedEntityType: "BANK_ACCOUNT",
      relatedEntityId: account.id,
      dedupeKey: `account:${account.id}`,
    });
  }

  const cards = await prisma.altaCard.findMany({
    where: { companyId },
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
    const openedCopy = formatAltaCardOpenedTimelineCopy(openingTier, { business: true });
    await add({
      companyId,
      profileId,
      eventType: "ALTA_CARD_OPENED",
      title: openedCopy.title,
      description: openedCopy.description,
      occurredAt: card.openedAt ?? card.createdAt,
      relatedEntityType: "ALTA_CARD",
      relatedEntityId: card.id,
      dedupeKey: `card:${card.id}`,
    });
  }

  if (cardIds.length > 0) {
    for (const audit of tierAuditsForCards) {
      const meta = audit.metadata as Record<string, unknown> | null;
      const previousTier =
        typeof meta?.previousTier === "string"
          ? meta.previousTier
          : typeof meta?.oldValue === "string"
            ? meta.oldValue
            : null;
      const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
      const upgradeCopy = formatAltaCardTierUpgradeTimelineCopy(previousTier, newTier, {
        business: true,
      });
      await add({
        companyId,
        profileId,
        eventType: "ALTA_CARD_TIER_CHANGED",
        title: upgradeCopy.title,
        description: upgradeCopy.description ?? audit.description ?? undefined,
        occurredAt: audit.createdAt,
        relatedEntityType: audit.entityId ? "ALTA_CARD" : undefined,
        relatedEntityId: audit.entityId ?? undefined,
        metadata: { previousTier, newTier },
        dedupeKey: `audit:tier:${audit.id}`,
      });
    }
  }

  const applications = await prisma.loanApplication.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  for (const app of applications) {
    await add({
      companyId,
      profileId,
      eventType: "LOAN_APPLICATION_SUBMITTED",
      title: "Business lending application submitted",
      description: `Requested ${florin(decimalToNumber(app.requestedAmount))}.`,
      occurredAt: app.createdAt,
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: app.id,
      dedupeKey: `loan-app:submitted:${app.id}`,
    });
  }

  const loans = await prisma.loan.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  for (const loan of loans) {
    if (loan.approvedAt) {
      await add({
        companyId,
        profileId,
        eventType: "LOAN_FUNDED",
        title: `Business loan approved (${florin(decimalToNumber(loan.principalAmount))})`,
        occurredAt: loan.approvedAt,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.id,
        dedupeKey: `loan:funded:${loan.id}`,
      });
    }
    if (loan.status === "PAID_OFF") {
      const paidOff = await prisma.loanLedgerEntry.findFirst({
        where: { loanId: loan.id, type: "STATUS_CHANGE", description: { contains: "paid off" } },
        orderBy: { createdAt: "desc" },
      });
      await add({
        companyId,
        profileId,
        eventType: "LOAN_PAID_OFF",
        title: "Business loan paid off",
        description: "Loan balance fully repaid.",
        occurredAt: paidOff?.createdAt ?? loan.updatedAt,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.id,
        dedupeKey: `loan:paidoff:${loan.id}`,
      });
    }
  }

  const eligibleAudit = (
    await prisma.auditLog.findMany({
      where: { targetCompanyId: companyId, action: "COMPANY_COMMERCIAL_BANKING_ELIGIBILITY_CHANGED" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, metadata: true },
    })
  ).find((audit) => {
    const meta = audit.metadata as Record<string, unknown> | null;
    return meta?.eligible === true;
  });
  if (eligibleAudit) {
    await add({
      companyId,
      profileId,
      eventType: "COMMERCIAL_BANKING_ELIGIBLE",
      title: "Commercial banking eligibility reached",
      occurredAt: eligibleAudit.createdAt,
      dedupeKey: "commercial:eligible",
    });
  }

  const relationshipTierAudits = await prisma.auditLog.findMany({
    where: { targetCompanyId: companyId, action: "COMPANY_RELATIONSHIP_TIER_CHANGED" },
    orderBy: { createdAt: "asc" },
  });
  for (const audit of relationshipTierAudits) {
    const meta = audit.metadata as Record<string, unknown> | null;
    const oldTier = typeof meta?.oldTier === "string" ? meta.oldTier : null;
    const newTier = typeof meta?.newTier === "string" ? meta.newTier : null;
    if (!newTier) continue;
    const tierCopy = formatRelationshipTierChangedCustomerCopy(
      oldTier,
      newTier,
      COMPANY_RELATIONSHIP_TIER_LABELS,
      { business: true },
    );
    await add({
      companyId,
      profileId,
      eventType: "RELATIONSHIP_TIER_CHANGED",
      title: tierCopy.title,
      description: tierCopy.description ?? undefined,
      occurredAt: audit.createdAt,
      metadata: { oldTier, newTier },
      dedupeKey: `audit:relationship-tier:${audit.id}`,
    });
  }

  await backfillCompanyVolumeMilestones(
    companyId,
    profileId,
    accountIds,
    "DEPOSIT_MILESTONE",
    "DEPOSIT",
    LIFETIME_DEPOSITS_MILESTONES,
    "deposits",
    add,
  );
  await backfillCompanyVolumeMilestones(
    companyId,
    profileId,
    accountIds,
    "WITHDRAWAL_MILESTONE",
    "WITHDRAWAL",
    LIFETIME_WITHDRAWALS_MILESTONES,
    "withdrawals",
    add,
  );
  await backfillCompanyVolumeMilestones(
    companyId,
    profileId,
    accountIds,
    "ALTA_PAY_MILESTONE",
    "ALTA_PAY",
    ALTA_PAY_VOLUME_MILESTONES,
    "alta_pay",
    add,
  );

  const actor = await resolveAuditActorId(actorUserId);
  await writeAuditLog({
    actorUserId: actor,
    targetCompanyId: companyId,
    action: "COMPANY_RELATIONSHIP_TIMELINE_BACKFILLED",
    entityType: "COMPANY",
    entityId: profileId ?? companyId,
    description: `Backfilled ${created} company relationship timeline event(s)`,
    metadata: { companyId, eventsCreated: created },
  });

  return created;
}

export async function backfillCompanyRelationshipTimeline(
  companyId: string,
  actorUserId?: string,
): Promise<number> {
  await requireOperator();
  return backfillCompanyRelationshipTimelineCore(companyId, actorUserId);
}

/** Backfill once when a company has no timeline rows yet (safe on customer page load). */
export async function ensureCompanyRelationshipTimelineBackfilled(companyId: string): Promise<number> {
  const existing = await prisma.companyRelationshipTimelineEvent.count({ where: { companyId } });
  if (existing > 0) return 0;
  return backfillCompanyRelationshipTimelineCore(companyId);
}

export async function backfillAllCompanyRelationshipTimelinesCore(actorUserId?: string): Promise<{
  processed: number;
  eventsCreated: number;
  failed: number;
}> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  let eventsCreated = 0;
  let failed = 0;

  for (const company of companies) {
    try {
      eventsCreated += await backfillCompanyRelationshipTimelineCore(company.id, actorUserId);
    } catch {
      failed += 1;
    }
  }

  return { processed: companies.length, eventsCreated, failed };
}

export async function backfillAllCompanyRelationshipTimelines(actorUserId?: string): Promise<{
  processed: number;
  eventsCreated: number;
  failed: number;
}> {
  await requireOperator();
  return backfillAllCompanyRelationshipTimelinesCore(actorUserId);
}

export async function createManualCompanyRelationshipNote(
  companyId: string,
  input: { title: string; description: string },
  actorUserId: string,
): Promise<CompanyRelationshipTimelineEventRow> {
  await requireOperator();
  const profile = await prisma.companyRelationshipProfile.findUnique({ where: { companyId } });
  const row = await prisma.companyRelationshipTimelineEvent.create({
    data: {
      companyId,
      profileId: profile?.id ?? null,
      eventType: "MANUAL_NOTE",
      title: input.title,
      description: input.description,
      occurredAt: new Date(),
      metadata: { actorUserId, manual: true } as Prisma.InputJsonValue,
    },
  });
  await writeAuditLog({
    actorUserId,
    targetCompanyId: companyId,
    action: "COMPANY_RELATIONSHIP_MANUAL_NOTE_CREATED",
    entityType: "COMPANY",
    entityId: row.id,
    description: input.title,
    metadata: { companyId },
  });
  return mapTimelineRow(row);
}
