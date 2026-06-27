import { randomBytes } from "node:crypto";
import type { AltaCardFeeStatus, AltaCardFeeType, Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { isAdmin } from "@/lib/auth/permissions";
import type { AltaCardFeeRow, AltaCardFeeStatusCode, AltaCardFeeTypeCode } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_LATE_FEE_AMOUNT } from "@/lib/bank/alta-card-fee-config";
import { roundMoney } from "@/lib/bank/alta-card-minimum-payment";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { syncCardBillingSummary } from "@/server/alta-card-statement.service";
import { applyChargeInTx } from "@/server/alta-card-transaction.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

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

export function toAltaCardFeeTypeCode(value: AltaCardFeeType): AltaCardFeeTypeCode {
  return value.toLowerCase() as AltaCardFeeTypeCode;
}

export function toAltaCardFeeStatusCode(value: AltaCardFeeStatus): AltaCardFeeStatusCode {
  return value.toLowerCase() as AltaCardFeeStatusCode;
}

export function mapAltaCardFeeRow(
  row: Prisma.AltaCardFeeGetPayload<{ include?: { waivedBy?: { select: { discordUsername: true } } } }>,
): AltaCardFeeRow {
  return {
    id: row.id,
    altaCardId: row.altaCardId,
    statementId: row.altaCardStatementId,
    transactionId: row.altaCardTransactionId,
    type: toAltaCardFeeTypeCode(row.type),
    amount: decimalToNumber(row.amount),
    status: toAltaCardFeeStatusCode(row.status),
    reason: row.reason,
    waivedByUserId: row.waivedByUserId,
    waivedAt: row.waivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function hasLateFeeForStatement(statementId: string): Promise<boolean> {
  const existing = await prisma.altaCardFee.findFirst({
    where: {
      altaCardStatementId: statementId,
      type: "LATE_PAYMENT",
      status: { in: ["ACTIVE", "PAID"] },
    },
  });
  return existing != null;
}

export async function applyLateFeeForStatement(
  statementId: string,
  actorUserId?: string,
  feeAmount = ALTA_CARD_LATE_FEE_AMOUNT,
): Promise<{ feeId: string; transactionId: string; amount: number } | null> {
  if (feeAmount <= 0) return null;

  const statement = await prisma.altaCardStatement.findUnique({
    where: { id: statementId },
    include: { altaCard: true },
  });
  if (!statement) notFound();

  const now = new Date();
  if (statement.dueDate >= now) badRequest("Statement is not past due");
  if (decimalToNumber(statement.remainingBalance) <= 0) badRequest("Statement has no remaining balance");
  if (await hasLateFeeForStatement(statementId)) badRequest("Late fee already charged for this statement");

  const referenceCode = generateCardTxReference("FEE");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.altaCardFee.findFirst({
      where: {
        altaCardStatementId: statementId,
        type: "LATE_PAYMENT",
        status: { in: ["ACTIVE", "PAID"] },
      },
    });
    if (existing) badRequest("Late fee already charged for this statement");

    const fresh = await tx.altaCardStatement.findUnique({
      where: { id: statementId },
      include: { altaCard: true },
    });
    if (!fresh) notFound();

    const card = fresh.altaCard;
    await applyChargeInTx(tx, card, feeAmount, null, true);

    const cardTx = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        altaCardStatementId: fresh.id,
        type: "FEE",
        status: "COMPLETED",
        amount: toDecimal(feeAmount),
        description: `Late payment fee — statement #${fresh.statementNumber}`,
        referenceCode,
        createdByUserId: actorUserId ?? null,
        settledAt: new Date(),
        metadata: { feeType: "late_payment", statementNumber: fresh.statementNumber },
      },
    });

    const fee = await tx.altaCardFee.create({
      data: {
        altaCardId: card.id,
        altaCardStatementId: fresh.id,
        altaCardTransactionId: cardTx.id,
        type: "LATE_PAYMENT",
        amount: toDecimal(feeAmount),
        status: "ACTIVE",
        reason: "Late payment",
      },
    });

    const newFeesCharged = roundMoney(decimalToNumber(fresh.feesCharged) + feeAmount);
    const newStatementBalance = roundMoney(decimalToNumber(fresh.statementBalance) + feeAmount);
    const newRemaining = roundMoney(decimalToNumber(fresh.remainingBalance) + feeAmount);

    await tx.altaCardStatement.update({
      where: { id: fresh.id },
      data: {
        feesCharged: toDecimal(newFeesCharged),
        statementBalance: toDecimal(newStatementBalance),
        remainingBalance: toDecimal(newRemaining),
        status: "OVERDUE",
        overdueAt: fresh.overdueAt ?? now,
      },
    });

    await syncCardBillingSummary(tx, card.id);

    return { feeId: fee.id, transactionId: cardTx.id };
  });

  const actor = await resolveActorUserId(actorUserId);
  await writeAuditLog({
    actorUserId: actor,
    action: "ALTA_CARD_FEE_CHARGED",
    entityType: "ALTA_CARD",
    entityId: statement.altaCardId,
    description: `Late fee of ${feeAmount} charged on statement #${statement.statementNumber}`,
    metadata: {
      cardId: statement.altaCardId,
      statementId,
      feeAmount,
      feeType: "late_payment",
      actorUserId: actor,
    },
  });

  return { feeId: result.feeId, transactionId: result.transactionId, amount: feeAmount };
}

