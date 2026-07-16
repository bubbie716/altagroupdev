import { createServerFn } from "@tanstack/react-start";

async function resolveInstitutionId(preferred?: string) {
  const { resolvePortalInstitutionId } = await import("@/server/ncc/ncc-portal.service");
  return resolvePortalInstitutionId(preferred);
}

export const fetchDeveloperCredentials = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalListApiCredentials } = await import("@/server/ncc/ncc-developer-portal.service");
    return { institutionId, credentials: await portalListApiCredentials(institutionId) };
  });

export const createDeveloperCredential = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId?: string;
      name: string;
      environment: "TEST" | "LIVE";
      scopes: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalCreateApiCredential } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalCreateApiCredential({
      institutionId,
      name: data.name,
      environment: data.environment,
      scopes: data.scopes,
    });
  });

export const revokeDeveloperCredential = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; credentialId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalRevokeApiCredential } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalRevokeApiCredential(institutionId, data.credentialId);
  });

export const rotateDeveloperCredential = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; credentialId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalRotateApiCredential } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalRotateApiCredential(institutionId, data.credentialId);
  });

export const fetchDeveloperWebhooks = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalListWebhookEndpoints } = await import("@/server/ncc/ncc-developer-portal.service");
    return { institutionId, endpoints: await portalListWebhookEndpoints(institutionId) };
  });

export const createDeveloperWebhook = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId?: string;
      name: string;
      url: string;
      environment: "TEST" | "LIVE";
      subscribedEvents: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalCreateWebhookEndpoint } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalCreateWebhookEndpoint({
      institutionId,
      name: data.name,
      url: data.url,
      environment: data.environment,
      subscribedEvents: data.subscribedEvents,
    });
  });

export const fetchDeveloperWebhookDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId?: string; endpointId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalGetWebhookEndpoint } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalGetWebhookEndpoint(institutionId, data.endpointId);
  });

export const setDeveloperWebhookStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId?: string;
      endpointId: string;
      status: "ACTIVE" | "DISABLED" | "REVOKED";
    }) => input,
  )
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalSetWebhookStatus } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalSetWebhookStatus(institutionId, data.endpointId, data.status);
  });

export const rotateDeveloperWebhookSecret = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; endpointId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalRotateWebhookSecret } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalRotateWebhookSecret(institutionId, data.endpointId);
  });

export const sendDeveloperWebhookTest = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; endpointId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalSendWebhookTest } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalSendWebhookTest(institutionId, data.endpointId);
  });

export const redeliverDeveloperWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; deliveryId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalRedeliverWebhook } = await import("@/server/ncc/ncc-developer-portal.service");
    return portalRedeliverWebhook(institutionId, data.deliveryId);
  });

export const fetchDeveloperApiLogs = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string; limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { portalListApiLogs } = await import("@/server/ncc/ncc-developer-portal.service");
    return { institutionId, logs: await portalListApiLogs(institutionId, data.limit) };
  });
