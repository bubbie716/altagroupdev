import type { NccApiEnvironment, NccWebhookEndpoint } from "@prisma/client";
import { prisma } from "@/server/db";
import { decryptSecret, encryptSecret, randomToken } from "@/server/crypto";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import { NCC_WEBHOOK_EVENT_TYPES } from "@/lib/ncc/ncc-webhook-events";
import { assertWebhookUrlSafeForDelivery, validateWebhookUrlShape } from "@/server/ncc/ncc-webhook-ssrf";

export { NCC_WEBHOOK_EVENT_TYPES };

export type WebhookEndpointView = {
  id: string;
  name: string;
  url: string;
  environment: NccApiEnvironment;
  status: NccWebhookEndpoint["status"];
  subscribedEvents: string[];
  secretPrefix: string;
  createdAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  disabledAt: string | null;
};

export type WebhookEndpointCreateResult = WebhookEndpointView & {
  signingSecret: string;
};

function mapEndpoint(row: NccWebhookEndpoint): WebhookEndpointView {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    environment: row.environment,
    status: row.status,
    subscribedEvents: row.subscribedEvents,
    secretPrefix: row.secretPrefix,
    createdAt: row.createdAt.toISOString(),
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null,
  };
}

function assertSubscribedEvents(events: string[]): string[] {
  const allowed = new Set<string>(NCC_WEBHOOK_EVENT_TYPES);
  const out: string[] = [];
  for (const event of events) {
    if (!allowed.has(event)) {
      throw new NccApiError("VALIDATION_ERROR", `Unsupported webhook event: ${event}`, 400);
    }
    if (!out.includes(event)) out.push(event);
  }
  if (out.length === 0) {
    throw new NccApiError("VALIDATION_ERROR", "At least one subscribed event is required.", 400);
  }
  return out;
}

export async function createWebhookEndpoint(input: {
  institutionId: string;
  name: string;
  url: string;
  environment: NccApiEnvironment;
  subscribedEvents: string[];
  createdByUserId: string;
}): Promise<WebhookEndpointCreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) throw new NccApiError("VALIDATION_ERROR", "Endpoint name is required.", 400);

  const requireHttps = input.environment === "LIVE";
  const shape = validateWebhookUrlShape(input.url, { requireHttps });
  if (!shape.ok) throw new NccApiError(shape.code, shape.reason, 400);
  await assertWebhookUrlSafeForDelivery(input.url, { requireHttps });

  const subscribedEvents = assertSubscribedEvents(input.subscribedEvents);
  const signingSecret = `whsec_${randomToken(24)}`;
  const encrypted = await encryptSecret(signingSecret);

  const row = await prisma.nccWebhookEndpoint.create({
    data: {
      institutionId: input.institutionId,
      name,
      url: shape.url.toString(),
      environment: input.environment,
      subscribedEvents,
      signingSecretEncrypted: encrypted,
      secretPrefix: signingSecret.slice(0, 12),
      createdByUserId: input.createdByUserId,
      status: "ACTIVE",
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.createdByUserId,
    action: NCC_AUDIT.WEBHOOK_ENDPOINT_CREATED,
    entityType: "NCC_WEBHOOK_ENDPOINT",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `Webhook endpoint ${row.name} created`,
    metadata: { environment: row.environment, subscribedEvents: row.subscribedEvents },
  });

  return { ...mapEndpoint(row), signingSecret };
}

export async function listWebhookEndpoints(institutionId: string): Promise<WebhookEndpointView[]> {
  const rows = await prisma.nccWebhookEndpoint.findMany({
    where: { institutionId, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapEndpoint);
}

export async function getWebhookEndpoint(
  institutionId: string,
  endpointId: string,
): Promise<WebhookEndpointView> {
  const row = await prisma.nccWebhookEndpoint.findFirst({
    where: { id: endpointId, institutionId },
  });
  if (!row) throw new NccApiError("NOT_FOUND", "Webhook endpoint not found.", 404);
  return mapEndpoint(row);
}

export async function setWebhookEndpointStatus(input: {
  institutionId: string;
  endpointId: string;
  status: "ACTIVE" | "DISABLED" | "REVOKED";
  actorUserId: string;
}): Promise<WebhookEndpointView> {
  const existing = await prisma.nccWebhookEndpoint.findFirst({
    where: { id: input.endpointId, institutionId: input.institutionId },
  });
  if (!existing) throw new NccApiError("NOT_FOUND", "Webhook endpoint not found.", 404);

  const row = await prisma.nccWebhookEndpoint.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      disabledAt: input.status === "ACTIVE" ? null : new Date(),
    },
  });

  const action =
    input.status === "ACTIVE"
      ? NCC_AUDIT.WEBHOOK_ENDPOINT_REENABLED
      : input.status === "DISABLED"
        ? NCC_AUDIT.WEBHOOK_ENDPOINT_DISABLED
        : NCC_AUDIT.WEBHOOK_ENDPOINT_DELETED;

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action,
    entityType: "NCC_WEBHOOK_ENDPOINT",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `Webhook endpoint ${row.name} set to ${input.status}`,
  });

  return mapEndpoint(row);
}

export async function rotateWebhookEndpointSecret(input: {
  institutionId: string;
  endpointId: string;
  actorUserId: string;
}): Promise<WebhookEndpointCreateResult> {
  const existing = await prisma.nccWebhookEndpoint.findFirst({
    where: { id: input.endpointId, institutionId: input.institutionId },
  });
  if (!existing) throw new NccApiError("NOT_FOUND", "Webhook endpoint not found.", 404);

  const signingSecret = `whsec_${randomToken(24)}`;
  const encrypted = await encryptSecret(signingSecret);

  const row = await prisma.nccWebhookEndpoint.update({
    where: { id: existing.id },
    data: {
      signingSecretEncrypted: encrypted,
      secretPrefix: signingSecret.slice(0, 12),
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.WEBHOOK_SECRET_ROTATED,
    entityType: "NCC_WEBHOOK_ENDPOINT",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `Webhook signing secret rotated for ${row.name}`,
  });

  return { ...mapEndpoint(row), signingSecret };
}

export async function loadWebhookSigningSecret(endpoint: NccWebhookEndpoint): Promise<string> {
  const secret = await decryptSecret(endpoint.signingSecretEncrypted);
  if (!secret) throw new Error("WEBHOOK_SECRET_DECRYPT_FAILED");
  return secret;
}
