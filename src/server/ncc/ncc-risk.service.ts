import {
  Prisma,
  type NccInstitutionRiskPolicy,
  type NccRiskDecision,
  type NccRiskDecisionOutcome,
} from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  asDecimal,
  moneyAdd,
  moneyLt,
  toMoneyDecimal,
} from "@/lib/ncc/ncc-money";
import { assertTypedConfirmation } from "@/lib/ncc/ncc-staff-permissions";
import { prisma } from "@/server/db";
import {
  requireInstitutionPermission,
  requireNccStaff,
} from "@/server/ncc/ncc-permissions.service";

export class NccRiskError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccRiskError";
  }
}

export type RiskPolicyView = {
  id: string | null;
  institutionId: string;
  maxTransferAmount: string | null;
  dailyAmountLimit: string | null;
  dailyTransactionCountLimit: number | null;
  manualReviewThreshold: string | null;
  probationMaxTransferAmount: string | null;
  probationDailyAmountLimit: string | null;
  probationDailyTxnLimit: number | null;
  emergencyZeroLimit: boolean;
  enabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  reason: string | null;
};

export type RiskEvaluationResult = {
  outcome: NccRiskDecisionOutcome;
  reasonCode: string | null;
  reason: string | null;
  decisionId: string | null;
  policySnapshot: Record<string, unknown> | null;
};

function decimalOrNull(value: Prisma.Decimal | null | undefined): string | null {
  return value == null ? null : value.toFixed(2);
}

