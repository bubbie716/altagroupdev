import { prisma } from "@/server/db";
import { randomHexToken } from "@/server/crypto";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { loadWebhookSigningSecret } from "@/server/ncc/ncc-webhook-endpoint.service";
import { buildWebhookHeaders, signWebhookPayload } from "@/server/ncc/ncc-webhook-signing";
import { resolvePinnedWebhookDestination } from "@/server/ncc/ncc-webhook-ssrf";
import { pinnedWebhookPost } from "@/server/ncc/ncc-webhook-pinned-http";

const MAX_RESPONSE_BYTES = 8_192;
const CONNECT_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 10_000;
/** Stale DELIVERING claims older than this are reclaimable. */
export const WEBHOOK_DELIVERY_LEASE_MS = 90_000;

function backoffMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 30_000, 60 * 60_000);
  const jitter = Math.floor(Math.random() * 5_000);
  return base + jitter;
}

function sanitizeSnippet(text: string): string {
  return text.replace(/authorization/gi, "[redacted]").slice(0, 500);
}

async function safeAudit(input: {
  actorUserId?: string | null;
  institutionId: string;
  action: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    const actor =
      input.actorUserId ??
      (
        await prisma.user.findFirst({
          where: { tags: { some: { tag: "CORPORATE_ADMIN" } } },
          select: { id: true },
        })
      )?.id;
    if (!actor) return;
    await writeAuditLog({
      actorUserId: actor,
      action: input.action,
      entityType: "NCC_WEBHOOK_DELIVERY",
      entityId: input.entityId,
      institutionId: input.institutionId,
      description: input.description,
      metadata: input.metadata,
    });
  } catch {
    // Audit failure must not corrupt delivery state.
  }
}

/**
 * Atomically claim a delivery for this worker (or reclaim a stale DELIVERING lease).
 * Returns the claim token on success, or null if another worker holds a fresh claim.
 */
export async function claimWebhookDelivery(
  deliveryId: string,
  leaseMs = WEBHOOK_DELIVERY_LEASE_MS,
): Promise<string | null> {
  const claimToken = randomHexToken(16);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - leaseMs);

  const claimed = await prisma.nccWebhookDelivery.updateMany({
    where: {
      id: deliveryId,
      OR: [
        { status: { in: ["PENDING", "RETRY_PENDING", "FAILED"] } },
        { status: "DELIVERING", claimedAt: { lt: staleBefore } },
        { status: "DELIVERING", claimedAt: null },
      ],
    },
    data: {
      status: "DELIVERING",
      lastAttemptAt: now,
      claimedAt: now,
      claimToken,
    },
  });
  return claimed.count === 1 ? claimToken : null;
}

async function finalizeWithClaim(
  deliveryId: string,
  claimToken: string,
  data: Parameters<typeof prisma.nccWebhookDelivery.update>[0]["data"],
): Promise<boolean> {
  const updated = await prisma.nccWebhookDelivery.updateMany({
    where: { id: deliveryId, claimToken, status: "DELIVERING" },
    data,
  });
  return updated.count === 1;
}

/**
 * Deliver a single webhook attempt. Never mutates settlement financial state.
 * Connections are pinned to a validated public IP (no DNS rebinding TOCTOU).
 */
