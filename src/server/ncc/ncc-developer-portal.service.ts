import {
  createApiCredential,
  listApiCredentials,
  revokeApiCredential,
  rotateApiCredential,
} from "@/server/ncc/ncc-api-credential.service";
import {
  createWebhookEndpoint,
  getWebhookEndpoint,
  listWebhookEndpoints,
  rotateWebhookEndpointSecret,
  setWebhookEndpointStatus,
} from "@/server/ncc/ncc-webhook-endpoint.service";
import {
  requestWebhookRedelivery,
  sendWebhookTestEvent,
} from "@/server/ncc/ncc-webhook-delivery.service";
import { listInstitutionApiLogs } from "@/server/ncc/ncc-api-request-log.service";
import { requireInstitutionPermission } from "@/server/ncc/ncc-permissions.service";
import { prisma } from "@/server/db";
import type { NccApiEnvironment } from "@prisma/client";

export async function portalCreateApiCredential(input: {
  institutionId: string;
  name: string;
  environment: NccApiEnvironment;
  scopes: string[];
  expiresAt?: string | null;
}) {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_api_credentials");
  const { assertCredentialEnvironmentAllowed } = await import(
    "@/server/ncc/ncc-participant-application.service"
  );
  await assertCredentialEnvironmentAllowed(input.institutionId, input.environment);
  return createApiCredential({
    institutionId: input.institutionId,
    name: input.name,
    environment: input.environment,
    scopes: input.scopes,
    createdByUserId: user.id,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
}

export async function portalListApiCredentials(institutionId: string) {
  await requireInstitutionPermission(institutionId, "view_api_credentials");
  return listApiCredentials(institutionId);
}

export async function portalRevokeApiCredential(institutionId: string, credentialId: string) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_api_credentials");
  return revokeApiCredential({ institutionId, credentialId, actorUserId: user.id });
}

export async function portalRotateApiCredential(institutionId: string, credentialId: string) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_api_credentials");
  return rotateApiCredential({ institutionId, credentialId, actorUserId: user.id });
}

export async function portalCreateWebhookEndpoint(input: {
  institutionId: string;
  name: string;
  url: string;
  environment: NccApiEnvironment;
  subscribedEvents: string[];
}) {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_webhooks");
  return createWebhookEndpoint({ ...input, createdByUserId: user.id });
}

export async function portalListWebhookEndpoints(institutionId: string) {
  await requireInstitutionPermission(institutionId, "view_webhooks");
  return listWebhookEndpoints(institutionId);
}

export async function portalGetWebhookEndpoint(institutionId: string, endpointId: string) {
  await requireInstitutionPermission(institutionId, "view_webhooks");
  const endpoint = await getWebhookEndpoint(institutionId, endpointId);
  const deliveries = await prisma.nccWebhookDelivery.findMany({
    where: { webhookEndpointId: endpointId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { event: { select: { eventType: true, subjectReference: true } } },
  });
  return {
    endpoint,
    deliveries: deliveries.map((d) => ({
      id: d.id,
      status: d.status,
      eventType: d.event.eventType,
      subjectReference: d.event.subjectReference,
      attemptCount: d.attemptCount,
      responseStatus: d.responseStatus,
      lastErrorCode: d.lastErrorCode,
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function portalSetWebhookStatus(
  institutionId: string,
  endpointId: string,
  status: "ACTIVE" | "DISABLED" | "REVOKED",
) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_webhooks");
  return setWebhookEndpointStatus({ institutionId, endpointId, status, actorUserId: user.id });
}

export async function portalRotateWebhookSecret(institutionId: string, endpointId: string) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_webhooks");
  return rotateWebhookEndpointSecret({ institutionId, endpointId, actorUserId: user.id });
}

export async function portalSendWebhookTest(institutionId: string, endpointId: string) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_webhooks");
  return sendWebhookTestEvent({ institutionId, endpointId, actorUserId: user.id });
}

export async function portalRedeliverWebhook(institutionId: string, deliveryId: string) {
  const { user } = await requireInstitutionPermission(institutionId, "manage_webhooks");
  await requestWebhookRedelivery({ institutionId, deliveryId, actorUserId: user.id });
  return { ok: true };
}

export async function portalListApiLogs(institutionId: string, limit?: number) {
  await requireInstitutionPermission(institutionId, "view_api_logs");
  const rows = await listInstitutionApiLogs(institutionId, { limit });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
