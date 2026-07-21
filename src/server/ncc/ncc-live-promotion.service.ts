import { prisma } from "@/server/db";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";
import { institutionCertificationPassed } from "@/server/ncc/ncc-certification.service";

export class NccLivePromotionError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccLivePromotionError";
  }
}

export type LivePromotionGateResult = {
  ok: boolean;
  blockers: string[];
  applicationId: string | null;
  institutionId: string;
};

export type LivePromotionResult = {
  institutionId: string;
  routingNumber: string;
  settlementAccountId: string;
  ledgerBalance: string;
  reused: boolean;
};

/** Evaluate LIVE promotion gates without mutating state. */
export async function evaluateLivePromotionGates(
  institutionId: string,
): Promise<LivePromotionGateResult> {
  const blockers: string[] = [];
  const institution = await prisma.financialInstitution.findUnique({
    where: { id: institutionId },
  });
  if (!institution) {
    return { ok: false, blockers: ["INSTITUTION_NOT_FOUND"], applicationId: null, institutionId };
  }

  // Already LIVE — gates are considered satisfied for idempotent recovery.
  if (institution.status === "ACTIVE" && institution.isNCCParticipant) {
    return { ok: true, blockers: [], applicationId: null, institutionId };
  }

  if (institution.status !== "CERTIFICATION") {
    blockers.push("INSTITUTION_NOT_IN_CERTIFICATION");
  }

  const application = await prisma.nccParticipantApplication.findFirst({
    where: { institutionId },
    orderBy: { updatedAt: "desc" },
  });
  if (!application || application.status !== "APPROVED_FOR_LIVE") {
    blockers.push("APPLICATION_NOT_APPROVED_FOR_LIVE");
  } else {
    if (!application.technicalContactEmail?.trim() || !application.technicalContactName?.trim()) {
      blockers.push("TECHNICAL_CONTACT_MISSING");
    }
    if (
      !application.settlementOpsContactEmail?.trim() ||
      !application.settlementOpsContactName?.trim()
    ) {
      blockers.push("OPERATIONAL_CONTACT_MISSING");
    }
  }

  const openInfo = await prisma.nccParticipantApplication.count({
    where: { institutionId, status: "INFORMATION_REQUIRED" },
  });
  if (openInfo > 0) blockers.push("UNRESOLVED_BLOCKING_REVIEW_ITEM");

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId },
  });
  if (!connector || connector.certificationStatus !== "PASSED") {
    blockers.push("CONNECTOR_NOT_CERTIFIED");
  } else if (!(await institutionCertificationPassed(institutionId))) {
    blockers.push("CERTIFICATION_RUN_NOT_PASSED");
  }

  const reserved = await prisma.routingNumber.findFirst({
    where: { institutionId, status: "RESERVED", isPrimary: true },
  });
  if (!reserved) blockers.push("ROUTING_NUMBER_NOT_RESERVED");

  if (application?.id) {
    const { assertMandatoryDocumentsAccepted } = await import(
      "@/server/ncc/ncc-participant-documents.service"
    );
    const docs = await assertMandatoryDocumentsAccepted(application.id);
    if (!docs.ok) {
      for (const blocker of docs.blockers) {
        if (!blockers.includes(blocker.code)) blockers.push(blocker.code);
      }
    }
  } else if (!blockers.includes("APPLICATION_NOT_APPROVED_FOR_LIVE")) {
    blockers.push("REGULATORY_DOCUMENTS_INCOMPLETE");
  }

  return {
    ok: blockers.length === 0,
    blockers,
    applicationId: application?.id ?? null,
    institutionId,
  };
}

async function loadLiveActivationSnapshot(institutionId: string): Promise<LivePromotionResult | null> {
  const institution = await prisma.financialInstitution.findUnique({
    where: { id: institutionId },
  });
  if (!institution || institution.status !== "ACTIVE" || !institution.isNCCParticipant) {
    return null;
  }
  const routing = await prisma.routingNumber.findFirst({
    where: { institutionId, status: "ACTIVE", isPrimary: true },
  });
  const settlement = await prisma.settlementAccount.findFirst({
    where: { institutionId, currency: NCC_DEFAULT_CURRENCY },
  });
  if (!routing || !settlement) return null;
  return {
    institutionId,
    routingNumber: routing.routingNumber,
    settlementAccountId: settlement.id,
    ledgerBalance: String(settlement.ledgerBalance),
    reused: true,
  };
}

