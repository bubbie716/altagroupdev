import { createServerFn } from "@tanstack/react-start";
import type {
  NccLiquidityOperationType,
  NccNetworkSettlementMode,
  NccStaffRole,
} from "@prisma/client";
import { NCC_SENSITIVE_CONFIRMATION } from "@/lib/ncc/ncc-staff-permissions";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function serializeNetwork(row: {
  id: string;
  mode: string;
  reason: string | null;
  updatedByUserId: string | null;
  pendingResumeRequestedByUserId: string | null;
  pendingResumeReason: string | null;
  pendingResumeApprovedByUserId: string | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    mode: row.mode,
    reason: row.reason,
    updatedByUserId: row.updatedByUserId,
    pendingResumeRequestedByUserId: row.pendingResumeRequestedByUserId,
    pendingResumeReason: row.pendingResumeReason,
    pendingResumeApprovedByUserId: row.pendingResumeApprovedByUserId,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeStaffMembership(row: {
  id: string;
  userId: string;
  role: NccStaffRole;
  status: string;
  invitedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    discordUsername: string | null;
    discordId: string | null;
    email: string | null;
  };
}) {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invitedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: row.user
      ? {
          id: row.user.id,
          discordUsername: row.user.discordUsername,
          discordId: row.user.discordId,
          email: row.user.email,
        }
      : undefined,
  };
}

function serializeAlert(row: {
  id: string;
  alertKey: string;
  title: string;
  detail: string | null;
  severity: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  assignedToUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}) {
  return {
    id: row.id,
    alertKey: row.alertKey,
    title: row.title,
    detail: row.detail,
    severity: row.severity,
    status: row.status,
    entityType: row.entityType,
    entityId: row.entityId,
    assignedToUserId: row.assignedToUserId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acknowledgedAt: iso(row.acknowledgedAt),
    resolvedAt: iso(row.resolvedAt),
  };
}

// ─── Overview / gate ─────────────────────────────────────────────────────────

export const fetchNccControlPlaneAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
  try {
    const staff = await requireNccStaff("view_control_plane");
    return {
      allowed: true as const,
      userId: staff.id,
      role: staff.nccStaffRole,
      confirmationPhrase: NCC_SENSITIVE_CONFIRMATION,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { allowed: false as const, userId: null, role: null, confirmationPhrase: NCC_SENSITIVE_CONFIRMATION };
    }
    throw error;
  }
});

export const fetchNccControlPlaneOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
  const staff = await requireNccStaff("view_control_plane");
  const { getNetworkSettlementMode } = await import("@/server/ncc/ncc-network-control.service");
  const { getNccIntegrationHealth } = await import("@/server/ncc/ncc-health.service");
  const { getNccProductionReadiness } = await import("@/server/ncc/ncc-readiness.service");
  const [network, health, readiness] = await Promise.all([
    getNetworkSettlementMode(),
    getNccIntegrationHealth(),
    getNccProductionReadiness(),
  ]);
  return {
    actor: { userId: staff.id, role: staff.nccStaffRole },
    network: serializeNetwork(network),
    health,
    readiness,
    confirmationPhrase: NCC_SENSITIVE_CONFIRMATION,
  };
});

export const fetchNccNetworkMode = createServerFn({ method: "GET" }).handler(async () => {
  const { getNetworkSettlementMode } = await import("@/server/ncc/ncc-network-control.service");
  return serializeNetwork(await getNetworkSettlementMode());
});

export const fetchNccIntegrationHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
  await requireNccStaff("view_health");
  const { getNccIntegrationHealth } = await import("@/server/ncc/ncc-health.service");
  return getNccIntegrationHealth();
});

export const fetchNccProductionReadiness = createServerFn({ method: "GET" }).handler(async () => {
  const { getNccProductionReadiness } = await import("@/server/ncc/ncc-readiness.service");
  return getNccProductionReadiness();
});

// ─── Institutions ────────────────────────────────────────────────────────────

export const listNccControlInstitutions = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("view_control_plane");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.financialInstitution.findMany({
      where: { isNCCParticipant: true },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        status: true,
        isAlta: true,
        slug: true,
        updatedAt: true,
      },
      orderBy: { displayName: "asc" },
      take: Math.min(data.limit ?? 200, 500),
    });
    return rows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

export const fetchNccInstitutionImpact = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { getInstitutionControlImpact } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    return getInstitutionControlImpact(data.institutionId);
  });

