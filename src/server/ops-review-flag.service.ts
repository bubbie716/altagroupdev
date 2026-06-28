import type {
  OpsReviewFlagReasonCode,
  OpsReviewFlagRow,
  OpsReviewFlagTargetType,
} from "@/lib/internal/ops-review-flag.types";
import { OPS_REVIEW_FLAG_REASON_LABELS } from "@/lib/internal/ops-review-flag.types";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isMissingOpsV1TableError } from "@/server/ops-prisma-guard";
import type { OpsReviewFlagReason, OpsReviewFlagTargetType as PrismaTargetType } from "@prisma/client";

function mapFlag(
  flag: Awaited<ReturnType<typeof prisma.opsReviewFlag.findFirst>> & {
    createdBy: { discordUsername: string };
    resolvedBy: { discordUsername: string } | null;
  },
): OpsReviewFlagRow {
  if (!flag) throw new Error("NOT_FOUND");
  const reason = flag.reason as OpsReviewFlagReasonCode;
  return {
    id: flag.id,
    targetType: flag.targetType as OpsReviewFlagTargetType,
    targetId: flag.targetId,
    reason,
    reasonLabel:
      reason === "CUSTOM" && flag.customReason
        ? flag.customReason
        : OPS_REVIEW_FLAG_REASON_LABELS[reason],
    customReason: flag.customReason,
    status: flag.status as "ACTIVE" | "RESOLVED",
    createdByUsername: flag.createdBy.discordUsername,
    resolvedByUsername: flag.resolvedBy?.discordUsername ?? null,
    resolveReason: flag.resolveReason,
    createdAt: flag.createdAt.toISOString(),
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
  };
}

const flagInclude = {
  createdBy: true,
  resolvedBy: true,
} as const;

export async function listActiveOpsReviewFlags(
  targetType: OpsReviewFlagTargetType,
  targetId: string,
): Promise<OpsReviewFlagRow[]> {
  await requireOperator();
  try {
    const rows = await prisma.opsReviewFlag.findMany({
      where: { targetType: targetType as PrismaTargetType, targetId, status: "ACTIVE" },
      include: flagInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => mapFlag(r));
  } catch (error) {
    if (isMissingOpsV1TableError(error)) return [];
    throw error;
  }
}

export async function listActiveOpsReviewFlagsForTargets(
  targets: { targetType: OpsReviewFlagTargetType; targetId: string }[],
): Promise<OpsReviewFlagRow[]> {
  await requireOperator();
  if (targets.length === 0) return [];
  try {
    const rows = await prisma.opsReviewFlag.findMany({
      where: {
        status: "ACTIVE",
        OR: targets.map((t) => ({
          targetType: t.targetType as PrismaTargetType,
          targetId: t.targetId,
        })),
      },
      include: flagInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => mapFlag(r));
  } catch (error) {
    if (isMissingOpsV1TableError(error)) return [];
    throw error;
  }
}

export async function createOpsReviewFlag(
  actorUserId: string,
  input: {
    targetType: OpsReviewFlagTargetType;
    targetId: string;
    reason: OpsReviewFlagReasonCode;
    customReason?: string;
    note?: string;
  },
): Promise<OpsReviewFlagRow> {
  await requireOperator();
  if (input.reason === "CUSTOM" && !input.customReason?.trim()) {
    throw new Error("Custom reason required");
  }

  const flag = await prisma.opsReviewFlag.create({
    data: {
      targetType: input.targetType as PrismaTargetType,
      targetId: input.targetId,
      reason: input.reason as OpsReviewFlagReason,
      customReason: input.customReason?.trim() || null,
      createdByUserId: actorUserId,
    },
    include: flagInclude,
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const reasonLabel =
    input.reason === "CUSTOM"
      ? (input.customReason ?? "Custom")
      : OPS_REVIEW_FLAG_REASON_LABELS[input.reason];

  await writeAuditLog({
    actorUserId,
    action: "OPS_REVIEW_FLAG_CREATED",
    entityType: input.targetType as import("@prisma/client").AuditEntityType,
    entityId: input.targetId,
    description: `Operational review flag added: ${reasonLabel}`,
    metadata: {
      flagId: flag.id,
      reason: input.reason,
      customReason: input.customReason ?? null,
      note: input.note ?? null,
    },
  });

  return mapFlag(flag);
}

export async function resolveOpsReviewFlag(
  actorUserId: string,
  flagId: string,
  resolveReason: string,
): Promise<OpsReviewFlagRow> {
  await requireOperator();
  const existing = await prisma.opsReviewFlag.findUnique({
    where: { id: flagId },
    include: flagInclude,
  });
  if (!existing || existing.status !== "ACTIVE") throw new Error("NOT_FOUND");

  const flag = await prisma.opsReviewFlag.update({
    where: { id: flagId },
    data: {
      status: "RESOLVED",
      resolvedByUserId: actorUserId,
      resolveReason: resolveReason.trim(),
      resolvedAt: new Date(),
    },
    include: flagInclude,
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "OPS_REVIEW_FLAG_RESOLVED",
    entityType: flag.targetType as import("@prisma/client").AuditEntityType,
    entityId: flag.targetId,
    description: `Operational review flag resolved: ${resolveReason.trim()}`,
    metadata: { flagId: flag.id, resolveReason: resolveReason.trim() },
  });

  return mapFlag(flag);
}

export async function collectCustomerFlagTargets(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      bankAccounts: { select: { id: true } },
      loansBorrowed: { select: { id: true } },
      altaCardsOwned: { select: { id: true } },
    },
  });
  if (!user) return [];

  const targets: { targetType: OpsReviewFlagTargetType; targetId: string }[] = [
    { targetType: "USER", targetId: userId },
  ];
  for (const a of user.bankAccounts) targets.push({ targetType: "BANK_ACCOUNT", targetId: a.id });
  for (const l of user.loansBorrowed) targets.push({ targetType: "LOAN", targetId: l.id });
  for (const c of user.altaCardsOwned) targets.push({ targetType: "ALTA_CARD", targetId: c.id });
  return targets;
}

export async function collectCompanyFlagTargets(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: { select: { id: true } },
      loans: { select: { id: true } },
      altaCards: { select: { id: true } },
    },
  });
  if (!company) return [];

  const targets: { targetType: OpsReviewFlagTargetType; targetId: string }[] = [
    { targetType: "COMPANY", targetId: companyId },
  ];
  for (const a of company.bankAccounts) targets.push({ targetType: "BANK_ACCOUNT", targetId: a.id });
  for (const l of company.loans) targets.push({ targetType: "LOAN", targetId: l.id });
  for (const c of company.altaCards) targets.push({ targetType: "ALTA_CARD", targetId: c.id });
  return targets;
}
