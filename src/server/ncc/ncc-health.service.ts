import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

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

/** Internal NCC integration health for ops dashboards. */
export async function getNccIntegrationHealth(): Promise<NccIntegrationHealth> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
  ] = await Promise.all([
    prisma.settlementExecution.count({ where: { status: { notIn: ["COMPLETED", "FAILED", "COMPENSATED"] } } }),
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
    },
    performanceTarget: {
      description:
        "Normal synchronous completion in a few seconds or less; no scheduled settlement delay; durable recovery when synchronous completion cannot finish.",
      normalCompletionSeconds: 5,
      scheduledDelaySeconds: 0,
    },
  };
}

void Prisma;