/**
 * Atomically promote a CERTIFICATION institution to ACTIVE LIVE participant.
 * Idempotent: retrying after success returns the completed activation.
 * Creates FLR settlement account at exactly 0.00 if missing — never seeds/overwrites liquidity.
 */
export async function promoteInstitutionToLiveAsStaff(
  institutionId: string,
  actorUserId: string,
): Promise<LivePromotionResult> {
  const already = await loadLiveActivationSnapshot(institutionId);
  if (already) return already;

  const gates = await evaluateLivePromotionGates(institutionId);
  if (!gates.ok) {
    // Race: another worker may have activated between check and now.
    const raced = await loadLiveActivationSnapshot(institutionId);
    if (raced) return raced;
    throw new NccLivePromotionError(
      gates.blockers[0] ?? "LIVE_GATES_FAILED",
      `LIVE promotion blocked: ${gates.blockers.join(", ")}`,
    );
  }

  const currency = NCC_DEFAULT_CURRENCY;
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.financialInstitution.findUniqueOrThrow({
      where: { id: institutionId },
    });
    if (current.status === "ACTIVE" && current.isNCCParticipant) {
      const routing = await tx.routingNumber.findFirstOrThrow({
        where: { institutionId, status: "ACTIVE", isPrimary: true },
      });
      let settlement = await tx.settlementAccount.findFirst({
        where: { institutionId, currency },
      });
      if (!settlement) {
        settlement = await tx.settlementAccount.create({
          data: {
            institutionId,
            currency,
            ledgerBalance: 0,
            availableBalance: 0,
            status: "ACTIVE",
          },
        });
      }
      return {
        institutionId,
        routingNumber: routing.routingNumber,
        settlementAccountId: settlement.id,
        ledgerBalance: String(settlement.ledgerBalance),
        reused: true,
      };
    }

    await tx.financialInstitution.update({
      where: { id: institutionId },
      data: {
        status: "ACTIVE",
        isNCCParticipant: true,
      },
    });

    const routing = await tx.routingNumber.findFirst({
      where: { institutionId, status: "RESERVED", isPrimary: true },
    });
    if (!routing) throw new NccLivePromotionError("ROUTING_NUMBER_NOT_RESERVED");

    const activatedRouting = await tx.routingNumber.update({
      where: { id: routing.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        label: routing.label?.includes("pending") ? "Primary NCC routing" : routing.label,
      },
    });

    let settlement = await tx.settlementAccount.findFirst({
      where: { institutionId, currency },
    });
    if (!settlement) {
      settlement = await tx.settlementAccount.create({
        data: {
          institutionId,
          currency,
          ledgerBalance: 0,
          availableBalance: 0,
          status: "ACTIVE",
        },
      });
    }
    // Existing authorized balances are never overwritten or re-seeded.

    return {
      institutionId,
      routingNumber: activatedRouting.routingNumber,
      settlementAccountId: settlement.id,
      ledgerBalance: String(settlement.ledgerBalance),
      reused: false,
    };
  });

  // Audit best-effort — never tell the caller activation failed if the institution is LIVE.
  try {
    if (!result.reused) {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId,
        action: NCC_AUDIT.INSTITUTION_LIVE_ACTIVATED,
        entityType: "FINANCIAL_INSTITUTION",
        entityId: institutionId,
        institutionId,
        description: `Institution promoted to LIVE NCC participant (routing ${result.routingNumber})`,
        metadata: {
          routingNumber: result.routingNumber,
          settlementAccountId: result.settlementAccountId,
          ledgerBalance: result.ledgerBalance,
          applicationId: gates.applicationId,
        },
      });
    }
  } catch {
    // Institution is already LIVE; return success regardless of audit write outcome.
  }

  return result;
}

export async function promoteInstitutionToLive(institutionId: string) {
  const staff = await requireNccStaff("manage_institutions");
  return promoteInstitutionToLiveAsStaff(institutionId, staff.id);
}

export async function getLivePromotionGateView(institutionId: string) {
  await requireNccStaff("view_control_plane");
  return evaluateLivePromotionGates(institutionId);
}
