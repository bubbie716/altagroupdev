import { Prisma, type SettlementInstruction } from "@prisma/client";
import { prisma } from "@/server/db";
import { asDecimal, moneyAdd, moneyEq, moneyLt, moneySub } from "@/lib/ncc/ncc-money";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";

/**
 * NCC ledger-level error. Codes are stable and used by callers (settlement
 * service, execution orchestrator) to decide retryability.
 */
export class NccSettlementError extends Error {
  constructor(
    message: string,
    readonly code: string = message,
  ) {
    super(message);
    this.name = "NccSettlementError";
  }
}

export type PostNccLedgerResult = {
  instruction: SettlementInstruction;
  /** True when the entries/status were already posted — this call was a no-op. */
  alreadySettled: boolean;
};

const SETTLEABLE_STATUSES = new Set<string>(["SUBMITTED", "VALIDATING", "QUEUED", "SETTLING"]);

/**
 * Posts the NCC settlement ledger entries (debit sending settlement account /
 * credit receiving settlement account) and marks the instruction SETTLED.
 *
 * This is NCC ledger finality ONLY — it never touches institution customer
 * ledgers (BankAccount, TerminalCashAccount). Those are handled separately by
 * institution adapters, orchestrated by SettlementExecution. This function must
 * not call adapters.
 *
 * Idempotent: safe to call repeatedly for the same instruction once settled.
 * Enqueues settlement.ncc_posted inside the same transaction on first post.
 */
export async function postNccLedgerEntries(instructionId: string): Promise<PostNccLedgerResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<SettlementInstruction[]>`
      SELECT * FROM "SettlementInstruction" WHERE id = ${instructionId} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");

    const existingEntryCount = await tx.settlementEntry.count({
      where: { settlementInstructionId: row.id },
    });
    if (existingEntryCount >= 2) {
      const finalized =
        row.status === "SETTLED"
          ? row
          : await tx.settlementInstruction.update({
              where: { id: row.id },
              data: { status: "SETTLED", settledAt: row.settledAt ?? new Date() },
            });
      // Do not re-enqueue inside this transaction: a P2002 on dedupeKey would abort
      // the Postgres transaction. The original post already wrote settlement.ncc_posted.
      return { instruction: finalized, alreadySettled: true };
    }

    if (row.status === "REVERSED") {
      return { instruction: row, alreadySettled: true };
    }
    if (row.status === "FAILED" || row.status === "CANCELLED") {
      throw new NccSettlementError("INSTRUCTION_NOT_SETTLEABLE", "INSTRUCTION_NOT_SETTLEABLE");
    }
    if (!SETTLEABLE_STATUSES.has(row.status)) {
      throw new NccSettlementError("INSTRUCTION_NOT_SETTLEABLE", "INSTRUCTION_NOT_SETTLEABLE");
    }

    if (row.status !== "SETTLING") {
      await tx.settlementInstruction.update({
        where: { id: instructionId },
        data: { status: "SETTLING" },
      });
    }

    const sendAccounts = await tx.$queryRaw<
      { id: string; ledgerBalance: Prisma.Decimal; availableBalance: Prisma.Decimal; status: string }[]
    >`
      SELECT id, "ledgerBalance", "availableBalance", status
      FROM "SettlementAccount"
      WHERE "institutionId" = ${row.sendingInstitutionId} AND currency = ${row.currency}
      FOR UPDATE
    `;
    const recvAccounts = await tx.$queryRaw<
      { id: string; ledgerBalance: Prisma.Decimal; availableBalance: Prisma.Decimal; status: string }[]
    >`
      SELECT id, "ledgerBalance", "availableBalance", status
      FROM "SettlementAccount"
      WHERE "institutionId" = ${row.receivingInstitutionId} AND currency = ${row.currency}
      FOR UPDATE
    `;

    const sendAccount = sendAccounts[0];
    const recvAccount = recvAccounts[0];
    if (!sendAccount || sendAccount.status !== "ACTIVE") {
      throw new NccSettlementError("SENDER_ACCOUNT_UNAVAILABLE", "SENDER_ACCOUNT_UNAVAILABLE");
    }
    if (!recvAccount || recvAccount.status !== "ACTIVE") {
      throw new NccSettlementError("RECEIVER_ACCOUNT_UNAVAILABLE", "RECEIVER_ACCOUNT_UNAVAILABLE");
    }

    const amount = asDecimal(row.amount);
    const sendAvailable = asDecimal(sendAccount.availableBalance);
    if (moneyLt(sendAvailable, amount)) {
      throw new NccSettlementError("INSUFFICIENT_FUNDS", "INSUFFICIENT_FUNDS");
    }

    const sendBefore = asDecimal(sendAccount.ledgerBalance);
    const recvBefore = asDecimal(recvAccount.ledgerBalance);
    const sendAfter = moneySub(sendBefore, amount);
    const recvAfter = moneyAdd(recvBefore, amount);
    if (moneyLt(sendAfter, asDecimal(0))) {
      throw new NccSettlementError("NEGATIVE_BALANCE_DENIED", "NEGATIVE_BALANCE_DENIED");
    }

    await tx.settlementAccount.update({
      where: { id: sendAccount.id },
      data: {
        ledgerBalance: sendAfter,
        availableBalance: moneySub(sendAvailable, amount),
      },
    });
    await tx.settlementAccount.update({
      where: { id: recvAccount.id },
      data: {
        ledgerBalance: recvAfter,
        availableBalance: moneyAdd(asDecimal(recvAccount.availableBalance), amount),
      },
    });

    await tx.settlementEntry.createMany({
      data: [
        {
          settlementInstructionId: row.id,
          settlementAccountId: sendAccount.id,
          institutionId: row.sendingInstitutionId,
          entryType: "DEBIT",
          amount: row.amount,
          currency: row.currency,
          balanceBefore: sendBefore,
          balanceAfter: sendAfter,
        },
        {
          settlementInstructionId: row.id,
          settlementAccountId: recvAccount.id,
          institutionId: row.receivingInstitutionId,
          entryType: "CREDIT",
          amount: row.amount,
          currency: row.currency,
          balanceBefore: recvBefore,
          balanceAfter: recvAfter,
        },
      ],
    });

    const entries = await tx.settlementEntry.findMany({
      where: { settlementInstructionId: row.id },
    });
    const debitTotal = entries
      .filter((e) => e.entryType === "DEBIT" || e.entryType === "REVERSAL_DEBIT")
      .reduce((sum, e) => moneyAdd(sum, asDecimal(e.amount)), asDecimal(0));
    const creditTotal = entries
      .filter((e) => e.entryType === "CREDIT" || e.entryType === "REVERSAL_CREDIT")
      .reduce((sum, e) => moneyAdd(sum, asDecimal(e.amount)), asDecimal(0));
    if (!moneyEq(debitTotal, creditTotal)) {
      throw new NccSettlementError("LEDGER_IMBALANCE", "LEDGER_IMBALANCE");
    }

    const updated = await tx.settlementInstruction.update({
      where: { id: row.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });

    await enqueueOutboxEvent(
      {
        settlementInstructionId: updated.id,
        eventType: NCC_OUTBOX_EVENTS.NCC_POSTED,
        dedupeKey: `settlement.ncc_posted:${updated.id}`,
        payload: {
          alreadySettled: false,
          settledAt: updated.settledAt?.toISOString() ?? null,
          amount: updated.amount.toString(),
          currency: updated.currency,
        },
      },
      tx,
    );

    return { instruction: updated, alreadySettled: false };
  });
}
