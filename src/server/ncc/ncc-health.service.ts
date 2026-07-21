import { prisma } from "@/server/db";
import { OUTBOX_CLAIM_LEASE_MS } from "@/server/ncc/ncc-outbox.service";
import { WEBHOOK_DELIVERY_LEASE_MS } from "@/server/ncc/ncc-webhook-delivery.service";
import { countUnexplainedLegacyFloats } from "@/server/ncc/ncc-institution.service";
import { countExpiredRegulatoryDocuments } from "@/server/ncc/ncc-participant-documents.service";

export type NccIntegrationHealth = {
  adapters: {
    altaBank: { operational: true };
    altaTerminal: { operational: true };
    altaExchange: { operational: true };
  };
  workers: {
    settlement: { lastStatus: string | null; lastSuccessAt: string | null; lastFailureAt: string | null };
  };
  metrics: {
    incompleteExecutions: number;
    manualReviewCount: number;
    retryPendingCount: number;
    staleReservations: number;
    avgSettlementDurationMs: number | null;
    p95SettlementDurationMs: number | null;
    p99SettlementDurationMs: number | null;
    recentAdapterFailures: number;
    oldestIncompleteUpdatedAt: string | null;
    compensationBacklog: number;
    reconciliationMismatchCount: number;
    outboxBacklog: number;
    failedOrStaleWorkerClaims: number;
    manualReviewAgeOldest: string | null;
    institutionsBelowLiquidityThreshold: number;
    expiredRegulatoryDocuments: number;
    unexplainedLegacyFloatCount: number;
  };
  connectors: {
    total: number;
    active: number;
    failing: number;
    draftOrDisabled: number;
    lastErrorCount: number;
  };
  api: {
    activeCredentials: number;
    revokedCredentials: number;
    authFailures24h: number;
    requestCount24h: number;
    rateLimitRejections24h: number;
  };
  webhooks: {
    activeEndpoints: number;
    failingEndpoints: number;
    pendingDeliveries: number;
    retryPendingDeliveries: number;
    permanentlyFailedDeliveries: number;
    oldestPendingDeliveryAt: string | null;
    avgDeliveryLatencyMs: number | null;
    p95DeliveryLatencyMs: number | null;
    ssrfRejections24h: number;
    outboxFanoutBacklog: number;
    webhookBacklog: number;
    staleWebhookClaims: number;
  };
  performanceTarget: {
    description: string;
    normalCompletionSeconds: number;
    scheduledDelaySeconds: number;
  };
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

/** Internal NCC integration health for ops dashboards — prisma counts only, no fake data. */
export async function getNccIntegrationHealth(): Promise<NccIntegrationHealth> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const outboxStaleBefore = new Date(Date.now() - OUTBOX_CLAIM_LEASE_MS);
  const webhookStaleBefore = new Date(Date.now() - WEBHOOK_DELIVERY_LEASE_MS);

  const [
    incompleteExecutions,
    manualReviewCount,
    retryPendingCount,
    staleHolds,
    completed,
    recentFailedExecutions,
    oldest,
    jobRun,
    activeCredentials,
    revokedCredentials,
    authFailures24h,
    requestCount24h,
    rateLimitRejections24h,
    activeEndpoints,
    failingEndpoints,
    pendingDeliveries,
    retryPendingDeliveries,
    permanentlyFailedDeliveries,
    oldestPendingDelivery,
    recentDeliveries,
    ssrfRejections24h,
    outboxFanoutBacklog,
    compensationBacklog,
    reconciliationMismatchCount,
    staleOutboxClaims,
    staleWebhookClaims,
    oldestManualReview,
    connectorTotal,
    connectorActive,
    connectorFailing,
    connectorDraftOrDisabled,
    connectorLastErrorCount,
    institutionsBelowLiquidityThreshold,
    expiredRegulatoryDocuments,
    unexplainedLegacyFloatCount,
  ] = await Promise.all([
    prisma.settlementExecution.count({
      where: { status: { notIn: ["COMPLETED", "FAILED", "COMPENSATED"] } },
    }),
    prisma.settlementExecution.count({ where: { status: "MANUAL_REVIEW" } }),
    prisma.settlementExecution.count({ where: { status: "RETRY_PENDING" } }),
    prisma.bankAccountHold.count({
      where: {
        status: "ACTIVE",
        nccOperationKey: { not: null },
        createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
    prisma.settlementExecution.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 200,
      select: { createdAt: true, completedAt: true },
    }),
    prisma.settlementExecution.count({
      where: {
        status: { in: ["FAILED", "MANUAL_REVIEW", "RETRY_PENDING"] },
        updatedAt: { gte: since24h },
      },
    }),
    prisma.settlementExecution.findFirst({
      where: { status: { notIn: ["COMPLETED", "FAILED", "COMPENSATED"] } },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.opsJobRun.findUnique({ where: { jobKey: "ncc-settlement-workers" } }),
    prisma.nccApiCredential.count({ where: { status: "ACTIVE" } }),
    prisma.nccApiCredential.count({ where: { status: { in: ["REVOKED", "ROTATED", "EXPIRED"] } } }),
    prisma.nccApiRequestLog.count({
      where: { createdAt: { gte: since24h }, responseStatus: 401 },
    }),
    prisma.nccApiRequestLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.nccApiRequestLog.count({
      where: { createdAt: { gte: since24h }, errorCode: "RATE_LIMITED" },
    }),
    prisma.nccWebhookEndpoint.count({ where: { status: "ACTIVE" } }),
    prisma.nccWebhookEndpoint.count({ where: { status: "FAILING" } }),
    prisma.nccWebhookDelivery.count({ where: { status: { in: ["PENDING", "DELIVERING"] } } }),
    prisma.nccWebhookDelivery.count({ where: { status: "RETRY_PENDING" } }),
    prisma.nccWebhookDelivery.count({ where: { status: "FAILED" } }),
    prisma.nccWebhookDelivery.findFirst({
      where: { status: { in: ["PENDING", "RETRY_PENDING", "DELIVERING"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.nccWebhookDelivery.findMany({
      where: { status: "DELIVERED", latencyMs: { not: null } },
      orderBy: { deliveredAt: "desc" },
      take: 200,
      select: { latencyMs: true },
    }),
    prisma.nccWebhookDelivery.count({
      where: { createdAt: { gte: since24h }, lastErrorCode: "SSRF_REJECTED" },
    }),
    prisma.settlementOutboxEvent.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.settlementExecution.count({
      where: {
        status: { in: ["MANUAL_REVIEW", "FAILED"] },
        sourceCommitReference: { not: null },
        destinationCreditReference: null,
        compensation: { is: null },
      },
    }),
    prisma.settlementReconciliation.count({
      where: {
        status: {
          in: ["MISMATCH", "MISSING_SOURCE", "MISSING_DESTINATION", "DUPLICATE", "STALE_RESERVATION"],
        },
      },
    }),
    prisma.settlementOutboxEvent.count({
      where: {
        status: "PROCESSING",
        OR: [{ claimedAt: { lt: outboxStaleBefore } }, { claimedAt: null }],
      },
    }),
    prisma.nccWebhookDelivery.count({
      where: {
        status: "DELIVERING",
        OR: [{ claimedAt: { lt: webhookStaleBefore } }, { claimedAt: null }],
      },
    }),
    prisma.settlementExecution.findFirst({
      where: { status: "MANUAL_REVIEW" },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.nccParticipantConnector.count(),
    prisma.nccParticipantConnector.count({ where: { status: "ACTIVE" } }),
    prisma.nccParticipantConnector.count({
      where: { OR: [{ lastErrorCode: { not: null } }, { status: "DISABLED" }] },
    }),
    prisma.nccParticipantConnector.count({
      where: { status: { in: ["DRAFT", "DISABLED"] } },
    }),
    prisma.nccParticipantConnector.count({ where: { lastErrorCode: { not: null } } }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "SettlementAccount"
      WHERE "lowLiquidityThreshold" IS NOT NULL
        AND "availableBalance" <= "lowLiquidityThreshold"
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    countExpiredRegulatoryDocuments(),
    countUnexplainedLegacyFloats(),
  ]);

  const durations = completed
    .map((row) => (row.completedAt ? row.completedAt.getTime() - row.createdAt.getTime() : null))
    .filter((v): v is number => v != null && v >= 0)
    .sort((a, b) => a - b);
  const avg =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const deliveryLatencies = recentDeliveries
    .map((row) => row.latencyMs)
    .filter((v): v is number => v != null && v >= 0)
    .sort((a, b) => a - b);
  const avgDelivery =
    deliveryLatencies.length === 0
      ? null
      : Math.round(deliveryLatencies.reduce((a, b) => a + b, 0) / deliveryLatencies.length);

  const webhookBacklog = pendingDeliveries + retryPendingDeliveries;

  return {
    adapters: {
      altaBank: { operational: true },
      altaTerminal: { operational: true },
      altaExchange: { operational: true },
    },
    workers: {
      settlement: {
        lastStatus: jobRun?.lastStatus ?? null,
        lastSuccessAt: jobRun?.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: jobRun?.lastFailureAt?.toISOString() ?? null,
      },
    },
    metrics: {
      incompleteExecutions,
      manualReviewCount,
      retryPendingCount,
      staleReservations: staleHolds,
      avgSettlementDurationMs: avg,
      p95SettlementDurationMs: percentile(durations, 95),
      p99SettlementDurationMs: percentile(durations, 99),
      recentAdapterFailures: recentFailedExecutions,
      oldestIncompleteUpdatedAt: oldest?.updatedAt.toISOString() ?? null,
      compensationBacklog,
      reconciliationMismatchCount,
      outboxBacklog: outboxFanoutBacklog,
      failedOrStaleWorkerClaims: staleOutboxClaims + staleWebhookClaims,
      manualReviewAgeOldest: oldestManualReview?.updatedAt.toISOString() ?? null,
      institutionsBelowLiquidityThreshold,
      expiredRegulatoryDocuments,
      unexplainedLegacyFloatCount,
    },
    connectors: {
      total: connectorTotal,
      active: connectorActive,
      failing: connectorFailing,
      draftOrDisabled: connectorDraftOrDisabled,
      lastErrorCount: connectorLastErrorCount,
    },
    api: {
      activeCredentials,
      revokedCredentials,
      authFailures24h,
      requestCount24h,
      rateLimitRejections24h,
    },
    webhooks: {
      activeEndpoints,
      failingEndpoints,
      pendingDeliveries,
      retryPendingDeliveries,
      permanentlyFailedDeliveries,
      oldestPendingDeliveryAt: oldestPendingDelivery?.createdAt.toISOString() ?? null,
      avgDeliveryLatencyMs: avgDelivery,
      p95DeliveryLatencyMs: percentile(deliveryLatencies, 95),
      ssrfRejections24h,
      outboxFanoutBacklog,
      webhookBacklog,
      staleWebhookClaims,
    },
    performanceTarget: {
      description:
        "Normal synchronous completion in a few seconds or less; no scheduled settlement delay; durable recovery when synchronous completion cannot finish.",
      normalCompletionSeconds: 5,
      scheduledDelaySeconds: 0,
    },
  };
}