export const nccRestrictInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { restrictInstitutionOutgoing } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    const row = await restrictInstitutionOutgoing(
      data.institutionId,
      data.reason,
      data.confirmation,
    );
    return {
      id: row.id,
      displayName: row.displayName,
      status: row.status,
    };
  });

export const nccSuspendInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { suspendInstitutionSettlement } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    const row = await suspendInstitutionSettlement(
      data.institutionId,
      data.reason,
      data.confirmation,
    );
    return { id: row.id, displayName: row.displayName, status: row.status };
  });

export const nccResumeInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { resumeInstitution } = await import("@/server/ncc/ncc-control-plane.service");
    const row = await resumeInstitution(data.institutionId, data.reason, data.confirmation);
    return { id: row.id, displayName: row.displayName, status: row.status };
  });

export const nccTerminateInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { terminateInstitutionControl } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    const row = await terminateInstitutionControl(
      data.institutionId,
      data.reason,
      data.confirmation,
    );
    return { id: row.id, displayName: row.displayName, status: row.status };
  });

export const nccEmergencySuspendInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { emergencySuspendInstitution } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    const row = await emergencySuspendInstitution(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      status: row.status,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    };
  });

export const nccRequestEmergencyResume = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { suspensionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { requestEmergencyResume } = await import("@/server/ncc/ncc-control-plane.service");
    const row = await requestEmergencyResume(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      status: row.status,
      resumeReason: row.resumeReason,
    };
  });

export const nccApproveEmergencyResume = createServerFn({ method: "POST" })
  .inputValidator((input: { suspensionId: string; confirmation: string }) => input)
  .handler(async ({ data }) => {
    const { approveEmergencyResume } = await import("@/server/ncc/ncc-control-plane.service");
    const row = await approveEmergencyResume(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      status: row.status,
    };
  });

// ─── Network controls ────────────────────────────────────────────────────────

export const nccSetNetworkMode = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      mode: Exclude<NccNetworkSettlementMode, "ACTIVE">;
      reason: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { setNetworkSettlementMode } = await import(
      "@/server/ncc/ncc-network-control.service"
    );
    return serializeNetwork(await setNetworkSettlementMode(data));
  });

export const nccRequestNetworkResume = createServerFn({ method: "POST" })
  .inputValidator((input: { reason: string; confirmation: string }) => input)
  .handler(async ({ data }) => {
    const { requestNetworkResume } = await import("@/server/ncc/ncc-network-control.service");
    return serializeNetwork(await requestNetworkResume(data));
  });

export const nccApproveNetworkResume = createServerFn({ method: "POST" })
  .inputValidator((input: { confirmation: string }) => input)
  .handler(async ({ data }) => {
    const { approveNetworkResume } = await import("@/server/ncc/ncc-network-control.service");
    return serializeNetwork(await approveNetworkResume(data));
  });

// ─── Exceptions / compensation ───────────────────────────────────────────────

export const listNccExceptionQueue = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { listExceptionQueue } = await import("@/server/ncc/ncc-exceptions.service");
    const rows = await listExceptionQueue(data.limit ?? 50);
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      settlementInstructionId: row.settlementInstructionId,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      nextRetryAt: iso(row.nextRetryAt),
      instruction: row.instruction
        ? {
            publicReference: row.instruction.publicReference,
            amount: row.instruction.amount.toString(),
            currency: row.instruction.currency,
            sendingInstitutionId: row.instruction.sendingInstitutionId,
            receivingInstitutionId: row.instruction.receivingInstitutionId,
            status: row.instruction.status,
          }
        : null,
      hasCompensation: Boolean(row.compensation),
    }));
  });

export const nccRetryException = createServerFn({ method: "POST" })
  .inputValidator((input: { executionId: string }) => input)
  .handler(async ({ data }) => {
    const { retryExecutionNow } = await import("@/server/ncc/ncc-exceptions.service");
    const row = await retryExecutionNow(data.executionId);
    return { id: row.id, status: row.status };
  });