export async function attemptWebhookDelivery(
  deliveryId: string,
): Promise<"delivered" | "retry" | "failed" | "skipped"> {
  const delivery = await prisma.nccWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { event: true, endpoint: true },
  });
  if (!delivery) return "skipped";
  if (delivery.status === "DELIVERED" || delivery.status === "CANCELLED") return "skipped";
  if (delivery.endpoint.status !== "ACTIVE") {
    await prisma.nccWebhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "CANCELLED", lastErrorCode: "ENDPOINT_DISABLED", claimToken: null, claimedAt: null },
    });
    return "skipped";
  }

  const claimToken = await claimWebhookDelivery(delivery.id);
  if (!claimToken) return "skipped";

  const rawBody = JSON.stringify({
    id: delivery.event.id,
    type: delivery.event.eventType,
    created: delivery.event.occurredAt.toISOString(),
    data: delivery.event.payload,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nextAttemptCount = delivery.attemptCount + 1;

  try {
    const destination = await resolvePinnedWebhookDestination(delivery.endpoint.url, {
      requireHttps: delivery.endpoint.environment === "LIVE",
    });
    const secret = await loadWebhookSigningSecret(delivery.endpoint);
    const signature = await signWebhookPayload(secret, timestamp, rawBody);
    const headers = buildWebhookHeaders({
      eventId: delivery.event.id,
      eventType: delivery.event.eventType,
      deliveryId: delivery.id,
      timestamp,
      signature,
    });

    const started = Date.now();
    const response = await pinnedWebhookPost({
      destination,
      headers,
      body: rawBody,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      totalTimeoutMs: TOTAL_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
    });
    const latencyMs = Date.now() - started;
    const snippet = sanitizeSnippet(new TextDecoder().decode(response.body));

    if (response.status >= 200 && response.status < 300) {
      const won = await finalizeWithClaim(delivery.id, claimToken, {
        status: "DELIVERED",
        attemptCount: nextAttemptCount,
        responseStatus: response.status,
        responseSnippet: snippet,
        latencyMs,
        deliveredAt: new Date(),
        lastErrorCode: null,
        nextAttemptAt: null,
        claimToken: null,
        claimedAt: null,
      });
      if (!won) return "skipped";
      await prisma.nccWebhookEndpoint.update({
        where: { id: delivery.endpoint.id },
        data: { lastSuccessAt: new Date(), status: "ACTIVE" },
      });
      await safeAudit({
        actorUserId: delivery.endpoint.createdByUserId,
        institutionId: delivery.event.institutionId,
        action: NCC_AUDIT.WEBHOOK_DELIVERY_SUCCEEDED,
        entityId: delivery.id,
        description: `Webhook delivery succeeded for ${delivery.event.eventType}`,
        metadata: {
          eventType: delivery.event.eventType,
          responseStatus: response.status,
          latencyMs,
          endpointId: delivery.endpoint.id,
        },
      });
      return "delivered";
    }

    return scheduleRetry(delivery.id, claimToken, nextAttemptCount, delivery.maxAttempts, {
      responseStatus: response.status,
      responseSnippet: snippet,
      latencyMs,
      lastErrorCode: `HTTP_${response.status}`,
      endpointId: delivery.endpoint.id,
      institutionId: delivery.event.institutionId,
      actorUserId: delivery.endpoint.createdByUserId,
      eventType: delivery.event.eventType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("WEBHOOK_URL_REJECTED") ? "SSRF_REJECTED" : "DELIVERY_ERROR";
    return scheduleRetry(delivery.id, claimToken, nextAttemptCount, delivery.maxAttempts, {
      responseStatus: null,
      responseSnippet: sanitizeSnippet(message),
      latencyMs: null,
      lastErrorCode: code,
      endpointId: delivery.endpoint.id,
      institutionId: delivery.event.institutionId,
      actorUserId: delivery.endpoint.createdByUserId,
      eventType: delivery.event.eventType,
    });
  }
}

async function scheduleRetry(
  deliveryId: string,
  claimToken: string,
  attemptCount: number,
  maxAttempts: number,
  details: {
    responseStatus: number | null;
    responseSnippet: string | null;
    latencyMs: number | null;
    lastErrorCode: string;
    endpointId: string;
    institutionId: string;
    actorUserId?: string | null;
    eventType: string;
  },
): Promise<"retry" | "failed" | "skipped"> {
  const exhausted = attemptCount >= maxAttempts;
  const won = await finalizeWithClaim(deliveryId, claimToken, {
    status: exhausted ? "FAILED" : "RETRY_PENDING",
    attemptCount,
    responseStatus: details.responseStatus,
    responseSnippet: details.responseSnippet,
    latencyMs: details.latencyMs,
    lastErrorCode: details.lastErrorCode,
    nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs(attemptCount)),
    claimToken: null,
    claimedAt: null,
  });
  if (!won) return "skipped";

  await prisma.nccWebhookEndpoint.update({
    where: { id: details.endpointId },
    data: {
      lastFailureAt: new Date(),
      status: exhausted ? "FAILING" : undefined,
    },
  });

  if (exhausted) {
    await safeAudit({
      actorUserId: details.actorUserId,
      institutionId: details.institutionId,
      action: NCC_AUDIT.WEBHOOK_DELIVERY_FAILED,
      entityId: deliveryId,
      description: `Webhook delivery permanently failed for ${details.eventType}`,
      metadata: {
        eventType: details.eventType,
        lastErrorCode: details.lastErrorCode,
        responseStatus: details.responseStatus,
        endpointId: details.endpointId,
        attemptCount,
      },
    });
  }

  return exhausted ? "failed" : "retry";
}

export async function processDueWebhookDeliveries(limit = 25): Promise<{
  delivered: number;
  retry: number;
  failed: number;
  reclaimedStale: number;
}> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - WEBHOOK_DELIVERY_LEASE_MS);

  const due = await prisma.nccWebhookDelivery.findMany({
    where: {
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "PENDING", nextAttemptAt: null },
        { status: "RETRY_PENDING", nextAttemptAt: { lte: now } },
        { status: "DELIVERING", claimedAt: { lt: staleBefore } },
        { status: "DELIVERING", claimedAt: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(limit, 100),
  });

  let delivered = 0;
  let retry = 0;
  let failed = 0;
  let reclaimedStale = 0;
  for (const row of due) {
    if (row.status === "DELIVERING") reclaimedStale += 1;
    const result = await attemptWebhookDelivery(row.id);
    if (result === "delivered") delivered += 1;
    else if (result === "retry") retry += 1;
    else if (result === "failed") failed += 1;
  }
  return { delivered, retry, failed, reclaimedStale };
}

export async function requestWebhookRedelivery(input: {
  institutionId: string;
  deliveryId: string;
  actorUserId: string;
}): Promise<void> {
  const delivery = await prisma.nccWebhookDelivery.findFirst({
    where: {
      id: input.deliveryId,
      endpoint: { institutionId: input.institutionId },
    },
  });
  if (!delivery) throw new Error("NOT_FOUND");

  await prisma.nccWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
      lastErrorCode: null,
      claimToken: null,
      claimedAt: null,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.WEBHOOK_REDELIVERY_REQUESTED,
    entityType: "NCC_WEBHOOK_DELIVERY",
    entityId: delivery.id,
    institutionId: input.institutionId,
    description: `Webhook redelivery requested for ${delivery.id}`,
  });
}