export async function applyLateFeesForDueStatements(actorUserId?: string): Promise<{
  processed: number;
  charged: { statementId: string; amount: number }[];
  skipped: { statementId: string; reason: string }[];
}> {
  const now = new Date();
  const candidates = await prisma.altaCardStatement.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lt: now },
      remainingBalance: { gt: 0 },
    },
    orderBy: { statementNumber: "asc" },
  });

  const charged: { statementId: string; amount: number }[] = [];
  const skipped: { statementId: string; reason: string }[] = [];

  for (const statement of candidates) {
    try {
      const result = await applyLateFeeForStatement(statement.id, actorUserId);
      if (result) {
        charged.push({ statementId: statement.id, amount: result.amount });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      skipped.push({ statementId: statement.id, reason: message });
    }
  }

  return { processed: candidates.length, charged, skipped };
}

export async function waiveAltaCardFee(
  adminUserId: string,
  feeId: string,
  reason?: string,
): Promise<AltaCardFeeRow> {
  const admin = await getAltaUser(adminUserId);
  assertAdmin(admin);

  const fee = await prisma.altaCardFee.findUnique({
    where: { id: feeId },
    include: { statement: true, transaction: true },
  });
  if (!fee) notFound();
  if (fee.status === "WAIVED") badRequest("Fee is already waived");
  if (fee.status === "PAID") badRequest("Cannot waive a paid fee");

  const feeAmount = decimalToNumber(fee.amount);
  const referenceCode = generateCardTxReference("ADJ");

  const updated = await prisma.$transaction(async (tx) => {
    const freshFee = await tx.altaCardFee.findUnique({ where: { id: feeId } });
    if (!freshFee || freshFee.status !== "ACTIVE") badRequest("Fee is not active");

    const card = await tx.altaCard.findUnique({ where: { id: freshFee.altaCardId } });
    if (!card) notFound();

    const creditLimit = decimalToNumber(card.creditLimit);
    const currentBalance = decimalToNumber(card.currentBalance);
    const newBalance = roundMoney(Math.max(0, currentBalance - feeAmount));
    const newAvailable = roundMoney(Math.max(0, creditLimit - newBalance));

    await tx.altaCard.update({
      where: { id: card.id },
      data: {
        currentBalance: toDecimal(newBalance),
        availableCredit: toDecimal(newAvailable),
      },
    });

    await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        altaCardStatementId: freshFee.altaCardStatementId,
        type: "ADJUSTMENT_CREDIT",
        status: "COMPLETED",
        amount: toDecimal(feeAmount),
        description: `Fee waiver — ${freshFee.type.replace(/_/g, " ").toLowerCase()}`,
        referenceCode,
        createdByUserId: adminUserId,
        settledAt: new Date(),
        metadata: { waivedFeeId: feeId, reason: reason ?? null },
      },
    });

    if (freshFee.altaCardStatementId) {
      const statement = await tx.altaCardStatement.findUnique({
        where: { id: freshFee.altaCardStatementId },
      });
      if (statement) {
        const newFeesCharged = roundMoney(decimalToNumber(statement.feesCharged) - feeAmount);
        const newStatementBalance = roundMoney(decimalToNumber(statement.statementBalance) - feeAmount);
        const newRemaining = roundMoney(decimalToNumber(statement.remainingBalance) - feeAmount);
        const newFeesPaid = roundMoney(Math.max(0, decimalToNumber(statement.feesPaid) - feeAmount));

        await tx.altaCardStatement.update({
          where: { id: statement.id },
          data: {
            feesCharged: toDecimal(Math.max(0, newFeesCharged)),
            statementBalance: toDecimal(Math.max(0, newStatementBalance)),
            remainingBalance: toDecimal(Math.max(0, newRemaining)),
            feesPaid: toDecimal(newFeesPaid),
          },
        });
      }
    }

    const waived = await tx.altaCardFee.update({
      where: { id: feeId },
      data: {
        status: "WAIVED",
        waivedByUserId: adminUserId,
        waivedAt: new Date(),
        reason: reason ?? fee.reason,
      },
    });

    await syncCardBillingSummary(tx, card.id);
    return waived;
  });

  await writeAuditLog({
    actorUserId: adminUserId,
    action: "ALTA_CARD_FEE_WAIVED",
    entityType: "ALTA_CARD",
    entityId: fee.altaCardId,
    description: `Fee of ${feeAmount} waived`,
    metadata: {
      cardId: fee.altaCardId,
      statementId: fee.altaCardStatementId,
      feeAmount,
      feeId,
      actorUserId: adminUserId,
    },
  });

  return mapAltaCardFeeRow(updated);
}

