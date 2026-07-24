import type { CompanyRelationshipTimelineEventType as DbEventType, Prisma } from "@prisma/client";
import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import {
  ALTA_PAY_VOLUME_MILESTONES,
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
  formatAltaPayMilestoneCopy,
  formatBankAccountOpenedCopy,
  formatDepositMilestoneCopy,
  formatLoanPaidOffCopy,
  formatPrivateBankingEligibleCopy,
  formatRelationshipEstablishedCopy,
  formatTotalAssetsMilestoneCopy,
} from "@/lib/bank/relationship-timeline-customer-copy";
import {
  formatAltaCardTierUpgradeTimelineCopy,
  formatAltaCardLimitIncreaseTimelineCopy,
  formatAltaCardRateReductionTimelineCopy,
  formatLoanApprovedTimelineCopy,
  formatRelationshipTierChangedCustomerCopy,
} from "@/lib/bank/relationship-timeline-historical";
import { enrichBusinessCustomerTimeline } from "@/server/relationship-timeline-customer-enrichment.service";
import { sortTimelineEventsNewestFirst } from "@/lib/bank/relationship-timeline-display";
import {
  computeTotalBusinessAssetsMilestoneDates,
  computeVolumeMilestoneDates,
} from "@/server/relationship-timeline.service";
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
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
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
  try {
    const { refreshStoredCompanyTimelineCopy } = await import(
      "@/server/relationship-timeline-customer-enrichment.service"
    );
    await refreshStoredCompanyTimelineCopy(companyId);
  } catch {
    // Legacy copy refresh is best-effort on customer view load.
  }

  const rows = await prisma.companyRelationshipTimelineEvent.findMany({
    where: { companyId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
  const mapped = rows
    .filter((row) => isCustomerVisibleCompanyTimelineEvent({ eventType: row.eventType as never }))
    .map(mapTimelineRow);

  const { dedupeCustomerTimelineRows } = await import(
    "@/lib/bank/relationship-timeline-customer-view"
  );
  return enrichBusinessCustomerTimeline(dedupeCustomerTimelineRows(mapped));
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

  for (const [threshold, occurredAt] of await computeTotalBusinessAssetsMilestoneDates(companyId)) {
    updates += await updateCompanyTimelineEventOccurredAtByDedupeKey(
      companyId,
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

  const limitAudits =
    cardIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { action: "ALTA_CARD_LIMIT_CHANGED", entityId: { in: cardIds } },
          orderBy: { createdAt: "asc" },
          select: { id: true, createdAt: true },
        })
      : [];
  for (const audit of limitAudits) {
    updates += await updateCompanyTimelineEventOccurredAtByDedupeKey(
      companyId,
      `audit:limit:${audit.id}`,
      audit.createdAt,
    );
  }

  const rateAudits =
    cardIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { action: "ALTA_CARD_RATE_CHANGED", entityId: { in: cardIds } },
          orderBy: { createdAt: "asc" },
          select: { id: true, createdAt: true },
        })
      : [];
  for (const audit of rateAudits) {
    updates += await updateCompanyTimelineEventOccurredAtByDedupeKey(
      companyId,
      `audit:rate:${audit.id}`,
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

/** Mirror personal timeline recording for company-scoped product events. */
export async function recordCompanyTimelineEventIfBusiness(
  companyId: string | null | undefined,
  input: Omit<Parameters<typeof createCompanyRelationshipTimelineEvent>[0], "companyId">,
): Promise<void> {
  if (!companyId) return;
  await recordCompanyRelationshipTimelineEvent({ ...input, companyId });
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
  if (
    input.oldTier &&
    input.oldTier !== input.newTier &&
    input.newTier !== "COMMERCIAL_ELIGIBLE"
  ) {
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
      dedupeKey: `tier:${input.oldTier}->${input.newTier}`,
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  }
  if (input.oldCommercialEligible === false && input.newCommercialEligible) {
    const eligibleCopy = formatPrivateBankingEligibleCopy("business");
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.companyId,
      eventType: "COMMERCIAL_BANKING_ELIGIBLE",
      title: eligibleCopy.title,
      description: eligibleCopy.description,
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
    const copy =
      category === "alta_pay"
        ? formatAltaPayMilestoneCopy(threshold, "business")
        : category === "deposits"
          ? formatDepositMilestoneCopy(threshold, "business")
          : formatWithdrawalMilestoneCopy(threshold, "business");
    await add({
      companyId,
      profileId,
      eventType: type,
      title: copy.title,
      description: copy.description,
      occurredAt,
      dedupeKey: milestoneDedupeKey(category, threshold),
      metadata: { threshold, milestoneKind: category.toUpperCase() },
    });
  }
}

/** Idempotent sync from platform records — no auth gate, no backfill audit log. */
export async function syncCompanyRelationshipTimelineFromPlatform(
  companyId: string,
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

  const startedCopy = formatRelationshipEstablishedCopy("business");
  await add({
    companyId,
    profileId,
    eventType: "RELATIONSHIP_STARTED",
    title: startedCopy.title,
    description: startedCopy.description,
    occurredAt: company.createdAt,
    dedupeKey: `started:${companyId}`,
  });

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  const accountIds = accounts.map((account) => account.id);

  for (const account of accounts) {
    const accountCopy = formatBankAccountOpenedCopy(account.accountName, "business");
    await add({
      companyId,
      profileId,
      eventType: "BUSINESS_ACCOUNT_OPENED",
      title: accountCopy.title,
      description: accountCopy.description,
      occurredAt: account.createdAt,
      relatedEntityType: "BANK_ACCOUNT",
      relatedEntityId: account.id,
      metadata: { accountName: account.accountName },
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

    const limitAudits = await prisma.auditLog.findMany({
      where: { action: "ALTA_CARD_LIMIT_CHANGED", entityId: { in: cardIds } },
      orderBy: { createdAt: "asc" },
    });
    for (const audit of limitAudits) {
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
        business: true,
      });
      await add({
        companyId,
        profileId,
        eventType: "ALTA_CARD_LIMIT_CHANGED",
        title: upgradeCopy.title,
        description: upgradeCopy.description ?? audit.description ?? undefined,
        occurredAt: audit.createdAt,
        relatedEntityType: audit.entityId ? "ALTA_CARD" : undefined,
        relatedEntityId: audit.entityId ?? undefined,
        metadata: { previousLimit, newLimit },
        dedupeKey: audit.entityId ? `limit:${audit.entityId}:${newLimit}` : `audit:limit:${audit.id}`,
      });
    }

    const rateAudits = await prisma.auditLog.findMany({
      where: { action: "ALTA_CARD_RATE_CHANGED", entityId: { in: cardIds } },
      orderBy: { createdAt: "asc" },
    });
    for (const audit of rateAudits) {
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
        business: true,
      });
      await add({
        companyId,
        profileId,
        eventType: "ALTA_CARD_RATE_CHANGED",
        title: reductionCopy.title,
        description: reductionCopy.description ?? audit.description ?? undefined,
        occurredAt: audit.createdAt,
        relatedEntityType: audit.entityId ? "ALTA_CARD" : undefined,
        relatedEntityId: audit.entityId ?? undefined,
        metadata: { previousRate, newRate },
        dedupeKey: audit.entityId ? `rate:${audit.entityId}:${newRate}` : `audit:rate:${audit.id}`,
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
      const loanCopy = formatLoanApprovedTimelineCopy(decimalToNumber(loan.principalAmount), {
        business: true,
      });
      await add({
        companyId,
        profileId,
        eventType: "LOAN_FUNDED",
        title: loanCopy.title,
        description: loanCopy.description,
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
      const paidOffCopy = formatLoanPaidOffCopy("business");
      await add({
        companyId,
        profileId,
        eventType: "LOAN_PAID_OFF",
        title: paidOffCopy.title,
        description: paidOffCopy.description,
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
    const eligibleCopy = formatPrivateBankingEligibleCopy("business");
    await add({
      companyId,
      profileId,
      eventType: "COMMERCIAL_BANKING_ELIGIBLE",
      title: eligibleCopy.title,
      description: eligibleCopy.description ?? undefined,
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
    if (!newTier || newTier === "COMMERCIAL_ELIGIBLE") continue;
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
      dedupeKey: oldTier ? `tier:${oldTier}->${newTier}` : `tier:->${newTier}`,
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
    "ALTA_PAY_MILESTONE",
    "ALTA_PAY",
    ALTA_PAY_VOLUME_MILESTONES,
    "alta_pay",
    add,
  );

  for (const [threshold, occurredAt] of await computeTotalBusinessAssetsMilestoneDates(companyId)) {
    const copy = formatTotalAssetsMilestoneCopy(threshold, "business");
    await add({
      companyId,
      profileId,
      eventType: "DEPOSIT_MILESTONE",
      title: copy.title,
      description: copy.description,
      occurredAt,
      dedupeKey: milestoneDedupeKey("assets", threshold),
      metadata: { threshold, milestoneKind: "TOTAL_BUSINESS_ASSETS" },
    });
  }

  try {
    const { refreshStoredCompanyTimelineCopy } = await import(
      "@/server/relationship-timeline-customer-enrichment.service"
    );
    await refreshStoredCompanyTimelineCopy(companyId);
  } catch {
    // Legacy copy refresh is best-effort after sync.
  }

  return created;
}

/** Idempotent rebuild from platform records — no auth gate (scripts, cron, first-load ensure). */
export async function backfillCompanyRelationshipTimelineCore(
  companyId: string,
  actorUserId?: string,
): Promise<number> {
  const created = await syncCompanyRelationshipTimelineFromPlatform(companyId);
  const profile = await prisma.companyRelationshipProfile.findUnique({ where: { companyId } });
  const profileId = profile?.id ?? null;

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

/** Keep company timeline in sync on customer view load (idempotent, no backfill audit). */
export async function ensureCompanyRelationshipTimelineBackfilled(companyId: string): Promise<number> {
  return syncCompanyRelationshipTimelineFromPlatform(companyId);
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
