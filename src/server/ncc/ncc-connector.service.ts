import type { NccConnectorMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { encryptSecret } from "@/server/crypto";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { requireInstitutionPermission } from "@/server/ncc/ncc-permissions.service";
import { validateWebhookUrlShape } from "@/server/ncc/ncc-webhook-ssrf";

export class NccConnectorError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccConnectorError";
  }
}

export type ConnectorPublicView = {
  id: string;
  institutionId: string;
  mode: NccConnectorMode;
  baseUrl: string | null;
  authType: string;
  hasAuthSecret: boolean;
  timeoutMs: number;
  supportedCurrency: string;
  status: string;
  certificationStatus: string;
  lastSuccessfulCheckAt: string | null;
  lastErrorCode: string | null;
  certSourceAccountIdentifier: string | null;
  certDestinationAccountIdentifier: string | null;
};

function mapConnector(row: {
  id: string;
  institutionId: string;
  mode: NccConnectorMode;
  baseUrl: string | null;
  authType: string;
  authSecretEncrypted: string | null;
  timeoutMs: number;
  supportedCurrency: string;
  status: string;
  certificationStatus: string;
  lastSuccessfulCheckAt: Date | null;
  lastErrorCode: string | null;
  certSourceAccountIdentifier: string | null;
  certDestinationAccountIdentifier: string | null;
}): ConnectorPublicView {
  return {
    id: row.id,
    institutionId: row.institutionId,
    mode: row.mode,
    baseUrl: row.baseUrl,
    authType: row.authType,
    hasAuthSecret: !!row.authSecretEncrypted,
    timeoutMs: row.timeoutMs,
    supportedCurrency: row.supportedCurrency,
    status: row.status,
    certificationStatus: row.certificationStatus,
    lastSuccessfulCheckAt: row.lastSuccessfulCheckAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    certSourceAccountIdentifier: row.certSourceAccountIdentifier,
    certDestinationAccountIdentifier: row.certDestinationAccountIdentifier,
  };
}

export async function getInstitutionConnector(institutionId: string): Promise<ConnectorPublicView | null> {
  await requireInstitutionPermission(institutionId, "view_api_credentials");
  const row = await prisma.nccParticipantConnector.findUnique({ where: { institutionId } });
  return row ? mapConnector(row) : null;
}

export async function upsertInstitutionConnectorAsActor(
  actorUserId: string,
  input: {
    institutionId: string;
    mode: NccConnectorMode;
    baseUrl?: string | null;
    authSecret?: string | null;
    timeoutMs?: number;
    supportedCurrency?: string;
    certSourceAccountIdentifier?: string | null;
    certDestinationAccountIdentifier?: string | null;
  },
): Promise<ConnectorPublicView> {
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 5000, 1000), 15_000);
  const supportedCurrency = (input.supportedCurrency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  if (supportedCurrency !== NCC_DEFAULT_CURRENCY) {
    throw new NccConnectorError("UNSUPPORTED_CURRENCY", "Only FLR is supported in v1.");
  }

  let baseUrl: string | null = input.baseUrl?.trim() || null;
  if (input.mode === "API") {
    if (!baseUrl) throw new NccConnectorError("BASE_URL_REQUIRED", "API mode requires a base URL.");
    const shape = validateWebhookUrlShape(baseUrl, { requireHttps: true });
    if (!shape.ok) throw new NccConnectorError(shape.code, shape.reason);
    baseUrl = shape.url.toString().replace(/\/$/, "");
  } else {
    baseUrl = null;
  }

  let authSecretEncrypted: string | undefined;
  if (input.authSecret?.trim()) {
    authSecretEncrypted = await encryptSecret(input.authSecret.trim());
  }

  const existing = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: input.institutionId },
  });

  const certSource =
    input.certSourceAccountIdentifier !== undefined
      ? input.certSourceAccountIdentifier?.trim() || null
      : undefined;
  const certDest =
    input.certDestinationAccountIdentifier !== undefined
      ? input.certDestinationAccountIdentifier?.trim() || null
      : undefined;

  const row = existing
    ? await prisma.nccParticipantConnector.update({
        where: { id: existing.id },
        data: {
          mode: input.mode,
          baseUrl,
          timeoutMs,
          supportedCurrency,
          configuredByUserId: actorUserId,
          status: "CONFIGURED",
          ...(authSecretEncrypted ? { authSecretEncrypted } : {}),
          ...(certSource !== undefined ? { certSourceAccountIdentifier: certSource } : {}),
          ...(certDest !== undefined ? { certDestinationAccountIdentifier: certDest } : {}),
          certificationStatus:
            existing.mode !== input.mode || existing.baseUrl !== baseUrl
              ? "NOT_STARTED"
              : existing.certificationStatus,
        },
      })
    : await prisma.nccParticipantConnector.create({
        data: {
          institutionId: input.institutionId,
          mode: input.mode,
          baseUrl,
          timeoutMs,
          supportedCurrency,
          authSecretEncrypted: authSecretEncrypted ?? null,
          certSourceAccountIdentifier: certSource ?? null,
          certDestinationAccountIdentifier: certDest ?? null,
          configuredByUserId: actorUserId,
          status: "CONFIGURED",
          certificationStatus: "NOT_STARTED",
        },
      });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: NCC_AUDIT.CONNECTOR_CONFIGURED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Participant connector configured (${row.mode})`,
    metadata: { mode: row.mode, hasSecret: !!row.authSecretEncrypted },
  });

  return mapConnector(row);
}

export async function upsertInstitutionConnector(input: {
  institutionId: string;
  mode: NccConnectorMode;
  baseUrl?: string | null;
  authSecret?: string | null;
  timeoutMs?: number;
  supportedCurrency?: string;
  certSourceAccountIdentifier?: string | null;
  certDestinationAccountIdentifier?: string | null;
}): Promise<ConnectorPublicView> {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_api_credentials");
  return upsertInstitutionConnectorAsActor(user.id, input);
}

/** Internal loader — includes encrypted secret for outbound calls only. */
export async function loadConnectorForOutbound(institutionId: string) {
  return prisma.nccParticipantConnector.findUnique({ where: { institutionId } });
}
