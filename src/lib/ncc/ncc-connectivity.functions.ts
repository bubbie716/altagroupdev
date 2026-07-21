import { createServerFn } from "@tanstack/react-start";
import type { NccConnectorMode } from "@prisma/client";

async function resolveInstitutionId(preferred?: string) {
  const { resolvePortalInstitutionId } = await import("@/server/ncc/ncc-portal.service");
  return resolvePortalInstitutionId(preferred);
}

export const fetchInstitutionConnector = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { getInstitutionConnector } = await import("@/server/ncc/ncc-connector.service");
    return { institutionId, connector: await getInstitutionConnector(institutionId) };
  });

export const saveInstitutionConnector = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId?: string;
      mode: NccConnectorMode;
      baseUrl?: string | null;
      authSecret?: string | null;
      timeoutMs?: number;
      supportedCurrency?: string;
      certSourceAccountIdentifier?: string | null;
      certDestinationAccountIdentifier?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { upsertInstitutionConnector } = await import("@/server/ncc/ncc-connector.service");
    return upsertInstitutionConnector({
      institutionId,
      mode: data.mode,
      baseUrl: data.baseUrl,
      authSecret: data.authSecret,
      timeoutMs: data.timeoutMs,
      supportedCurrency: data.supportedCurrency,
      certSourceAccountIdentifier: data.certSourceAccountIdentifier,
      certDestinationAccountIdentifier: data.certDestinationAccountIdentifier,
    });
  });

export const fetchDirectoryVersions = createServerFn({ method: "GET" })
  .inputValidator((input?: { institutionId?: string; currency?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { listDirectoryVersions } = await import("@/server/ncc/ncc-directory.service");
    return {
      institutionId,
      versions: await listDirectoryVersions(institutionId, data.currency),
    };
  });

export const uploadDirectoryFile = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId?: string;
      csvText: string;
      fileName?: string;
      currency?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { uploadDirectoryCsv } = await import("@/server/ncc/ncc-directory.service");
    return uploadDirectoryCsv({
      institutionId,
      csvText: data.csvText,
      fileName: data.fileName,
      currency: data.currency,
    });
  });

export const activateDirectory = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId?: string; versionId: string }) => input)
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { activateDirectoryVersion } = await import("@/server/ncc/ncc-directory.service");
    return activateDirectoryVersion({ institutionId, versionId: data.versionId });
  });

export const rollbackDirectory = createServerFn({ method: "POST" })
  .inputValidator((input?: { institutionId?: string; currency?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const institutionId = await resolveInstitutionId(data.institutionId);
    const { rollbackDirectoryVersion } = await import("@/server/ncc/ncc-directory.service");
    return rollbackDirectoryVersion({ institutionId, currency: data.currency });
  });

export const fetchCertificationRun = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { getLatestCertificationRun } = await import("@/server/ncc/ncc-certification.service");
    return getLatestCertificationRun(data.institutionId);
  });

export const startInstitutionCertification = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { startCertificationRun } = await import("@/server/ncc/ncc-certification.service");
    return startCertificationRun(data.institutionId);
  });

export const executeInstitutionCertification = createServerFn({ method: "POST" })
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { executeCertificationRun } = await import("@/server/ncc/ncc-certification.service");
    return executeCertificationRun(data.runId);
  });

export const fetchLivePromotionGates = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { getLivePromotionGateView } = await import("@/server/ncc/ncc-live-promotion.service");
    return getLivePromotionGateView(data.institutionId);
  });

export const promoteInstitutionLive = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { promoteInstitutionToLive } = await import("@/server/ncc/ncc-live-promotion.service");
    return promoteInstitutionToLive(data.institutionId);
  });
