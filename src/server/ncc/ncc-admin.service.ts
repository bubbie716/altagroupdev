import type {
  FinancialInstitutionStatus,
  FinancialInstitutionType,
  InstitutionMemberRole,
  RoutingNumberStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  allocateRoutingNumberCandidate,
  NCC_DEFAULT_CURRENCY,
  slugifyInstitutionName,
} from "@/lib/ncc/ncc-money";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

async function writeNccAudit(input: {
  actorUserId: string;
  action: string;
  entityType:
    | "FINANCIAL_INSTITUTION"
    | "ROUTING_NUMBER"
    | "SETTLEMENT_ACCOUNT"
    | "INSTITUTION_MEMBER"
    | "SETTLEMENT_INSTRUCTION";
  entityId: string;
  description: string;
  /** NCC institution scope for portal audit isolation. */
  institutionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

export async function createInstitution(input: {
  legalName: string;
  displayName: string;
  slug?: string;
  institutionType: FinancialInstitutionType;
  description?: string;
  websiteUrl?: string;
  isAlta?: boolean;
  isNCCParticipant?: boolean;
  primaryContactUserId?: string;
}) {
  const actor = await requireNccStaff("manage_institutions");
  const slug = (input.slug?.trim() || slugifyInstitutionName(input.displayName || input.legalName)).toLowerCase();

  const institution = await prisma.financialInstitution.create({
    data: {
      legalName: input.legalName.trim(),
      displayName: input.displayName.trim(),
      slug,
      institutionType: input.institutionType,
      status: "APPLICANT",
      description: input.description?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      isAlta: input.isAlta ?? false,
      isNCCParticipant: input.isNCCParticipant ?? false,
      primaryContactUserId: input.primaryContactUserId ?? null,
    },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.INSTITUTION_CREATED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: institution.id,
    description: `Institution ${institution.displayName} created`,
    institutionId: institution.id,
    metadata: { slug: institution.slug, institutionType: institution.institutionType },
  });

  return institution;
}

/**
 * @deprecated Sprint 4F — unsafe activation bypass removed.
 * Production activation path is exclusively:
 * approved application + accepted regulatory documents + passed connector certification
 * + authorized staff LIVE promotion → ACTIVE participant.
 * Use `promoteInstitutionToLive` from ncc-live-promotion.service.
 */
export async function approveInstitution(_institutionId: string): Promise<never> {
  await requireNccStaff("manage_institutions");
  throw new Error(
    "UNSAFE_ACTIVATION_BYPASS_DISABLED: use approved application + documents + certification + promoteInstitutionToLive",
  );
}

async function setInstitutionStatus(
  institutionId: string,
  status: Extract<FinancialInstitutionStatus, "RESTRICTED" | "SUSPENDED" | "TERMINATED">,
  action: string,
) {
  const actor = await requireNccStaff();
  const data: {
    status: FinancialInstitutionStatus;
    suspendedAt?: Date | null;
    terminatedAt?: Date | null;
  } = { status };
  if (status === "SUSPENDED") data.suspendedAt = new Date();
  if (status === "TERMINATED") {
    data.terminatedAt = new Date();
    data.suspendedAt = new Date();
  }

  const institution = await prisma.financialInstitution.update({
    where: { id: institutionId },
    data,
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: institutionId,
    description: `Institution ${institution.displayName} set to ${status}`,
    institutionId,
  });

  return institution;
}

export function restrictInstitution(institutionId: string) {
  return setInstitutionStatus(institutionId, "RESTRICTED", NCC_AUDIT.INSTITUTION_RESTRICTED);
}

export function suspendInstitution(institutionId: string) {
  return setInstitutionStatus(institutionId, "SUSPENDED", NCC_AUDIT.INSTITUTION_SUSPENDED);
}

export function terminateInstitution(institutionId: string) {
  return setInstitutionStatus(institutionId, "TERMINATED", NCC_AUDIT.INSTITUTION_TERMINATED);
}

export async function assignRoutingNumber(input: {
  institutionId: string;
  routingNumber?: string;
  isPrimary?: boolean;
  label?: string;
}) {
  const actor = await requireNccStaff();
  const institution = await prisma.financialInstitution.findUniqueOrThrow({
    where: { id: input.institutionId },
  });

  let routingNumber = input.routingNumber?.replace(/\D/g, "");
  if (!routingNumber) {
    const count = await prisma.routingNumber.count();
    const prefix = institution.routingPrefix?.replace(/\D/g, "").slice(0, 3) || "021";
    routingNumber = allocateRoutingNumberCandidate(prefix, count + 1);
  }
  if (routingNumber.length < 9) {
    routingNumber = routingNumber.padStart(9, "0");
  }

  const existingActive = await prisma.routingNumber.findFirst({
    where: { routingNumber, status: { in: ["ACTIVE", "RESERVED", "SUSPENDED"] } },
  });
  if (existingActive) {
    throw new Error("ROUTING_NUMBER_IN_USE");
  }

  if (input.isPrimary) {
    await prisma.routingNumber.updateMany({
      where: { institutionId: input.institutionId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const row = await prisma.routingNumber.create({
    data: {
      institutionId: input.institutionId,
      routingNumber,
      status: "ACTIVE",
      isPrimary: input.isPrimary ?? false,
      label: input.label ?? null,
      activatedAt: new Date(),
    },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ROUTING_NUMBER_ASSIGNED,
    entityType: "ROUTING_NUMBER",
    entityId: row.id,
    description: `Routing number ${row.routingNumber} assigned to ${institution.displayName}`,
    institutionId: input.institutionId,
    metadata: { institutionId: input.institutionId, isPrimary: row.isPrimary },
  });

  return row;
}

export async function suspendRoutingNumber(routingNumberId: string) {
  const actor = await requireNccStaff();
  const row = await prisma.routingNumber.update({
    where: { id: routingNumberId },
    data: {
      status: "SUSPENDED" satisfies RoutingNumberStatus,
      deactivatedAt: new Date(),
    },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.ROUTING_NUMBER_SUSPENDED,
    entityType: "ROUTING_NUMBER",
    entityId: routingNumberId,
    description: `Routing number ${row.routingNumber} suspended`,
    institutionId: row.institutionId,
  });

  return row;
}

export async function createSettlementAccount(input: {
  institutionId: string;
  currency?: string;
}) {
  const actor = await requireNccStaff();
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  const account = await prisma.settlementAccount.create({
    data: {
      institutionId: input.institutionId,
      currency,
      ledgerBalance: 0,
      availableBalance: 0,
      status: "ACTIVE",
    },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.SETTLEMENT_ACCOUNT_ADJUSTED,
    entityType: "SETTLEMENT_ACCOUNT",
    entityId: account.id,
    description: `Settlement account created for currency ${currency}`,
    institutionId: input.institutionId,
    metadata: { institutionId: input.institutionId, currency },
  });

  return account;
}

/**
 * @deprecated Sprint 4E — direct balance edits are disabled.
 * Use dual-control liquidity operations (requestLiquidityOperation / approveLiquidityOperation).
 */
export async function adjustSettlementAccount(_input: {
  settlementAccountId: string;
  amount: number;
  reason: string;
}): Promise<never> {
  await requireNccStaff();
  throw new Error(
    "DIRECT_BALANCE_EDIT_DISABLED: use authorized liquidity operations (funding/withdrawal/correction)",
  );
}

export async function addInstitutionMember(input: {
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
}) {
  const actor = await requireNccStaff();
  const member = await prisma.institutionMember.upsert({
    where: {
      institutionId_userId: {
        institutionId: input.institutionId,
        userId: input.userId,
      },
    },
    create: {
      institutionId: input.institutionId,
      userId: input.userId,
      role: input.role,
      status: "ACTIVE",
      invitedByUserId: actor.id,
    },
    update: {
      role: input.role,
      status: "ACTIVE",
      revokedAt: null,
      invitedByUserId: actor.id,
    },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.INSTITUTION_MEMBER_ADDED,
    entityType: "INSTITUTION_MEMBER",
    entityId: member.id,
    description: `Institution member added with role ${input.role}`,
    institutionId: input.institutionId,
    metadata: { institutionId: input.institutionId, userId: input.userId, role: input.role },
  });

  return member;
}

export async function removeInstitutionMember(input: { institutionId: string; userId: string }) {
  const actor = await requireNccStaff();
  const member = await prisma.institutionMember.update({
    where: {
      institutionId_userId: {
        institutionId: input.institutionId,
        userId: input.userId,
      },
    },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await writeNccAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.INSTITUTION_MEMBER_REMOVED,
    entityType: "INSTITUTION_MEMBER",
    entityId: member.id,
    description: `Institution member removed`,
    institutionId: input.institutionId,
    metadata: { institutionId: input.institutionId, userId: input.userId },
  });

  return member;
}

export async function listNccAuditHistory(limit = 50) {
  await requireNccStaff();
  const { queryAuditLogs } = await import("@/server/audit.service");
  return queryAuditLogs({ q: "NCC_" }, Math.min(limit, 100));
}
