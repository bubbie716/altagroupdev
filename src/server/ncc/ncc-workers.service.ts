import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { attemptAutomaticCompensation } from "@/server/ncc/ncc-compensation.service";
import { processDueRetries } from "@/server/ncc/ncc-execution.service";
import {
  listRegisteredOutboxEventTypes,
  processDueOutboxEvents,
  registerOutboxHandler,
} from "@/server/ncc/ncc-outbox.service";
import { NCC_LIQUIDITY_OUTBOX } from "@/server/ncc/ncc-liquidity.service";
import { runReconciliationSweep } from "@/server/ncc/ncc-reconciliation.service";
import { recordOpsJobSuccess, recordOpsJobFailure } from "@/server/ops-job-run.service";
import { registerSettlementWebhookOutboxHandlers } from "@/server/ncc/ncc-webhook-fanout.service";
import { processDueWebhookDeliveries } from "@/server/ncc/ncc-webhook-delivery.service";
import { expireDueCredentials } from "@/server/ncc/ncc-api-credential.service";
import { pruneNccRateLimitBuckets } from "@/server/ncc/ncc-api-rate-limit.service";
import { pruneNccApiRequestLogs } from "@/server/ncc/ncc-api-request-log.service";

const WORKER_JOB_KEY = "ncc-settlement-workers";
/** Lease slightly under the 2-minute cron cadence. */
const WORKER_LOCK_LEASE_MS = 55_000;
/** Alert when last success is older than this. */
export const NCC_WORKER_OVERDUE_MS = 10 * 60 * 1000;
const AUTO_COMPENSATION_BATCH = 10;

let handlersRegistered = false;

function ensureOutboxHandlers(): void {
  if (handlersRegistered) return;
  registerSettlementWebhookOutboxHandlers(registerOutboxHandler);

  // Liquidity events must have handlers so no valid type fails for missing registration.
  const liquidityAck = async () => {
    // Acknowledged — settlement webhook fanout is instruction-scoped; liquidity
    // alerts are already audited when enqueued. Handler presence is required.
  };
  for (const eventType of Object.values(NCC_LIQUIDITY_OUTBOX)) {
    registerOutboxHandler(eventType, liquidityAck);
  }

  handlersRegistered = true;
}

export function ensureNccOutboxHandlersRegistered(): void {
  ensureOutboxHandlers();
}

export function listExpectedOutboxEventTypes(): string[] {
  return [
    ...Object.values(
      // inline import avoided — use static values from liquidity + known settlement events
      {
        SUBMITTED: "settlement.submitted",
        NCC_POSTED: "settlement.ncc_posted",
        COMPLETED: "settlement.completed",
        FAILED: "settlement.failed",
        CANCELLED: "settlement.cancelled",
        RETRY_PENDING: "settlement.retry_pending",
        MANUAL_REVIEW: "settlement.manual_review",
        REVERSED: "settlement.reversed",
        COMPENSATED: "settlement.compensated",
      },
    ),
    ...Object.values(NCC_LIQUIDITY_OUTBOX),
  ].sort();
}

async function tryAcquireWorkerLock(lockedBy: string): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + WORKER_LOCK_LEASE_MS);
  const existing = await prisma.nccWorkerLock.findUnique({ where: { jobKey: WORKER_JOB_KEY } });
  if (existing && existing.lockedUntil > now) {
    return false;
  }
  await prisma.nccWorkerLock.upsert({
    where: { jobKey: WORKER_JOB_KEY },
    create: { jobKey: WORKER_JOB_KEY, lockedBy, lockedUntil },
    update: { lockedBy, lockedUntil },
  });
  // Re-read to detect lost race.
  const held = await prisma.nccWorkerLock.findUnique({ where: { jobKey: WORKER_JOB_KEY } });
  return held?.lockedBy === lockedBy && held.lockedUntil > now;
}

async function releaseWorkerLock(lockedBy: string): Promise<void> {
  await prisma.nccWorkerLock.deleteMany({
    where: { jobKey: WORKER_JOB_KEY, lockedBy },
  });
}