export async function listCardFees(
  userId: string,
  cardId: string,
): Promise<AltaCardFeeRow[]> {
  const { assertCardAccess } = await import("@/server/alta-card.service");
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  await assertCardAccess(userId, card);

  const fees = await prisma.altaCardFee.findMany({
    where: { altaCardId: cardId },
    orderBy: { createdAt: "desc" },
  });
  return fees.map(mapAltaCardFeeRow);
}

export async function listInternalCardFees(cardId: string): Promise<AltaCardFeeRow[]> {
  const fees = await prisma.altaCardFee.findMany({
    where: { altaCardId: cardId },
    orderBy: { createdAt: "desc" },
  });
  return fees.map(mapAltaCardFeeRow);
}

export async function getActiveFeesTotal(cardId: string): Promise<number> {
  const fees = await prisma.altaCardFee.findMany({
    where: { altaCardId: cardId, status: "ACTIVE" },
  });
  return roundMoney(fees.reduce((sum, f) => sum + decimalToNumber(f.amount), 0));
}

export async function markOverdueStatements(): Promise<{ marked: string[] }> {
  const now = new Date();
  const candidates = await prisma.altaCardStatement.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
      remainingBalance: { gt: 0 },
    },
  });

  const marked: string[] = [];
  for (const statement of candidates) {
    await prisma.altaCardStatement.update({
      where: { id: statement.id },
      data: {
        status: "OVERDUE",
        overdueAt: statement.overdueAt ?? now,
      },
    });
    marked.push(statement.id);
  }

  return { marked };
}

export async function applyManualFeeForCard(
  adminUserId: string,
  cardId: string,
  feeAmount: number,
  reason: string,
): Promise<{ feeId: string; transactionId: string }> {
  const admin = await getAltaUser(adminUserId);
  assertAdmin(admin);
  if (feeAmount <= 0) badRequest("Fee amount must be greater than zero");
  if (!reason.trim()) badRequest("Reason is required");

  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();

  const referenceCode = generateCardTxReference("FEE");

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.altaCard.findUnique({ where: { id: cardId } });
    if (!fresh) notFound();

    await applyChargeInTx(tx, fresh, feeAmount, null, true);

    const cardTx = await tx.altaCardTransaction.create({
      data: {
        altaCardId: cardId,
        type: "FEE",
        status: "COMPLETED",
        amount: toDecimal(feeAmount),
        description: `Manual fee — ${reason.trim()}`,
        referenceCode,
        createdByUserId: adminUserId,
        settledAt: new Date(),
        metadata: { feeType: "manual", reason: reason.trim() },
      },
    });

    const fee = await tx.altaCardFee.create({
      data: {
        altaCardId: cardId,
        altaCardTransactionId: cardTx.id,
        type: "MANUAL",
        amount: toDecimal(feeAmount),
        status: "ACTIVE",
        reason: reason.trim(),
      },
    });

    await syncCardBillingSummary(tx, cardId);
    return { feeId: fee.id, transactionId: cardTx.id };
  });

  await writeAuditLog({
    actorUserId: adminUserId,
    action: "ALTA_CARD_FEE_CHARGED",
    entityType: "ALTA_CARD",
    entityId: cardId,
    description: `Manual fee of ${feeAmount} applied`,
    metadata: {
      cardId,
      feeAmount,
      feeType: "manual",
      reason: reason.trim(),
      actorUserId: adminUserId,
    },
  });

  return result;
}