export const nccStopExceptionRetry = createServerFn({ method: "POST" })
  .inputValidator((input: { executionId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { stopAutomaticRetry } = await import("@/server/ncc/ncc-exceptions.service");
    const row = await stopAutomaticRetry(data.executionId, data.reason);
    return { id: row.id, status: row.status };
  });

export const nccEscalateException = createServerFn({ method: "POST" })
  .inputValidator((input: { executionId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { escalateToManualReview } = await import("@/server/ncc/ncc-exceptions.service");
    const row = await escalateToManualReview(data.executionId, data.reason);
    return { id: row.id, status: row.status };
  });

export const nccInitiateCompensation = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { instructionId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { initiateEligibleCompensation } = await import(
      "@/server/ncc/ncc-exceptions.service"
    );
    const result = await initiateEligibleCompensation(data);
    if ("alreadyCompensated" in result) {
      return {
        alreadyCompensated: Boolean(result.alreadyCompensated),
        instructionId: data.instructionId,
      };
    }
    return {
      alreadyCompensated: false,
      instructionId: data.instructionId,
      outcome: "outcome" in result ? String((result as { outcome?: unknown }).outcome ?? "") : "",
    };
  });

export const nccAddExceptionNote = createServerFn({ method: "POST" })
  .inputValidator((input: { executionId: string; note: string }) => input)
  .handler(async ({ data }) => {
    const { addExceptionNote } = await import("@/server/ncc/ncc-exceptions.service");
    const meta = await addExceptionNote(data);
    return {
      exceptionOwnerUserId: meta.exceptionOwnerUserId ?? null,
      automaticRetryStopped: Boolean(meta.automaticRetryStopped),
      noteCount: meta.exceptionNotes?.length ?? 0,
    };
  });

export const nccAssignExceptionOwner = createServerFn({ method: "POST" })
  .inputValidator((input: { executionId: string; ownerUserId: string | null }) => input)
  .handler(async ({ data }) => {
    const { assignExceptionOwner } = await import("@/server/ncc/ncc-exceptions.service");
    const meta = await assignExceptionOwner(data);
    return {
      exceptionOwnerUserId: meta.exceptionOwnerUserId ?? null,
      automaticRetryStopped: Boolean(meta.automaticRetryStopped),
    };
  });

// ─── Returns ─────────────────────────────────────────────────────────────────

export const listNccReturnsQueue = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_returns");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.nccTransferReturn.findMany({
      where: {
        status: {
          in: [
            "REQUESTED",
            "PENDING_RECEIVING_INSTITUTION",
            "APPROVED",
            "MANUAL_REVIEW",
            "PROCESSING",
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(data.limit ?? 50, 200),
    });
    return rows.map((row) => ({
      id: row.id,
      publicReference: row.publicReference,
      originalInstructionId: row.originalInstructionId,
      institutionId: row.institutionId,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      reviewedByUserId: row.reviewedByUserId,
      executionApprovedByUserId: row.executionApprovedByUserId,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });

export const nccReviewReturn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      returnId: string;
      decision: "approve" | "reject" | "need_receiving_approval";
      note?: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { staffReviewReturn } = await import("@/server/ncc/ncc-transfer-return.service");
    return staffReviewReturn(data);
  });

export const nccApproveReturnExecution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { returnId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { staffApproveReturnExecution } = await import(
      "@/server/ncc/ncc-transfer-return.service"
    );
    return staffApproveReturnExecution(data);
  });

// ─── Liquidity ───────────────────────────────────────────────────────────────

export const listNccLiquidityPending = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_liquidity");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.nccLiquidityOperation.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "asc" },
      take: Math.min(data.limit ?? 50, 200),
      include: {
        institution: { select: { id: true, displayName: true } },
      },
    });
    return rows.map((op) => ({
      id: op.id,
      institutionId: op.institutionId,
      institutionName: op.institution.displayName,
      settlementAccountId: op.settlementAccountId,
      currency: op.currency,
      amount: op.amount.toString(),
      operationType: op.operationType,
      reason: op.reason,
      status: op.status,
      requestedByUserId: op.requestedByUserId,
      createdAt: op.createdAt.toISOString(),
    }));
  });

export const nccRequestLiquidity = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      settlementAccountId: string;
      amount: string | number;
      operationType: NccLiquidityOperationType;
      reason: string;
      idempotencyKey: string;
      externalReference?: string | null;
      correctionDirection?: "CREDIT" | "DEBIT";
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requestLiquidityOperation } = await import("@/server/ncc/ncc-liquidity.service");
    return requestLiquidityOperation(data);
  });

