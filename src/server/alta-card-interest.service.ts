import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { isAdmin } from "@/lib/auth/permissions";
import { roundMoney } from "@/lib/bank/alta-card-minimum-payment";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { syncCardBillingSummary } from "@/server/alta-card-statement.service";
import { applyChargeInTx } from "@/server/alta-card-transaction.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

async function resolveActorUserId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

function generateCardTxReference(prefix: string): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ACARD-${prefix}-${date}-${suffix}`;
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function assertAdmin(user: AltaUser): void {
  if (!isAdmin(user)) forbidden();
}

/**
 * V1 monthly interest from unpaid statement balance.
 * interestRate on AltaCard is stored as APR percent (e.g. 24.99).
 */
export function calculateMonthlyInterestAmount(
  unpaidStatementBalance: number,
  interestRateAprPercent: number,
): number {
  if (unpaidStatementBalance <= 0 || interestRateAprPercent <= 0) return 0;
  return roundMoney((unpaidStatementBalance * interestRateAprPercent) / 100 / 12);
}

export async function calculateStatementInterest(statementId: string): Promise<{
  statementId: string;
  unpaidBalance: number;
  interestRate: number;
  interestAmount: number;
  eligible: boolean;
  reason: string | null;
}> {
  const statement = await prisma.altaCardStatement.findUnique({
    where: { id: statementId },
    include: { altaCard: true },
  });
  if (!statement) notFound();

  const unpaidBalance = decimalToNumber(statement.remainingBalance);
  const interestRate = decimalToNumber(statement.altaCard.interestRate);
  const now = new Date();
  const pastDue = statement.dueDate < now;
  const hasBalance = unpaidBalance > 0;
  const alreadyApplied = statement.interestAppliedAt != null;
  const closedStatuses = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];
  const isClosed = closedStatuses.includes(statement.status);

  let eligible = false;
  let reason: string | null = null;

  if (!isClosed) {
    reason = "Statement is not yet issued";
  } else if (!pastDue) {
    reason = "Statement is not yet past due";
  } else if (!hasBalance) {
    reason = "No unpaid balance";
  } else if (alreadyApplied) {
    reason = "Interest already applied for this billing period";
  } else {
    eligible = true;
  }

  const interestAmount = eligible
    ? calculateMonthlyInterestAmount(unpaidBalance, interestRate)
    : calculateMonthlyInterestAmount(unpaidBalance, interestRate);

  return {
    statementId,
    unpaidBalance,
    interestRate,
    interestAmount,
    eligible,
    reason,
  };
}

export async function applyStatementInterest(
  statementId: string,
  actorUserId?: string,
): Promise<{ statementId: string; interestAmount: number; transactionId: string }> {
  const preview = await calculateStatementInterest(statementId);
  if (!preview.eligible) {
    badRequest(preview.reason ?? "Statement is not eligible for interest");
  }
  if (preview.interestAmount <= 0) {
    badRequest("Calculated interest is zero");
  }

  const statement = await prisma.altaCardStatement.findUnique({
    where: { id: statementId },
    include: { altaCard: true },
  });
  if (!statement) notFound();

  const interestAmount = preview.interestAmount;
  const referenceCode = generateCardTxReference("INT");

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.altaCardStatement.findUnique({
      where: { id: statementId },
      include: { altaCard: true },
    });
    if (!fresh) notFound();
    if (fresh.interestAppliedAt) badRequest("Interest already applied for this billing period");

    const card = fresh.altaCard;
    await applyChargeInTx(tx, card, interestAmount, null, true);

    const cardTx = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        altaCardStatementId: fresh.id,
        type: "INTEREST",
        status: "COMPLETED",
        amount: toDecimal(interestAmount),
        description: `Interest on statement #${fresh.statementNumber}`,
        referenceCode,
        createdByUserId: actorUserId ?? null,
        settledAt: new Date(),
        metadata: { statementNumber: fresh.statementNumber },
      },
    });

    const newInterestCharged = roundMoney(decimalToNumber(fresh.interestCharged) + interestAmount);
    const newStatementBalance = roundMoney(decimalToNumber(fresh.statementBalance) + interestAmount);
    const newRemaining = roundMoney(decimalToNumber(fresh.remainingBalance) + interestAmount);

    await tx.altaCardStatement.update({
      where: { id: fresh.id },
      data: {
        interestCharged: toDecimal(newInterestCharged),
        statementBalance: toDecimal(newStatementBalance),
        remainingBalance: toDecimal(newRemaining),
        interestAppliedAt: new Date(),
        status: fresh.status === "ISSUED" || fresh.status === "PARTIALLY_PAID" ? "OVERDUE" : fresh.status,
        overdueAt: fresh.overdueAt ?? new Date(),
      },
    });

    await syncCardBillingSummary(tx, card.id);

    return { transactionId: cardTx.id };
  });

  const actor = await resolveActorUserId(actorUserId);
  await writeAuditLog({
    actorUserId: actor,
    action: "ALTA_CARD_INTEREST_APPLIED",
    entityType: "ALTA_CARD",
    entityId: statement.altaCardId,
    description: `Interest of ${interestAmount} applied to statement #${statement.statementNumber}`,
    metadata: {
      cardId: statement.altaCardId,
      statementId,
      interestAmount,
      actorUserId: actor,
    },
  });

  return { statementId, interestAmount, transactionId: result.transactionId };
}

