import type {
  FinancialInstitutionStatus,
  NccEmergencySuspension,
  Prisma,
} from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { assertTypedConfirmation } from "@/lib/ncc/ncc-staff-permissions";
import { prisma } from "@/server/db";
import {
  freezeSettlementAccount,
  unfreezeSettlementAccount,
} from "@/server/ncc/ncc-liquidity.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccControlPlaneError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccControlPlaneError";
  }
}

const IN_FLIGHT_STATUSES = ["CREATED", "SUBMITTED", "VALIDATING", "QUEUED", "SETTLING"] as const;

const CONTROL_SUSPEND_META_KEY = "nccControlSuspended";

type EmergencyAffectedSnapshot = {
  priorInstitutionStatus: FinancialInstitutionStatus;
  routingNumberIds: string[];
  settlementAccountIds: string[];
  credentialIds: string[];
  connectorIds: string[];
  pendingResume?: {
    requestedByUserId: string;
    reason: string;
    requestedAt: string;
  };
};

function requireReason(reason: string | undefined | null): string {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) throw new NccControlPlaneError("REASON_REQUIRED");
  return trimmed;
}

function parseSnapshot(raw: unknown): EmergencyAffectedSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new NccControlPlaneError("INVALID_SNAPSHOT");
  }
  const obj = raw as Record<string, unknown>;
  return {
    priorInstitutionStatus: obj.priorInstitutionStatus as FinancialInstitutionStatus,
    routingNumberIds: Array.isArray(obj.routingNumberIds)
      ? obj.routingNumberIds.filter((x): x is string => typeof x === "string")
      : [],
    settlementAccountIds: Array.isArray(obj.settlementAccountIds)
      ? obj.settlementAccountIds.filter((x): x is string => typeof x === "string")
      : [],
    credentialIds: Array.isArray(obj.credentialIds)
      ? obj.credentialIds.filter((x): x is string => typeof x === "string")
      : [],
    connectorIds: Array.isArray(obj.connectorIds)
      ? obj.connectorIds.filter((x): x is string => typeof x === "string")
      : [],
    pendingResume:
      obj.pendingResume && typeof obj.pendingResume === "object" && !Array.isArray(obj.pendingResume)
        ? (obj.pendingResume as EmergencyAffectedSnapshot["pendingResume"])
        : undefined,
  };
}

async function writeControlAudit(input: {
  actorUserId: string;
  action: string;
  entityType:
    | "FINANCIAL_INSTITUTION"
    | "ROUTING_NUMBER"
    | "SETTLEMENT_ACCOUNT"
    | "NCC_API_CREDENTIAL"
    | "NCC_WEBHOOK_ENDPOINT"
    | "NCC_EMERGENCY_SUSPENSION";
  entityId: string;
  institutionId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    institutionId: input.institutionId,
    description: input.description,
    metadata: input.metadata,
  });
}