export const nccApproveLiquidity = createServerFn({ method: "POST" })
  .inputValidator((input: { operationId: string }) => input)
  .handler(async ({ data }) => {
    const { approveLiquidityOperation } = await import("@/server/ncc/ncc-liquidity.service");
    return approveLiquidityOperation(data);
  });

export const nccRejectLiquidity = createServerFn({ method: "POST" })
  .inputValidator((input: { operationId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { rejectLiquidityOperation } = await import("@/server/ncc/ncc-liquidity.service");
    return rejectLiquidityOperation(data);
  });

export const nccSetLiquidityThreshold = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { settlementAccountId: string; threshold: string | number | null }) => input,
  )
  .handler(async ({ data }) => {
    const { setSettlementAccountThreshold } = await import(
      "@/server/ncc/ncc-liquidity.service"
    );
    const row = await setSettlementAccountThreshold(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      lowLiquidityThreshold: row.lowLiquidityThreshold?.toString() ?? null,
      status: row.status,
    };
  });

export const nccFreezeSettlementAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { settlementAccountId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { freezeSettlementAccount } = await import("@/server/ncc/ncc-liquidity.service");
    const row = await freezeSettlementAccount(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      status: row.status,
      frozenReason: row.frozenReason,
    };
  });

export const nccUnfreezeSettlementAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { settlementAccountId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { unfreezeSettlementAccount } = await import("@/server/ncc/ncc-liquidity.service");
    const row = await unfreezeSettlementAccount(data);
    return { id: row.id, institutionId: row.institutionId, status: row.status };
  });

// ─── Documents (staff review queue) ──────────────────────────────────────────

export const listNccDocumentsPendingReview = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.nccParticipantDocument.findMany({
      where: { status: { in: ["PENDING_SCAN", "UNDER_REVIEW", "UPLOADED"] } },
      orderBy: { createdAt: "asc" },
      take: Math.min(data.limit ?? 50, 200),
      include: {
        institution: { select: { id: true, displayName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      institutionId: row.institutionId,
      institutionName: row.institution?.displayName ?? null,
      documentType: row.documentType,
      status: row.status,
      originalFileName: row.originalFileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      versionNumber: row.versionNumber,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      expiresAt: iso(row.expiresAt),
    }));
  });

export const nccMarkDocumentUnderReview = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string; note?: string | null }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { markDocumentUnderReview } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return markDocumentUnderReview(data.documentId, data.note);
  });

export const nccAcceptDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      documentId: string;
      reviewNote?: string | null;
      manualSafeReviewCompleted?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { acceptParticipantDocument } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return acceptParticipantDocument(data);
  });

export const nccRejectDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string; reviewNote: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("review_documents");
    const { rejectParticipantDocument } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    return rejectParticipantDocument(data);
  });

// ─── Reconciliation ──────────────────────────────────────────────────────────

export const listNccReconciliationMismatches = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_reconciliation");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.settlementReconciliation.findMany({
      where: {
        status: {
          in: [
            "MISMATCH",
            "MISSING_SOURCE",
            "MISSING_DESTINATION",
            "DUPLICATE",
            "STALE_RESERVATION",
            "MANUAL_REVIEW",
            "PENDING",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(data.limit ?? 50, 200),
      include: {
        instruction: {
          select: { publicReference: true, amount: true, currency: true, status: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      settlementInstructionId: row.settlementInstructionId,
      status: row.status,
      findings: row.findings,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: iso(row.resolvedAt),
      instruction: row.instruction
        ? {
            publicReference: row.instruction.publicReference,
            amount: row.instruction.amount.toString(),
            currency: row.instruction.currency,
            status: row.instruction.status,
          }
        : null,
    }));
  });

export const nccResolveReconciliation = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; note: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    const actor = await requireNccStaff("manage_reconciliation");
    const { resolveReconciliation } = await import("@/server/ncc/ncc-reconciliation.service");
    const row = await resolveReconciliation(data.id, actor.id, data.note);
    return {
      id: row.id,
      status: row.status,
      resolutionNote: row.resolutionNote,
      resolvedAt: iso(row.resolvedAt),
    };
  });