export async function applyInterestForDueStatements(actorUserId?: string): Promise<{
  processed: number;
  applied: { statementId: string; interestAmount: number }[];
  skipped: { statementId: string; reason: string }[];
}> {
  const now = new Date();
  const candidates = await prisma.altaCardStatement.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lt: now },
      remainingBalance: { gt: 0 },
      interestAppliedAt: null,
    },
    orderBy: { statementNumber: "asc" },
  });

  const applied: { statementId: string; interestAmount: number }[] = [];
  const skipped: { statementId: string; reason: string }[] = [];

  for (const statement of candidates) {
    try {
      const result = await applyStatementInterest(statement.id, actorUserId);
      applied.push({ statementId: result.statementId, interestAmount: result.interestAmount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      skipped.push({ statementId: statement.id, reason: message });
    }
  }

  if (applied.length > 0) {
    const actor = await resolveActorUserId(actorUserId);
    await writeAuditLog({
      actorUserId: actor,
      action: "ALTA_CARD_INTEREST_BATCH_APPLIED",
      entityType: "ALTA_CARD",
      entityId: "batch",
      description: `Batch interest applied to ${applied.length} statement(s)`,
      metadata: {
        count: applied.length,
        applied,
        actorUserId: actor,
      },
    });
  }

  return { processed: candidates.length, applied, skipped };
}

export async function previewStatementInterestForAdmin(
  adminUserId: string,
  statementId: string,
): Promise<Awaited<ReturnType<typeof calculateStatementInterest>>> {
  const user = await getAltaUser(adminUserId);
  assertAdmin(user);
  return calculateStatementInterest(statementId);
}

export async function applyStatementInterestForAdmin(
  adminUserId: string,
  statementId: string,
): Promise<{ statementId: string; interestAmount: number; transactionId: string }> {
  const user = await getAltaUser(adminUserId);
  assertAdmin(user);
  return applyStatementInterest(statementId, adminUserId);
}

export async function applyInterestBatchForAdmin(
  adminUserId: string,
): Promise<Awaited<ReturnType<typeof applyInterestForDueStatements>>> {
  const user = await getAltaUser(adminUserId);
  assertAdmin(user);
  return applyInterestForDueStatements(adminUserId);
}

export async function listOverdueStatementsForCard(cardId: string) {
  const statements = await prisma.altaCardStatement.findMany({
    where: {
      altaCardId: cardId,
      status: "OVERDUE",
    },
    orderBy: { statementNumber: "asc" },
  });
  return statements;
}
