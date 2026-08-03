/**
 * Phase 8 — Discord outbox operator controls + stale PROCESSING recovery.
 */

import type { DiscordOutbox, DiscordOutboxStatus } from "@prisma/client";
import type { DiscordTargetBot } from "@/lib/discord/discord-event-envelope";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";
import { prisma } from "@/server/db";
import {
  getDiscordOutboxHealthSnapshot,
  isDiscordOutboxDualWriteEnabled,
  type DiscordOutboxHealthSnapshot,
} from "@/server/discord-outbox.service";
import { getDiscordPlatformReadiness } from "@/lib/discord/discord-config-readiness";

/** Rows stuck in PROCESSING longer than this are requeued as PENDING. */
export const STALE_PROCESSING_MS = 15 * 60_000;

/** Pure predicate for stale PROCESSING recovery (safe under concurrent claimers). */
export function isStaleProcessingRow(
  row: { status: string; updatedAt: Date },
  now: Date = new Date(),
  staleMs: number = STALE_PROCESSING_MS,
): boolean {
  if (row.status !== "PROCESSING") return false;
  return now.getTime() - row.updatedAt.getTime() >= staleMs;
}

const VALID_BOTS = new Set<DiscordTargetBot>(["bank", "secretary", "terminal"]);

export type DiscordOutboxOpsRowSummary = {
  id: string;
  eventType: string;
  product: string;
  targetBot: string;
  channelClass: string;
  status: DiscordOutboxStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
  correlationId: string | null;
  idempotencyKeyPreview: string;
  payloadKind: string | null;
  sanitizedPreview: string | null;
};

export type DiscordOutboxOpsSnapshot = {
  health: DiscordOutboxHealthSnapshot;
  readiness: ReturnType<typeof getDiscordPlatformReadiness>;
  recent: DiscordOutboxOpsRowSummary[];
  countsByStatus: Record<string, number>;
  oldestPendingAgeMs: number | null;
  recoveredStaleProcessing: number;
};

function summarizeRow(row: DiscordOutbox): DiscordOutboxOpsRowSummary {
  const payload =
    row.displayPayload && typeof row.displayPayload === "object" && !Array.isArray(row.displayPayload)
      ? (row.displayPayload as Record<string, unknown>)
      : null;
  const kind = typeof payload?.kind === "string" ? payload.kind : null;
  let preview: string | null = null;
  if (kind === "staff_audit" && typeof payload?.content === "string") {
    preview = sanitizeStaffAuditDetails(payload.content);
  } else if (kind === "customer_dm" && typeof payload?.title === "string") {
    preview = sanitizeStaffAuditDetails(
      `${payload.title}${typeof payload.body === "string" ? ` — ${String(payload.body).slice(0, 120)}` : ""}`,
    );
  } else if (kind === "role_mgmt") {
    preview = sanitizeStaffAuditDetails(
      `role ${String(payload?.productRole ?? "")} ${String(payload?.action ?? "")}`,
    );
  }

  return {
    id: row.id,
    eventType: row.eventType,
    product: row.product,
    targetBot: row.targetBot,
    channelClass: row.channelClass,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError ? sanitizeStaffAuditDetails(row.lastError) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    correlationId: row.correlationId,
    idempotencyKeyPreview: row.idempotencyKey.slice(0, 64),
    payloadKind: kind,
    sanitizedPreview: preview,
  };
}

/**
 * Requeue PROCESSING rows that have been stuck longer than STALE_PROCESSING_MS.
 * Safe under concurrent workers — only touches stale PROCESSING rows.
 */
export async function recoverStaleDiscordOutboxProcessing(
  now: Date = new Date(),
  staleMs: number = STALE_PROCESSING_MS,
): Promise<number> {
  if (!isDiscordOutboxDualWriteEnabled()) return 0;
  const cutoff = new Date(now.getTime() - staleMs);
  try {
    const result = await prisma.discordOutbox.updateMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lte: cutoff },
      },
      data: {
        status: "PENDING",
        nextAttemptAt: now,
        lastError: "stale_processing_recovered",
      },
    });
    return result.count;
  } catch {
    return 0;
  }
}