export const nccRerunReconciliation = createServerFn({ method: "POST" })
  .inputValidator((input: { instructionId: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_reconciliation");
    const { reconcileInstruction } = await import("@/server/ncc/ncc-reconciliation.service");
    const row = await reconcileInstruction(data.instructionId);
    return {
      id: row.id,
      settlementInstructionId: row.settlementInstructionId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  });

export const nccRunReconciliationSweep = createServerFn({ method: "POST" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_reconciliation");
    const { runReconciliationSweep } = await import("@/server/ncc/ncc-reconciliation.service");
    const rows = await runReconciliationSweep(data.limit ?? 50);
    return { count: rows.length };
  });

// ─── Outbox / webhooks ───────────────────────────────────────────────────────

export const listNccFailedOutboxEvents = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_outbox_webhooks");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.settlementOutboxEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: Math.min(data.limit ?? 50, 200),
    });
    return rows.map((row) => ({
      id: row.id,
      settlementInstructionId: row.settlementInstructionId,
      eventType: row.eventType,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });

export const nccRequeueOutboxEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_outbox_webhooks");
    const { requeueOutboxEvent } = await import("@/server/ncc/ncc-outbox.service");
    const row = await requeueOutboxEvent(data.id);
    return {
      id: row.id,
      status: row.status,
      eventType: row.eventType,
      updatedAt: row.updatedAt.toISOString(),
    };
  });

export const listNccFailedWebhookDeliveries = createServerFn({ method: "GET" })
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("manage_outbox_webhooks");
    const { prisma } = await import("@/server/db");
    const rows = await prisma.nccWebhookDelivery.findMany({
      where: { status: { in: ["FAILED", "RETRY_PENDING"] } },
      orderBy: { updatedAt: "desc" },
      take: Math.min(data.limit ?? 50, 200),
      include: {
        endpoint: {
          select: {
            id: true,
            name: true,
            institutionId: true,
            status: true,
            url: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      lastErrorCode: row.lastErrorCode,
      responseStatus: row.responseStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      endpoint: {
        id: row.endpoint.id,
        name: row.endpoint.name,
        institutionId: row.endpoint.institutionId,
        status: row.endpoint.status,
        url: row.endpoint.url,
      },
    }));
  });

export const nccRetryWebhookDelivery = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string; deliveryId: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    const actor = await requireNccStaff("manage_outbox_webhooks");
    const { requestWebhookRedelivery } = await import(
      "@/server/ncc/ncc-webhook-delivery.service"
    );
    await requestWebhookRedelivery({
      institutionId: data.institutionId,
      deliveryId: data.deliveryId,
      actorUserId: actor.id,
    });
    return { ok: true as const };
  });

export const nccDisableWebhookEndpoint = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId: string;
      endpointId: string;
      reason: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { disableWebhookEndpointControl } = await import(
      "@/server/ncc/ncc-control-plane.service"
    );
    const row = await disableWebhookEndpointControl(data);
    return {
      id: row.id,
      status: row.status,
      name: row.name,
      institutionId: row.institutionId,
    };
  });

// ─── Risk ────────────────────────────────────────────────────────────────────

export const fetchNccRiskPolicy = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { requireNccStaff } = await import("@/server/ncc/ncc-permissions.service");
    await requireNccStaff("view_control_plane");
    const { getEffectiveRiskPolicy } = await import("@/server/ncc/ncc-risk.service");
    const policy = await getEffectiveRiskPolicy(data.institutionId);
    if (!policy) {
      return {
        id: null,
        institutionId: data.institutionId,
        maxTransferAmount: null,
        dailyAmountLimit: null,
        dailyTransactionCountLimit: null,
        manualReviewThreshold: null,
        probationMaxTransferAmount: null,
        probationDailyAmountLimit: null,
        probationDailyTxnLimit: null,
        emergencyZeroLimit: false,
        enabled: true,
        effectiveFrom: null,
        effectiveTo: null,
        reason: null,
      };
    }
    return {
      id: policy.id,
      institutionId: policy.institutionId,
      maxTransferAmount: policy.maxTransferAmount?.toFixed(2) ?? null,
      dailyAmountLimit: policy.dailyAmountLimit?.toFixed(2) ?? null,
      dailyTransactionCountLimit: policy.dailyTransactionCountLimit,
      manualReviewThreshold: policy.manualReviewThreshold?.toFixed(2) ?? null,
      probationMaxTransferAmount: policy.probationMaxTransferAmount?.toFixed(2) ?? null,
      probationDailyAmountLimit: policy.probationDailyAmountLimit?.toFixed(2) ?? null,
      probationDailyTxnLimit: policy.probationDailyTxnLimit,
      emergencyZeroLimit: policy.emergencyZeroLimit,
      enabled: policy.enabled,
      effectiveFrom: policy.effectiveFrom.toISOString(),
      effectiveTo: iso(policy.effectiveTo),
      reason: policy.reason,
    };
  });