export async function getInstitutionControlImpact(institutionId: string) {
  await requireNccStaff("view_control_plane");

  const institution = await prisma.financialInstitution.findUnique({
    where: { id: institutionId },
  });
  if (!institution) throw new NccControlPlaneError("INSTITUTION_NOT_FOUND");

  const [inFlight, routing, accounts, credentials, connector, webhooks, activeEmergency] =
    await Promise.all([
      prisma.settlementInstruction.findMany({
        where: {
          OR: [
            { sendingInstitutionId: institutionId },
            { receivingInstitutionId: institutionId },
          ],
          status: { in: [...IN_FLIGHT_STATUSES] },
        },
        select: {
          id: true,
          publicReference: true,
          status: true,
          amount: true,
          currency: true,
          sendingInstitutionId: true,
          receivingInstitutionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.routingNumber.findMany({
        where: { institutionId },
        select: {
          id: true,
          routingNumber: true,
          status: true,
          isPrimary: true,
          label: true,
        },
      }),
      prisma.settlementAccount.findMany({
        where: { institutionId },
        select: {
          id: true,
          currency: true,
          status: true,
          ledgerBalance: true,
          availableBalance: true,
          frozenAt: true,
          frozenReason: true,
        },
      }),
      prisma.nccApiCredential.findMany({
        where: { institutionId },
        select: {
          id: true,
          name: true,
          environment: true,
          status: true,
          keyPrefix: true,
        },
      }),
      prisma.nccParticipantConnector.findUnique({
        where: { institutionId },
        select: {
          id: true,
          mode: true,
          status: true,
          certificationStatus: true,
          baseUrl: true,
        },
      }),
      prisma.nccWebhookEndpoint.findMany({
        where: { institutionId, status: { not: "REVOKED" } },
        select: {
          id: true,
          name: true,
          environment: true,
          status: true,
          url: true,
        },
      }),
      prisma.nccEmergencySuspension.findFirst({
        where: { institutionId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    institution: {
      id: institution.id,
      displayName: institution.displayName,
      status: institution.status,
      isNCCParticipant: institution.isNCCParticipant,
    },
    inFlightSettlements: {
      count: inFlight.length,
      items: inFlight.map((row) => ({
        id: row.id,
        publicReference: row.publicReference,
        status: row.status,
        amount: row.amount.toString(),
        currency: row.currency,
        sendingInstitutionId: row.sendingInstitutionId,
        receivingInstitutionId: row.receivingInstitutionId,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    routingNumbers: routing,
    settlementAccounts: accounts.map((a) => ({
      ...a,
      ledgerBalance: a.ledgerBalance.toString(),
      availableBalance: a.availableBalance.toString(),
      frozenAt: a.frozenAt?.toISOString() ?? null,
    })),
    credentials,
    connector,
    webhooks,
    activeEmergencySuspension: activeEmergency
      ? {
          id: activeEmergency.id,
          reason: activeEmergency.reason,
          createdAt: activeEmergency.createdAt.toISOString(),
          suspendedByUserId: activeEmergency.suspendedByUserId,
        }
      : null,
  };
}

async function setInstitutionControlStatus(input: {
  institutionId: string;
  status: Extract<FinancialInstitutionStatus, "RESTRICTED" | "SUSPENDED" | "TERMINATED" | "ACTIVE">;
  reason: string;
  confirmation: string;
  action: string;
  permission: "manage_institutions" | "emergency_suspend";
}) {
  const actor = await requireNccStaff(input.permission);
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const current = await prisma.financialInstitution.findUnique({
    where: { id: input.institutionId },
  });
  if (!current) throw new NccControlPlaneError("INSTITUTION_NOT_FOUND");

  if (input.status === "ACTIVE") {
    if (current.status === "TERMINATED") {
      throw new NccControlPlaneError(
        "TERMINATED_NOT_RESUMABLE",
        "Terminated institutions cannot be resumed via control plane.",
      );
    }
    if (current.status !== "RESTRICTED" && current.status !== "SUSPENDED") {
      throw new NccControlPlaneError(
        "INVALID_STATUS_TRANSITION",
        `Cannot resume institution from status ${current.status}.`,
      );
    }
  }

  const data: {
    status: FinancialInstitutionStatus;
    suspendedAt?: Date | null;
    terminatedAt?: Date | null;
  } = { status: input.status };

  if (input.status === "SUSPENDED") {
    data.suspendedAt = new Date();
  } else if (input.status === "TERMINATED") {
    data.terminatedAt = new Date();
    data.suspendedAt = new Date();
  } else if (input.status === "ACTIVE") {
    data.suspendedAt = null;
    data.terminatedAt = null;
  }

  const institution = await prisma.financialInstitution.update({
    where: { id: input.institutionId },
    data,
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: input.action,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: institution.id,
    institutionId: institution.id,
    description: `Institution ${institution.displayName} set to ${input.status}: ${reason}`,
    metadata: { fromStatus: current.status, toStatus: input.status, reason },
  });

  return institution;
}

export function restrictInstitutionOutgoing(
  institutionId: string,
  reason: string,
  confirmation: string,
) {
  return setInstitutionControlStatus({
    institutionId,
    status: "RESTRICTED",
    reason,
    confirmation,
    action: NCC_AUDIT.INSTITUTION_RESTRICTED,
    permission: "manage_institutions",
  });
}

export function suspendInstitutionSettlement(
  institutionId: string,
  reason: string,
  confirmation: string,
) {
  return setInstitutionControlStatus({
    institutionId,
    status: "SUSPENDED",
    reason,
    confirmation,
    action: NCC_AUDIT.INSTITUTION_SUSPENDED,
    permission: "manage_institutions",
  });
}

export function resumeInstitution(
  institutionId: string,
  reason: string,
  confirmation: string,
) {
  return setInstitutionControlStatus({
    institutionId,
    status: "ACTIVE",
    reason,
    confirmation,
    action: NCC_AUDIT.INSTITUTION_RESUMED,
    permission: "manage_institutions",
  });
}

export function terminateInstitutionControl(
  institutionId: string,
  reason: string,
  confirmation: string,
) {
  return setInstitutionControlStatus({
    institutionId,
    status: "TERMINATED",
    reason,
    confirmation,
    action: NCC_AUDIT.INSTITUTION_TERMINATED,
    permission: "manage_institutions",
  });
}

export async function suspendRoutingNumberControl(input: {
  routingNumberId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const row = await prisma.routingNumber.update({
    where: { id: input.routingNumberId },
    data: {
      status: "SUSPENDED",
      deactivatedAt: new Date(),
    },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ROUTING_NUMBER_SUSPENDED,
    entityType: "ROUTING_NUMBER",
    entityId: row.id,
    institutionId: row.institutionId,
    description: `Routing number ${row.routingNumber} suspended: ${reason}`,
    metadata: { reason },
  });

  return row;
}

export async function reactivateRoutingNumber(input: {
  routingNumberId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const existing = await prisma.routingNumber.findUnique({
    where: { id: input.routingNumberId },
  });
  if (!existing) throw new NccControlPlaneError("ROUTING_NUMBER_NOT_FOUND");
  if (existing.status !== "SUSPENDED") {
    throw new NccControlPlaneError(
      "INVALID_STATUS",
      "Only SUSPENDED routing numbers can be reactivated.",
    );
  }

  const row = await prisma.routingNumber.update({
    where: { id: input.routingNumberId },
    data: {
      status: "ACTIVE",
      deactivatedAt: null,
      activatedAt: new Date(),
    },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ROUTING_NUMBER_REACTIVATED,
    entityType: "ROUTING_NUMBER",
    entityId: row.id,
    institutionId: row.institutionId,
    description: `Routing number ${row.routingNumber} reactivated: ${reason}`,
    metadata: { reason },
  });

  return row;
}

export async function freezeSettlementAccountControl(input: {
  settlementAccountId: string;
  reason: string;
  confirmation: string;
}) {
  await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  requireReason(input.reason);
  return freezeSettlementAccount({
    settlementAccountId: input.settlementAccountId,
    reason: input.reason,
  });
}

export async function unfreezeSettlementAccountControl(input: {
  settlementAccountId: string;
  reason: string;
  confirmation: string;
}) {
  await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  requireReason(input.reason);
  return unfreezeSettlementAccount({
    settlementAccountId: input.settlementAccountId,
    reason: input.reason,
  });
}

export async function disableParticipantConnector(input: {
  institutionId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: input.institutionId },
  });
  if (!connector) throw new NccControlPlaneError("CONNECTOR_NOT_FOUND");

  const updated = await prisma.nccParticipantConnector.update({
    where: { id: connector.id },
    data: { status: "DISABLED" },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.CONNECTOR_DISABLED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Participant connector disabled: ${reason}`,
    metadata: { connectorId: updated.id, reason },
  });

  return updated;
}

export async function enableParticipantConnector(input: {
  institutionId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: input.institutionId },
  });
  if (!connector) throw new NccControlPlaneError("CONNECTOR_NOT_FOUND");

  const nextStatus = connector.certificationStatus === "PASSED" ? "ACTIVE" : "CONFIGURED";
  const updated = await prisma.nccParticipantConnector.update({
    where: { id: connector.id },
    data: { status: nextStatus },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.CONNECTOR_ENABLED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Participant connector enabled: ${reason}`,
    metadata: { connectorId: updated.id, status: updated.status, reason },
  });

  return updated;
}

export async function suspendLiveCredentials(input: {
  institutionId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const active = await prisma.nccApiCredential.findMany({
    where: {
      institutionId: input.institutionId,
      environment: "LIVE",
      status: "ACTIVE",
    },
  });

  const ids: string[] = [];
  for (const cred of active) {
    const priorMeta =
      cred.metadata && typeof cred.metadata === "object" && !Array.isArray(cred.metadata)
        ? (cred.metadata as Record<string, unknown>)
        : {};
    await prisma.nccApiCredential.update({
      where: { id: cred.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        metadata: {
          ...priorMeta,
          [CONTROL_SUSPEND_META_KEY]: true,
          controlSuspendReason: reason,
        } as Prisma.InputJsonValue,
      },
    });
    ids.push(cred.id);
  }

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.CREDENTIAL_SUSPENDED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Suspended ${ids.length} LIVE API credential(s): ${reason}`,
    metadata: { credentialIds: ids, reason },
  });

  return { suspendedCredentialIds: ids };
}

export async function reenableLiveCredentials(input: {
  institutionId: string;
  credentialIds?: string[];
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const candidates = await prisma.nccApiCredential.findMany({
    where: {
      institutionId: input.institutionId,
      environment: "LIVE",
      status: "REVOKED",
      ...(input.credentialIds?.length ? { id: { in: input.credentialIds } } : {}),
    },
  });

  const reenabled: string[] = [];
  for (const cred of candidates) {
    const meta =
      cred.metadata && typeof cred.metadata === "object" && !Array.isArray(cred.metadata)
        ? (cred.metadata as Record<string, unknown>)
        : {};
    if (!meta[CONTROL_SUSPEND_META_KEY] && !input.credentialIds?.includes(cred.id)) {
      continue;
    }
    const nextMeta = { ...meta };
    delete nextMeta[CONTROL_SUSPEND_META_KEY];
    delete nextMeta.controlSuspendReason;

    await prisma.nccApiCredential.update({
      where: { id: cred.id },
      data: {
        status: "ACTIVE",
        revokedAt: null,
        metadata: nextMeta as Prisma.InputJsonValue,
      },
    });
    reenabled.push(cred.id);
  }

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.CREDENTIAL_REENABLED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Re-enabled ${reenabled.length} LIVE API credential(s): ${reason}`,
    metadata: { credentialIds: reenabled, reason },
  });

  return { reenabledCredentialIds: reenabled };
}

export async function disableWebhookEndpointControl(input: {
  institutionId: string;
  endpointId: string;
  reason: string;
  confirmation: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const existing = await prisma.nccWebhookEndpoint.findFirst({
    where: { id: input.endpointId, institutionId: input.institutionId },
  });
  if (!existing) throw new NccControlPlaneError("WEBHOOK_NOT_FOUND");

  const row = await prisma.nccWebhookEndpoint.update({
    where: { id: existing.id },
    data: {
      status: "DISABLED",
      disabledAt: new Date(),
    },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.WEBHOOK_ENDPOINT_DISABLED,
    entityType: "NCC_WEBHOOK_ENDPOINT",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `Webhook endpoint ${row.name} disabled: ${reason}`,
    metadata: { reason },
  });

  return row;
}

/**
 * Atomic emergency suspension: institution SUSPENDED, ACTIVE routing suspended,
 * settlement accounts frozen, LIVE credentials suspended, connector initiation disabled.
 * Investigation/read access is preserved (no membership or audit wipe).
 */
export async function emergencySuspendInstitution(input: {
  institutionId: string;
  reason: string;
  confirmation: string;
}): Promise<NccEmergencySuspension> {
  const actor = await requireNccStaff("emergency_suspend");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const existingActive = await prisma.nccEmergencySuspension.findFirst({
    where: { institutionId: input.institutionId, status: "ACTIVE" },
  });
  if (existingActive) {
    throw new NccControlPlaneError(
      "EMERGENCY_ALREADY_ACTIVE",
      "An active emergency suspension already exists for this institution.",
    );
  }

  const suspension = await prisma.$transaction(async (tx) => {
    const institution = await tx.financialInstitution.findUnique({
      where: { id: input.institutionId },
    });
    if (!institution) throw new NccControlPlaneError("INSTITUTION_NOT_FOUND");
    if (institution.status === "TERMINATED") {
      throw new NccControlPlaneError("TERMINATED_NOT_SUSPENDABLE");
    }

    const activeRouting = await tx.routingNumber.findMany({
      where: { institutionId: input.institutionId, status: "ACTIVE" },
      select: { id: true },
    });
    const activeAccounts = await tx.settlementAccount.findMany({
      where: { institutionId: input.institutionId, status: "ACTIVE" },
      select: { id: true },
    });
    const liveCredentials = await tx.nccApiCredential.findMany({
      where: {
        institutionId: input.institutionId,
        environment: "LIVE",
        status: "ACTIVE",
      },
    });
    const connector = await tx.nccParticipantConnector.findUnique({
      where: { institutionId: input.institutionId },
      select: { id: true, status: true },
    });

    await tx.financialInstitution.update({
      where: { id: input.institutionId },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
      },
    });

    if (activeRouting.length) {
      await tx.routingNumber.updateMany({
        where: { id: { in: activeRouting.map((r) => r.id) } },
        data: { status: "SUSPENDED", deactivatedAt: new Date() },
      });
    }

    if (activeAccounts.length) {
      await tx.settlementAccount.updateMany({
        where: { id: { in: activeAccounts.map((a) => a.id) } },
        data: {
          status: "FROZEN",
          frozenAt: new Date(),
          frozenReason: `Emergency suspension: ${reason}`,
        },
      });
    }

    for (const cred of liveCredentials) {
      const priorMeta =
        cred.metadata && typeof cred.metadata === "object" && !Array.isArray(cred.metadata)
          ? (cred.metadata as Record<string, unknown>)
          : {};
      await tx.nccApiCredential.update({
        where: { id: cred.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          metadata: {
            ...priorMeta,
            [CONTROL_SUSPEND_META_KEY]: true,
            controlSuspendReason: reason,
            emergencySuspension: true,
          } as Prisma.InputJsonValue,
        },
      });
    }

    const connectorIds: string[] = [];
    if (connector && connector.status !== "DISABLED") {
      await tx.nccParticipantConnector.update({
        where: { id: connector.id },
        data: { status: "DISABLED" },
      });
      connectorIds.push(connector.id);
    }

    const snapshot: EmergencyAffectedSnapshot = {
      priorInstitutionStatus: institution.status,
      routingNumberIds: activeRouting.map((r) => r.id),
      settlementAccountIds: activeAccounts.map((a) => a.id),
      credentialIds: liveCredentials.map((c) => c.id),
      connectorIds,
    };

    return tx.nccEmergencySuspension.create({
      data: {
        institutionId: input.institutionId,
        reason,
        status: "ACTIVE",
        suspendedByUserId: actor.id,
        affectedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.EMERGENCY_SUSPENSION,
    entityType: "NCC_EMERGENCY_SUSPENSION",
    entityId: suspension.id,
    institutionId: input.institutionId,
    description: `Emergency suspension applied: ${reason}`,
    metadata: { affectedSnapshot: suspension.affectedSnapshot, reason },
  });

  return suspension;
}

export async function requestEmergencyResume(input: {
  suspensionId: string;
  reason: string;
  confirmation: string;
}): Promise<NccEmergencySuspension> {
  const actor = await requireNccStaff("emergency_resume");
  assertTypedConfirmation(input.confirmation);
  const reason = requireReason(input.reason);

  const suspension = await prisma.nccEmergencySuspension.findUnique({
    where: { id: input.suspensionId },
  });
  if (!suspension || suspension.status !== "ACTIVE") {
    throw new NccControlPlaneError("SUSPENSION_NOT_ACTIVE");
  }

  const snapshot = parseSnapshot(suspension.affectedSnapshot);
  snapshot.pendingResume = {
    requestedByUserId: actor.id,
    reason,
    requestedAt: new Date().toISOString(),
  };

  const updated = await prisma.nccEmergencySuspension.update({
    where: { id: suspension.id },
    data: {
      resumeReason: reason,
      affectedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.EMERGENCY_RESUME_REQUESTED,
    entityType: "NCC_EMERGENCY_SUSPENSION",
    entityId: updated.id,
    institutionId: updated.institutionId,
    description: `Emergency resume requested: ${reason}`,
    metadata: { reason },
  });

  return updated;
}

export async function approveEmergencyResume(input: {
  suspensionId: string;
  confirmation: string;
}): Promise<NccEmergencySuspension> {
  const actor = await requireNccStaff("emergency_resume");
  assertTypedConfirmation(input.confirmation);

  const suspension = await prisma.nccEmergencySuspension.findUnique({
    where: { id: input.suspensionId },
  });
  if (!suspension || suspension.status !== "ACTIVE") {
    throw new NccControlPlaneError("SUSPENSION_NOT_ACTIVE");
  }

  const snapshot = parseSnapshot(suspension.affectedSnapshot);
  const pending = snapshot.pendingResume;
  if (!pending?.requestedByUserId || !pending.reason) {
    throw new NccControlPlaneError(
      "RESUME_NOT_REQUESTED",
      "No pending emergency resume request.",
    );
  }
  if (pending.requestedByUserId === actor.id) {
    throw new NccControlPlaneError(
      "SELF_APPROVAL_DENIED",
      "A different authorized staff member must approve emergency resume.",
    );
  }

  const resumed = await prisma.$transaction(async (tx) => {
    if (snapshot.routingNumberIds.length) {
      await tx.routingNumber.updateMany({
        where: { id: { in: snapshot.routingNumberIds }, status: "SUSPENDED" },
        data: {
          status: "ACTIVE",
          deactivatedAt: null,
          activatedAt: new Date(),
        },
      });
    }

    if (snapshot.settlementAccountIds.length) {
      await tx.settlementAccount.updateMany({
        where: { id: { in: snapshot.settlementAccountIds }, status: "FROZEN" },
        data: {
          status: "ACTIVE",
          frozenAt: null,
          frozenReason: null,
        },
      });
    }

    for (const credentialId of snapshot.credentialIds) {
      const cred = await tx.nccApiCredential.findUnique({ where: { id: credentialId } });
      if (!cred || cred.status !== "REVOKED") continue;
      const meta =
        cred.metadata && typeof cred.metadata === "object" && !Array.isArray(cred.metadata)
          ? (cred.metadata as Record<string, unknown>)
          : {};
      const nextMeta = { ...meta };
      delete nextMeta[CONTROL_SUSPEND_META_KEY];
      delete nextMeta.controlSuspendReason;
      delete nextMeta.emergencySuspension;
      await tx.nccApiCredential.update({
        where: { id: credentialId },
        data: {
          status: "ACTIVE",
          revokedAt: null,
          metadata: nextMeta as Prisma.InputJsonValue,
        },
      });
    }

    if (snapshot.connectorIds.length) {
      await tx.nccParticipantConnector.updateMany({
        where: { id: { in: snapshot.connectorIds }, status: "DISABLED" },
        data: { status: "ACTIVE" },
      });
    }

    const restoreStatus =
      snapshot.priorInstitutionStatus === "RESTRICTED" ||
      snapshot.priorInstitutionStatus === "ACTIVE" ||
      snapshot.priorInstitutionStatus === "CERTIFICATION"
        ? snapshot.priorInstitutionStatus
        : "ACTIVE";

    await tx.financialInstitution.update({
      where: { id: suspension.institutionId },
      data: {
        status: restoreStatus,
        suspendedAt: null,
      },
    });

    const cleaned: EmergencyAffectedSnapshot = {
      ...snapshot,
      pendingResume: undefined,
    };

    return tx.nccEmergencySuspension.update({
      where: { id: suspension.id },
      data: {
        status: "RESUMED",
        resumedByUserId: actor.id,
        resumedAt: new Date(),
        resumeReason: pending.reason,
        affectedSnapshot: cleaned as unknown as Prisma.InputJsonValue,
      },
    });
  });

  await writeControlAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.EMERGENCY_RESUME_APPROVED,
    entityType: "NCC_EMERGENCY_SUSPENSION",
    entityId: resumed.id,
    institutionId: resumed.institutionId,
    description: `Emergency resume approved; snapshot resources restored`,
    metadata: {
      requestedByUserId: pending.requestedByUserId,
      reason: pending.reason,
      restored: {
        routingNumberIds: snapshot.routingNumberIds,
        settlementAccountIds: snapshot.settlementAccountIds,
        credentialIds: snapshot.credentialIds,
        connectorIds: snapshot.connectorIds,
      },
    },
  });

  return resumed;
}