async function processAutomaticCompensationBatch(limit = AUTO_COMPENSATION_BATCH): Promise<{
  attempted: number;
  compensated: number;
  skipped: number;
  errors: number;
}> {
  const candidates = await prisma.settlementExecution.findMany({
    where: {
      status: { in: ["FAILED", "MANUAL_REVIEW"] },
      compensation: { is: null },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { settlementInstructionId: true },
  });

  let compensated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of candidates) {
    try {
      const result = await attemptAutomaticCompensation(row.settlementInstructionId);
      if (result.outcome === "compensated" || result.outcome === "already_compensated") {
        compensated += 1;
      } else {
        skipped += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { attempted: candidates.length, compensated, skipped, errors };
}

/**
 * Individual real-time recovery worker — never batches or nets settlements.
 * Each incomplete execution is advanced independently.
 */
export async function runNccSettlementWorkers(): Promise<Record<string, unknown>> {
  const started = Date.now();
  const lockedBy = `worker:${randomUUID()}`;
  ensureOutboxHandlers();

  const acquired = await tryAcquireWorkerLock(lockedBy);
  if (!acquired) {
    return {
      ok: true,
      skipped: true,
      reason: "OVERLAP_LOCK_HELD",
      durationMs: Date.now() - started,
      registeredOutboxHandlers: listRegisteredOutboxEventTypes(),
    };
  }

  try {
    const retries = await processDueRetries(25);
    const outbox = await processDueOutboxEvents(50);
    const webhooks = await processDueWebhookDeliveries(25);
    const reconciliation = await runReconciliationSweep(25);
    const compensation = await processAutomaticCompensationBatch();

    // Expired / rejected mandatory docs → compliance alerts (control-plane action remains manual).
    try {
      const { countExpiredRegulatoryDocuments } = await import(
        "@/server/ncc/ncc-participant-documents.service"
      );
      const expiredDocs = await countExpiredRegulatoryDocuments();
      if (expiredDocs > 0) {
        const { upsertOpenAlertRecord } = await import("@/server/ncc/ncc-alerts.service");
        await upsertOpenAlertRecord({
          alertKey: "compliance.regulatory_documents.expired",
          title: "Expired regulatory documents",
          detail: `${expiredDocs} expired regulatory document(s) require compliance action.`,
          severity: "CRITICAL",
          entityType: "NCC_PARTICIPANT_DOCUMENT",
          entityId: "expired-set",
          metadata: { count: expiredDocs },
        });
      }
    } catch {
      // Non-fatal — worker continues.
    }

    const expiredCredentials = await expireDueCredentials(50);
    const prunedBuckets = await pruneNccRateLimitBuckets();
    const prunedLogs = await pruneNccApiRequestLogs(90);

    const incomplete = await prisma.settlementExecution.count({
      where: { status: { notIn: ["COMPLETED", "FAILED", "COMPENSATED"] } },
    });
    const manualReview = await prisma.settlementExecution.count({
      where: { status: "MANUAL_REVIEW" },
    });
    const pendingDeliveries = await prisma.nccWebhookDelivery.count({
      where: { status: { in: ["PENDING", "RETRY_PENDING", "DELIVERING"] } },
    });
    const failedDeliveries = await prisma.nccWebhookDelivery.count({
      where: { status: "FAILED" },
    });
    const oldest = await prisma.settlementExecution.findFirst({
      where: {
        status: {
          in: ["RETRY_PENDING", "MANUAL_REVIEW", "NCC_LEDGER_POSTED", "SOURCE_COMMITTED"],
        },
      },
      orderBy: { updatedAt: "asc" },
      select: { id: true, status: true, updatedAt: true, settlementInstructionId: true },
    });

    const jobRun = await prisma.opsJobRun.findUnique({ where: { jobKey: WORKER_JOB_KEY } });
    const lastSuccessAt = jobRun?.lastSuccessAt ?? null;
    const overdue =
      !lastSuccessAt || Date.now() - lastSuccessAt.getTime() > NCC_WORKER_OVERDUE_MS;

    await recordOpsJobSuccess(
      WORKER_JOB_KEY,
      "NCC real-time settlement workers",
      `retries=${retries.length} outbox=${outbox.processed} webhooks=${webhooks.delivered} reconcile=${reconciliation.length} compensation=${compensation.compensated}`,
    );

    if (overdue && lastSuccessAt) {
      const { upsertOpenAlertRecord } = await import("@/server/ncc/ncc-alerts.service");
      await upsertOpenAlertRecord({
        alertKey: "worker.ncc-settlement.overdue",
        title: "NCC settlement worker overdue",
        detail: `Last success was ${lastSuccessAt.toISOString()}`,
        severity: "CRITICAL",
        entityType: "NCC_WORKER_LOCK",
        entityId: WORKER_JOB_KEY,
      });
    }

    return {
      ok: true,
      durationMs: Date.now() - started,
      retriesProcessed: retries.length,
      outbox,
      webhooks,
      reconciliations: reconciliation.length,
      compensation,
      incompleteExecutions: incomplete,
      manualReviewCount: manualReview,
      pendingWebhookDeliveries: pendingDeliveries,
      failedWebhookDeliveries: failedDeliveries,
      reclaimedStaleWebhookDeliveries: webhooks.reclaimedStale,
      reclaimedStaleOutboxEvents: outbox.reclaimedStale,
      expiredCredentials,
      prunedRateLimitBuckets: prunedBuckets,
      prunedApiRequestLogs: prunedLogs,
      oldestIncomplete: oldest,
      workerOverdueBeforeRun: overdue,
      registeredOutboxHandlers: listRegisteredOutboxEventTypes(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordOpsJobFailure(WORKER_JOB_KEY, "NCC real-time settlement workers", message);
    throw error;
  } finally {
    await releaseWorkerLock(lockedBy);
  }
}

/** Authorized staff manual trigger. */
export async function triggerNccSettlementWorkersManually(): Promise<Record<string, unknown>> {
  const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
  const { NCC_AUDIT } = await import("@/lib/ncc/ncc-audit-actions");
  const actor = await requireNccStaff("trigger_workers");
  const result = await runNccSettlementWorkers();
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: actor.id,
    action: NCC_AUDIT.WORKER_TRIGGERED,
    entityType: "NCC_WORKER_LOCK",
    entityId: WORKER_JOB_KEY,
    description: "NCC settlement workers triggered manually",
    metadata: { skipped: Boolean(result.skipped) },
  });
  return result;
}