export const nccUpdateRiskPolicy = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId: string;
      maxTransferAmount?: number | string | null;
      dailyAmountLimit?: number | string | null;
      dailyTransactionCountLimit?: number | null;
      manualReviewThreshold?: number | string | null;
      probationMaxTransferAmount?: number | string | null;
      probationDailyAmountLimit?: number | string | null;
      probationDailyTxnLimit?: number | null;
      emergencyZeroLimit?: boolean;
      enabled?: boolean;
      reason: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { upsertRiskPolicy } = await import("@/server/ncc/ncc-risk.service");
    return upsertRiskPolicy(data);
  });

export const nccOverrideRiskDecision = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      settlementInstructionId: string;
      reason: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { overrideRiskDecision } = await import("@/server/ncc/ncc-risk.service");
    const result = await overrideRiskDecision(data);
    return {
      outcome: result.outcome,
      reasonCode: result.reasonCode,
      reason: result.reason,
      decisionId: result.decisionId,
    };
  });

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const listNccOperationalAlerts = createServerFn({ method: "GET" })
  .inputValidator(
    (input?: {
      status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | Array<"OPEN" | "ACKNOWLEDGED" | "RESOLVED">;
      limit?: number;
    }) => input ?? {},
  )
  .handler(async ({ data }) => {
    const { listAlerts } = await import("@/server/ncc/ncc-alerts.service");
    const rows = await listAlerts({
      status: data.status ?? ["OPEN", "ACKNOWLEDGED"],
      limit: data.limit,
    });
    return rows.map(serializeAlert);
  });

export const nccAcknowledgeAlert = createServerFn({ method: "POST" })
  .inputValidator((input: { alertId: string }) => input)
  .handler(async ({ data }) => {
    const { acknowledgeAlert } = await import("@/server/ncc/ncc-alerts.service");
    return serializeAlert(await acknowledgeAlert(data));
  });

export const nccResolveAlert = createServerFn({ method: "POST" })
  .inputValidator((input: { alertId: string; note?: string }) => input)
  .handler(async ({ data }) => {
    const { resolveAlert } = await import("@/server/ncc/ncc-alerts.service");
    return serializeAlert(await resolveAlert(data));
  });

export const nccAssignAlert = createServerFn({ method: "POST" })
  .inputValidator((input: { alertId: string; assignedToUserId: string | null }) => input)
  .handler(async ({ data }) => {
    const { assignAlert } = await import("@/server/ncc/ncc-alerts.service");
    return serializeAlert(await assignAlert(data));
  });

// ─── Staff access ────────────────────────────────────────────────────────────

export const listNccStaffMemberships = createServerFn({ method: "GET" }).handler(async () => {
  const { listNccStaff } = await import("@/server/ncc/ncc-staff.service");
  const rows = await listNccStaff();
  return rows.map(serializeStaffMembership);
});

export const nccAssignStaff = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      role: NccStaffRole;
      reason: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assignNccStaff } = await import("@/server/ncc/ncc-staff.service");
    return serializeStaffMembership(await assignNccStaff(data));
  });

export const nccUpdateStaffRole = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      role: NccStaffRole;
      reason: string;
      confirmation: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { updateNccStaffRole } = await import("@/server/ncc/ncc-staff.service");
    return serializeStaffMembership(await updateNccStaffRole(data));
  });

export const nccRevokeStaff = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; reason: string; confirmation: string }) => input,
  )
  .handler(async ({ data }) => {
    const { revokeNccStaff } = await import("@/server/ncc/ncc-staff.service");
    return serializeStaffMembership(await revokeNccStaff(data));
  });

// ─── Workers ─────────────────────────────────────────────────────────────────

export const nccTriggerSettlementWorkers = createServerFn({ method: "POST" }).handler(async () => {
  const { triggerNccSettlementWorkersManually } = await import(
    "@/server/ncc/ncc-workers.service"
  );
  const result = await triggerNccSettlementWorkersManually();
  return {
    skipped: Boolean(result.skipped),
    summary: JSON.stringify(result),
  };
});

export { NCC_SENSITIVE_CONFIRMATION };