function mapPolicy(row: NccInstitutionRiskPolicy | null, institutionId: string): RiskPolicyView {
  if (!row) {
    return {
      id: null,
      institutionId,
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
    id: row.id,
    institutionId: row.institutionId,
    maxTransferAmount: decimalOrNull(row.maxTransferAmount),
    dailyAmountLimit: decimalOrNull(row.dailyAmountLimit),
    dailyTransactionCountLimit: row.dailyTransactionCountLimit,
    manualReviewThreshold: decimalOrNull(row.manualReviewThreshold),
    probationMaxTransferAmount: decimalOrNull(row.probationMaxTransferAmount),
    probationDailyAmountLimit: decimalOrNull(row.probationDailyAmountLimit),
    probationDailyTxnLimit: row.probationDailyTxnLimit,
    emergencyZeroLimit: row.emergencyZeroLimit,
    enabled: row.enabled,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    reason: row.reason,
  };
}

function tighterDecimal(
  a: Prisma.Decimal | null | undefined,
  b: Prisma.Decimal | null | undefined,
): Prisma.Decimal | null {
  if (a == null && b == null) return null;
  if (a == null) return b ?? null;
  if (b == null) return a;
  return moneyLt(a, b) ? a : b;
}

function tighterInt(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.min(a, b);
}

function usageDateUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function writeRiskAudit(input: {
  actorUserId: string;
  action: string;
  entityType: "NCC_RISK_POLICY" | "NCC_RISK_DECISION" | "SETTLEMENT_INSTRUCTION";
  entityId: string;
  description: string;
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

/** Active policy for an institution (enabled, currently effective). */
export async function getEffectiveRiskPolicy(
  institutionId: string,
): Promise<NccInstitutionRiskPolicy | null> {
  const now = new Date();
  return prisma.nccInstitutionRiskPolicy.findFirst({
    where: {
      institutionId,
      enabled: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** Institution-owner read-only view — cannot mutate policy. */
export async function getInstitutionRiskPolicyView(
  institutionId: string,
): Promise<RiskPolicyView> {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const policy = await getEffectiveRiskPolicy(institutionId);
  return mapPolicy(policy, institutionId);
}

export async function upsertRiskPolicy(input: {
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
}): Promise<RiskPolicyView> {
  const actor = await requireNccStaff("manage_risk_limits");
  const reason = input.reason.trim();
  if (!reason) throw new NccRiskError("REASON_REQUIRED");

  await prisma.financialInstitution.findUniqueOrThrow({
    where: { id: input.institutionId },
  });

  const toOptionalMoney = (v: number | string | null | undefined): Prisma.Decimal | null => {
    if (v === undefined || v === null || v === "") return null;
    return toMoneyDecimal(v);
  };

  const now = new Date();
  const current = await getEffectiveRiskPolicy(input.institutionId);
  if (current) {
    await prisma.nccInstitutionRiskPolicy.update({
      where: { id: current.id },
      data: { enabled: false, effectiveTo: now },
    });
  }

  const created = await prisma.nccInstitutionRiskPolicy.create({
    data: {
      institutionId: input.institutionId,
      maxTransferAmount: toOptionalMoney(input.maxTransferAmount),
      dailyAmountLimit: toOptionalMoney(input.dailyAmountLimit),
      dailyTransactionCountLimit: input.dailyTransactionCountLimit ?? null,
      manualReviewThreshold: toOptionalMoney(input.manualReviewThreshold),
      probationMaxTransferAmount: toOptionalMoney(input.probationMaxTransferAmount),
      probationDailyAmountLimit: toOptionalMoney(input.probationDailyAmountLimit),
      probationDailyTxnLimit: input.probationDailyTxnLimit ?? null,
      emergencyZeroLimit: input.emergencyZeroLimit ?? false,
      enabled: input.enabled ?? true,
      effectiveFrom: now,
      updatedByUserId: actor.id,
      reason,
    },
  });

  await writeRiskAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.RISK_POLICY_UPDATED,
    entityType: "NCC_RISK_POLICY",
    entityId: created.id,
    institutionId: input.institutionId,
    description: `Risk policy updated for institution ${input.institutionId}`,
    metadata: { reason, previousPolicyId: current?.id ?? null },
  });

  return mapPolicy(created, input.institutionId);
}

async function ensureDailyUsageLocked(
  tx: Prisma.TransactionClient,
  institutionId: string,
  day: Date,
): Promise<{ id: string; amountTotal: Prisma.Decimal; transactionCount: number }> {
  // Upsert by Prisma Date (@db.Date), then lock by primary key.
  // Do not re-match on usageDate in raw SQL — `${Date}::date` can shift the
  // calendar day under non-UTC session timezones and yield DAILY_USAGE_LOCK_FAILED.
  const usage = await tx.nccDailyRiskUsage.upsert({
    where: {
      institutionId_usageDate: { institutionId, usageDate: day },
    },
    create: {
      institutionId,
      usageDate: day,
      amountTotal: new Prisma.Decimal("0"),
      transactionCount: 0,
    },
    update: {},
  });

  const rows = await tx.$queryRaw<
    { id: string; amountTotal: Prisma.Decimal; transactionCount: number }[]
  >`
    SELECT id, "amountTotal", "transactionCount"
    FROM "NccDailyRiskUsage"
    WHERE id = ${usage.id}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new NccRiskError("DAILY_USAGE_LOCK_FAILED");
  return row;
}

function evaluateAgainstPolicy(input: {
  amount: Prisma.Decimal;
  policy: NccInstitutionRiskPolicy | null;
  usageAmount: Prisma.Decimal;
  usageCount: number;
}): Omit<RiskEvaluationResult, "decisionId"> {
  if (!input.policy || !input.policy.enabled) {
    return {
      outcome: "ALLOW",
      reasonCode: null,
      reason: null,
      policySnapshot: null,
    };
  }

  const policy = input.policy;
  const snapshot = {
    maxTransferAmount: decimalOrNull(policy.maxTransferAmount),
    dailyAmountLimit: decimalOrNull(policy.dailyAmountLimit),
    dailyTransactionCountLimit: policy.dailyTransactionCountLimit,
    manualReviewThreshold: decimalOrNull(policy.manualReviewThreshold),
    probationMaxTransferAmount: decimalOrNull(policy.probationMaxTransferAmount),
    probationDailyAmountLimit: decimalOrNull(policy.probationDailyAmountLimit),
    probationDailyTxnLimit: policy.probationDailyTxnLimit,
    emergencyZeroLimit: policy.emergencyZeroLimit,
  };

  if (policy.emergencyZeroLimit) {
    return {
      outcome: "REJECT",
      reasonCode: "EMERGENCY_ZERO_LIMIT",
      reason: "Emergency zero transfer limit is active for this institution",
      policySnapshot: snapshot,
    };
  }

  const maxTransfer = tighterDecimal(policy.maxTransferAmount, policy.probationMaxTransferAmount);
  if (maxTransfer && moneyLt(maxTransfer, input.amount)) {
    return {
      outcome: "REJECT",
      reasonCode: "MAX_TRANSFER_EXCEEDED",
      reason: `Transfer amount exceeds max transfer limit of ${maxTransfer.toFixed(2)}`,
      policySnapshot: snapshot,
    };
  }

  const dailyAmount = tighterDecimal(policy.dailyAmountLimit, policy.probationDailyAmountLimit);
  if (dailyAmount) {
    const projected = moneyAdd(input.usageAmount, input.amount);
    if (moneyLt(dailyAmount, projected)) {
      return {
        outcome: "REJECT",
        reasonCode: "DAILY_AMOUNT_LIMIT_EXCEEDED",
        reason: `Daily amount limit of ${dailyAmount.toFixed(2)} would be exceeded`,
        policySnapshot: snapshot,
      };
    }
  }

  const dailyCount = tighterInt(
    policy.dailyTransactionCountLimit,
    policy.probationDailyTxnLimit,
  );
  if (dailyCount != null && input.usageCount + 1 > dailyCount) {
    return {
      outcome: "REJECT",
      reasonCode: "DAILY_COUNT_LIMIT_EXCEEDED",
      reason: `Daily transaction count limit of ${dailyCount} would be exceeded`,
      policySnapshot: snapshot,
    };
  }

  if (
    policy.manualReviewThreshold &&
    !moneyLt(input.amount, policy.manualReviewThreshold)
  ) {
    return {
      outcome: "MANUAL_REVIEW",
      reasonCode: "MANUAL_REVIEW_THRESHOLD",
      reason: `Amount meets or exceeds manual review threshold of ${policy.manualReviewThreshold.toFixed(2)}`,
      policySnapshot: snapshot,
    };
  }

  // COMPLIANCE_HOLD is a stub decision point — not auto-triggered by jurisdiction rules.
  return {
    outcome: "ALLOW",
    reasonCode: null,
    reason: null,
    policySnapshot: snapshot,
  };
}

/**
 * Evaluate settlement risk before source prepare / ledger.
 * Persists NccRiskDecision when settlementInstructionId is provided.
 * Increments daily usage only on ALLOW (or later OVERRIDE_ALLOW).
 */
export async function evaluateSettlementRisk(input: {
  institutionId: string;
  amount: number | string | Prisma.Decimal;
  settlementInstructionId?: string;
}): Promise<RiskEvaluationResult> {
  const amount = asDecimal(
    input.amount instanceof Prisma.Decimal
      ? input.amount
      : toMoneyDecimal(input.amount),
  );

  if (input.settlementInstructionId) {
    const existing = await prisma.nccRiskDecision.findUnique({
      where: { settlementInstructionId: input.settlementInstructionId },
    });
    if (existing) {
      return {
        outcome: existing.outcome,
        reasonCode: existing.reasonCode,
        reason: existing.reason,
        decisionId: existing.id,
        policySnapshot:
          existing.policySnapshot && typeof existing.policySnapshot === "object"
            ? (existing.policySnapshot as Record<string, unknown>)
            : null,
      };
    }
  }

  const policy = await getEffectiveRiskPolicy(input.institutionId);
  const day = usageDateUtc();

  const { evaluation, decision } = await prisma.$transaction(async (tx) => {
    const usage = await ensureDailyUsageLocked(tx, input.institutionId, day);
    const evaluation = evaluateAgainstPolicy({
      amount,
      policy,
      usageAmount: asDecimal(usage.amountTotal),
      usageCount: usage.transactionCount,
    });

    let decision: NccRiskDecision | null = null;
    if (input.settlementInstructionId) {
      decision = await tx.nccRiskDecision.create({
        data: {
          settlementInstructionId: input.settlementInstructionId,
          institutionId: input.institutionId,
          outcome: evaluation.outcome,
          reasonCode: evaluation.reasonCode,
          reason: evaluation.reason,
          amount,
          policySnapshot: (evaluation.policySnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

      if (evaluation.outcome === "ALLOW") {
        await tx.nccDailyRiskUsage.update({
          where: { id: usage.id },
          data: {
            amountTotal: moneyAdd(asDecimal(usage.amountTotal), amount),
            transactionCount: usage.transactionCount + 1,
          },
        });
      }
    }

    return { evaluation, decision };
  });

  if (input.settlementInstructionId && decision) {
    const submittedByUserId = (
      await prisma.settlementInstruction.findUnique({
        where: { id: input.settlementInstructionId },
        select: { submittedByUserId: true },
      })
    )?.submittedByUserId;
    const actor =
      submittedByUserId ??
      (
        await prisma.user.findFirst({
          where: { tags: { some: { tag: "ADMIN" } } },
          select: { id: true },
        })
      )?.id;

    if (actor) {
      await writeRiskAudit({
        actorUserId: actor,
        action:
          evaluation.outcome === "REJECT"
            ? NCC_AUDIT.RISK_VIOLATION_ATTEMPT
            : NCC_AUDIT.RISK_DECISION,
        entityType: "NCC_RISK_DECISION",
        entityId: decision.id,
        institutionId: input.institutionId,
        description: `Risk ${evaluation.outcome} for settlement ${input.settlementInstructionId}`,
        metadata: {
          reasonCode: evaluation.reasonCode,
          reason: evaluation.reason,
          amount: amount.toFixed(2),
        },
      });
    }

    if (evaluation.outcome === "REJECT") {
      try {
        const { upsertOpenAlertRecord } = await import("@/server/ncc/ncc-alerts.service");
        await upsertOpenAlertRecord({
          alertKey: `risk.violation:${input.institutionId}:${evaluation.reasonCode ?? "REJECT"}`,
          title: "Risk policy violation attempt",
          detail: evaluation.reason ?? evaluation.reasonCode ?? "REJECT",
          severity: "WARNING",
          entityType: "SETTLEMENT_INSTRUCTION",
          entityId: input.settlementInstructionId,
          metadata: {
            institutionId: input.institutionId,
            reasonCode: evaluation.reasonCode,
          },
        });
      } catch {
        // Alerts are best-effort; risk decision already persisted.
      }
    }
  }

  return {
    ...evaluation,
    decisionId: decision?.id ?? null,
  };
}

/** Staff override of a held/rejected risk decision — resumes execution when allowed. */
export async function overrideRiskDecision(input: {
  settlementInstructionId: string;
  reason: string;
  confirmation: string;
}): Promise<RiskEvaluationResult> {
  const actor = await requireNccStaff("override_risk");
  assertTypedConfirmation(input.confirmation);
  const reason = input.reason.trim();
  if (!reason) throw new NccRiskError("REASON_REQUIRED");

  const decision = await prisma.nccRiskDecision.findUnique({
    where: { settlementInstructionId: input.settlementInstructionId },
  });
  if (!decision) throw new NccRiskError("RISK_DECISION_NOT_FOUND");
  if (decision.outcome === "OVERRIDE_ALLOW" || decision.outcome === "ALLOW") {
    return {
      outcome: decision.outcome,
      reasonCode: decision.reasonCode,
      reason: decision.reason,
      decisionId: decision.id,
      policySnapshot:
        decision.policySnapshot && typeof decision.policySnapshot === "object"
          ? (decision.policySnapshot as Record<string, unknown>)
          : null,
    };
  }

  const day = usageDateUtc();
  const updated = await prisma.$transaction(async (tx) => {
    const usage = await ensureDailyUsageLocked(tx, decision.institutionId, day);
    const row = await tx.nccRiskDecision.update({
      where: { id: decision.id },
      data: {
        outcome: "OVERRIDE_ALLOW",
        overriddenByUserId: actor.id,
        overrideReason: reason,
        reasonCode: decision.reasonCode ?? "OVERRIDE_ALLOW",
        reason: `Override: ${reason}`,
      },
    });
    await tx.nccDailyRiskUsage.update({
      where: { id: usage.id },
      data: {
        amountTotal: moneyAdd(asDecimal(usage.amountTotal), asDecimal(decision.amount)),
        transactionCount: usage.transactionCount + 1,
      },
    });
    return row;
  });

  await writeRiskAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.RISK_OVERRIDE,
    entityType: "NCC_RISK_DECISION",
    entityId: updated.id,
    institutionId: decision.institutionId,
    description: `Risk decision overridden for ${input.settlementInstructionId}`,
    metadata: { reason, priorOutcome: decision.outcome },
  });

  const { continueSubmittedInstruction } = await import("@/server/ncc/ncc-settlement.service");
  await continueSubmittedInstruction(input.settlementInstructionId, actor.id);

  return {
    outcome: updated.outcome,
    reasonCode: updated.reasonCode,
    reason: updated.reason,
    decisionId: updated.id,
    policySnapshot:
      updated.policySnapshot && typeof updated.policySnapshot === "object"
        ? (updated.policySnapshot as Record<string, unknown>)
        : null,
  };
}