export async function getDiscordOutboxOpsSnapshot(input?: {
  limit?: number;
  recoverStale?: boolean;
}): Promise<DiscordOutboxOpsSnapshot> {
  const recoveredStaleProcessing = input?.recoverStale
    ? await recoverStaleDiscordOutboxProcessing()
    : 0;

  const health = await getDiscordOutboxHealthSnapshot();
  const readiness = getDiscordPlatformReadiness();
  const limit = Math.min(Math.max(input?.limit ?? 40, 1), 100);

  const recentRows = await prisma.discordOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const statusGroups = await prisma.discordOutbox.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countsByStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    countsByStatus[g.status] = g._count._all;
  }

  const oldestPending = await prisma.discordOutbox.findFirst({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return {
    health,
    readiness,
    recent: recentRows.map(summarizeRow),
    countsByStatus,
    oldestPendingAgeMs: oldestPending
      ? Date.now() - oldestPending.createdAt.getTime()
      : null,
    recoveredStaleProcessing,
  };
}

export async function getDiscordOutboxRowDetail(outboxId: string): Promise<DiscordOutboxOpsRowSummary | null> {
  const row = await prisma.discordOutbox.findUnique({ where: { id: outboxId } });
  return row ? summarizeRow(row) : null;
}

/**
 * Retry a FAILED/DEAD row (or stale PROCESSING) by returning it to PENDING.
 * Does not create a duplicate row — same idempotency key.
 */
export async function retryDiscordOutboxDelivery(input: {
  outboxId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok: true; row: DiscordOutboxOpsRowSummary } | { ok: false; reason: string }> {
  const row = await prisma.discordOutbox.findUnique({ where: { id: input.outboxId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (!VALID_BOTS.has(row.targetBot as DiscordTargetBot)) {
    return { ok: false, reason: "invalid_target_bot" };
  }
  if (!["FAILED", "DEAD", "PROCESSING"].includes(row.status)) {
    return { ok: false, reason: `not_retryable:${row.status}` };
  }
  if (row.status === "SENT") {
    return { ok: false, reason: "already_sent" };
  }

  const updated = await prisma.discordOutbox.update({
    where: { id: row.id },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
      lastError: null,
    },
  });

  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: input.actorUserId,
      action: "DISCORD_OUTBOX_RETRY",
      entityType: "PLATFORM",
      entityId: row.id,
      description: `Retry Discord outbox ${row.eventType} → ${row.targetBot}`,
      metadata: {
        reason: input.reason.slice(0, 200),
        previousStatus: row.status,
        targetBot: row.targetBot,
        eventType: row.eventType,
      },
    });
  } catch {
    /* best-effort audit */
  }

  return { ok: true, row: summarizeRow(updated) };
}

/**
 * Safe replay: only allowed for SENT rows by creating a new destination-specific
 * PENDING row with a replay suffix on the idempotency key (never duplicates SENT).
 */
export async function replayDiscordOutboxDelivery(input: {
  outboxId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok: true; row: DiscordOutboxOpsRowSummary } | { ok: false; reason: string }> {
  const row = await prisma.discordOutbox.findUnique({ where: { id: input.outboxId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "SENT" && row.status !== "DEAD") {
    return { ok: false, reason: `not_replayable:${row.status}` };
  }

  const replayKey = `${row.idempotencyKey}:replay:${Date.now()}`;
  const created = await prisma.discordOutbox.create({
    data: {
      eventId: `${row.eventId}:replay:${Date.now()}`,
      idempotencyKey: replayKey,
      product: row.product,
      eventType: row.eventType,
      targetBot: row.targetBot,
      channelClass: row.channelClass,
      severity: row.severity,
      correlationId: row.correlationId,
      actorJson: row.actorJson ?? undefined,
      subjectJson: row.subjectJson ?? undefined,
      displayPayload: row.displayPayload ?? {},
      internalRef: row.internalRef ?? undefined,
      deliveryPolicy: row.deliveryPolicy,
      status: "PENDING",
      attempts: 0,
      maxAttempts: row.maxAttempts,
      nextAttemptAt: new Date(),
    },
  });

  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: input.actorUserId,
      action: "DISCORD_OUTBOX_REPLAY",
      entityType: "PLATFORM",
      entityId: created.id,
      description: `Replay Discord outbox ${row.eventType} → ${row.targetBot}`,
      metadata: {
        reason: input.reason.slice(0, 200),
        sourceOutboxId: row.id,
        targetBot: row.targetBot,
        eventType: row.eventType,
      },
    });
  } catch {
    /* best-effort */
  }

  return { ok: true, row: summarizeRow(created) };
}
