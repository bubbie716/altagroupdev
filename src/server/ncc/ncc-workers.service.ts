import { prisma } from "@/server/db";
import { processDueRetries } from "@/server/ncc/ncc-execution.service";
import { processDueOutboxEvents, registerOutboxHandler } from "@/server/ncc/ncc-outbox.service";
import { runReconciliationSweep } from "@/server/ncc/ncc-reconciliation.service";
import { recordOpsJobSuccess, recordOpsJobFailure } from "@/server/ops-job-run.service";
import { registerSettlementWebhookOutboxHandlers } from "@/server/ncc/ncc-webhook-fanout.service";
import { processDueWebhookDeliveries } from "@/server/ncc/ncc-webhook-delivery.service";
import { expireDueCredentials } from "@/server/ncc/ncc-api-credential.service";
import { pruneNccRateLimitBuckets } from "@/server/ncc/ncc-api-rate-limit.service";
import { pruneNccApiRequestLogs } from "@/server/ncc/ncc-api-request-log.service";

let handlersRegistered = false;

function ensureWebhookOutboxHandlers(): void {
  if (handlersRegistered) return;
  registerSettlementWebhookOutboxHandlers(registerOutboxHandler);
  handlersRegistered = true;
}

/**
 * Individual real-time recovery worker — never batches or nets settlements.
 * Each incomplete execution is advanced independently.
 * Sprint 3B also fans out webhooks and delivers signed events.
 */
export async function runNccSettlementWorkers(): Promise<Record<string, unknown>> {
  const started = Date.now();
  ensureWebhookOutboxHandlers();
  try {
    const retries = await processDueRetries(25);
    const outbox = await processDueOutboxEvents(50);
    const webhooks = await processDueWebhookDeliveries(25);
    const reconciliation = await runReconciliationSweep(25);
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

    await recordOpsJobSuccess(
      "ncc-settlement-workers",
      "NCC real-time settlement workers",
      `retries=${retries.length} outbox=${outbox.processed} outboxReclaimed=${outbox.reclaimedStale} webhooks=${webhooks.delivered} webhookReclaimed=${webhooks.reclaimedStale} reconcile=${reconciliation.length}`,
    );

    return {
      ok: true,
      durationMs: Date.now() - started,
      retriesProcessed: retries.length,
      outbox,
      webhooks,
      reconciliations: reconciliation.length,
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
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordOpsJobFailure("ncc-settlement-workers", "NCC real-time settlement workers", message);
    throw error;
  }
}