/** Controlled test delivery — still subject to SSRF + pinned transport. */
export async function sendWebhookTestEvent(input: {
  institutionId: string;
  endpointId: string;
  actorUserId: string;
}): Promise<{ deliveryId: string }> {
  const endpoint = await prisma.nccWebhookEndpoint.findFirst({
    where: { id: input.endpointId, institutionId: input.institutionId },
  });
  if (!endpoint) throw new Error("NOT_FOUND");

  await resolvePinnedWebhookDestination(endpoint.url, {
    requireHttps: endpoint.environment === "LIVE",
  });

  const event = await prisma.nccWebhookEvent.create({
    data: {
      institutionId: input.institutionId,
      eventType: "settlement.completed",
      environment: endpoint.environment,
      subjectType: "TEST",
      subjectReference: `test-${Date.now()}`,
      payload: { test: true, message: "NCC webhook test event" },
      occurredAt: new Date(),
      dedupeKey: `wh-test:${endpoint.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    },
  });

  const delivery = await prisma.nccWebhookDelivery.create({
    data: {
      webhookEventId: event.id,
      webhookEndpointId: endpoint.id,
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.WEBHOOK_TEST_SENT,
    entityType: "NCC_WEBHOOK_ENDPOINT",
    entityId: endpoint.id,
    institutionId: input.institutionId,
    description: `Webhook test event queued for ${endpoint.name}`,
  });

  await attemptWebhookDelivery(delivery.id);
  return { deliveryId: delivery.id };
}
