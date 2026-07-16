import { Prisma, type SettlementOutboxEvent } from "@prisma/client";
import { prisma } from "@/server/db";
import { randomHexToken } from "@/server/crypto";

export type OutboxHandler = (event: SettlementOutboxEvent) => Promise<void>;

/** Root Prisma client or interactive transaction client. */
export type OutboxDbClient = Prisma.TransactionClient | typeof prisma;

const handlers = new Map<string, OutboxHandler>();

/** Stale PROCESSING claims older than this are reclaimable. */
export const OUTBOX_CLAIM_LEASE_MS = 90_000;

/** Stable outbox event type constants used by the settlement workflow. */
export const NCC_OUTBOX_EVENTS = {
  SUBMITTED: "settlement.submitted",
  NCC_POSTED: "settlement.ncc_posted",
  COMPLETED: "settlement.completed",
  FAILED: "settlement.failed",
  RETRY_PENDING: "settlement.retry_pending",
  MANUAL_REVIEW: "settlement.manual_review",
  REVERSED: "settlement.reversed",
  COMPENSATED: "settlement.compensated",
} as const;

export type NccOutboxEventType = (typeof NCC_OUTBOX_EVENTS)[keyof typeof NCC_OUTBOX_EVENTS];

/** Registers a handler for a given outbox eventType. Call at module init time. */
export function registerOutboxHandler(eventType: string, handler: OutboxHandler): void {
  handlers.set(eventType, handler);
}

/**
 * Enqueues a durable outbox event. Idempotent on `dedupeKey` — a duplicate
 * enqueue returns the already-persisted event rather than erroring.
 *
 * Pass the active Prisma transaction client when financial state and the event
 * must commit atomically. Delivery remains asynchronous via processDueOutboxEvents.
 */
export async function enqueueOutboxEvent(
  input: {
    settlementInstructionId?: string;
    eventType: string;
    payload: Record<string, unknown>;
    dedupeKey: string;
    maxAttempts?: number;
  },
  db: OutboxDbClient = prisma,
): Promise<SettlementOutboxEvent> {
  const existing = await db.settlementOutboxEvent.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (existing) return existing;

  try {
    return await db.settlementOutboxEvent.create({
      data: {
        settlementInstructionId: input.settlementInstructionId ?? null,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey,
        status: "PENDING",
        maxAttempts: input.maxAttempts ?? 10,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.settlementOutboxEvent.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } });
    }
    throw error;
  }
}

function backoffMsFor(attempts: number): number {
  return Math.min(2 ** attempts * 30_000, 30 * 60_000);
}

export async function claimOutboxEvent(
  eventId: string,
  expectedStatuses: Array<"PENDING" | "FAILED" | "PROCESSING">,
  leaseMs = OUTBOX_CLAIM_LEASE_MS,
): Promise<string | null> {
  const claimToken = randomHexToken(16);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - leaseMs);

  const claimed = await prisma.settlementOutboxEvent.updateMany({
    where: {
      id: eventId,
      OR: [
        { status: { in: expectedStatuses.filter((s) => s !== "PROCESSING") } },
        { status: "PROCESSING", claimedAt: { lt: staleBefore } },
        { status: "PROCESSING", claimedAt: null },
      ],
    },
    data: {
      status: "PROCESSING",
      claimedAt: now,
      claimToken,
    },
  });
  return claimed.count === 1 ? claimToken : null;
}

/**
 * Claims and processes due outbox events (PENDING, FAILED past backoff, or stale PROCESSING).
 * Handler failure never mutates settlement financial state.
 */
export async function processDueOutboxEvents(limit = 25): Promise<{
  processed: number;
  failed: number;
  reclaimedStale: number;
}> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - OUTBOX_CLAIM_LEASE_MS);

  const due = await prisma.settlementOutboxEvent.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextRetryAt: { lte: now } },
        { status: "PROCESSING", claimedAt: { lt: staleBefore } },
        { status: "PROCESSING", claimedAt: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(limit, 100),
  });

  let processed = 0;
  let failed = 0;
  let reclaimedStale = 0;

  for (const event of due) {
    if (event.status === "PROCESSING") reclaimedStale += 1;
    const claimToken = await claimOutboxEvent(event.id, [event.status as "PENDING" | "FAILED" | "PROCESSING"]);
    if (!claimToken) continue;

    const handler = handlers.get(event.eventType);
    try {
      if (!handler) throw new Error(`No outbox handler registered for eventType "${event.eventType}"`);
      await handler(event);
      const completed = await prisma.settlementOutboxEvent.updateMany({
        where: { id: event.id, claimToken, status: "PROCESSING" },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lastError: null,
          claimToken: null,
          claimedAt: null,
        },
      });
      if (completed.count === 1) processed += 1;
    } catch (error) {
      failed += 1;
      const attempts = event.attempts + 1;
      const exhausted = attempts >= event.maxAttempts;
      await prisma.settlementOutboxEvent.updateMany({
        where: { id: event.id, claimToken, status: "PROCESSING" },
        data: {
          status: "FAILED",
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: exhausted ? null : new Date(Date.now() + backoffMsFor(attempts)),
          claimToken: null,
          claimedAt: null,
        },
      });
    }
  }

  return { processed, failed, reclaimedStale };
}

/** Manually requeues an exhausted (permanently FAILED) outbox event for another attempt. */
export async function requeueOutboxEvent(id: string): Promise<SettlementOutboxEvent> {
  return prisma.settlementOutboxEvent.update({
    where: { id },
    data: {
      status: "PENDING",
      nextRetryAt: null,
      lastError: null,
      claimToken: null,
      claimedAt: null,
    },
  });
}

export async function listOutboxEventsForInstruction(instructionId: string): Promise<SettlementOutboxEvent[]> {
  return prisma.settlementOutboxEvent.findMany({
    where: { settlementInstructionId: instructionId },
    orderBy: { createdAt: "desc" },
  });
}
