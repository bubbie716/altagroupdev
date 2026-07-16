import { Prisma, type TerminalCashAccount } from "@prisma/client";
import { prisma } from "@/server/db";
import { asDecimal, moneyAdd, moneyLt, moneySub } from "@/lib/ncc/ncc-money";
import type {
  AdapterCommitResult,
  AdapterCreditResult,
  AdapterPreparationResult,
  AdapterValidationResult,
  InstitutionAdapter,
  InstitutionAdapterCreditInput,
  InstitutionAdapterDebitInput,
  InstitutionAdapterKey,
} from "@/server/ncc/institution-adapter";

/** Marker prefix recorded when a settlement leg has no customer accountReference. */
const INSTITUTION_FLOAT_PREFIX = "institution-float";

async function resolveSettlementInstructionFk(instructionId: string | undefined): Promise<string | null> {
  if (!instructionId) return null;
  const found = await prisma.settlementInstruction.findUnique({
    where: { id: instructionId },
    select: { id: true },
  });
  return found?.id ?? null;
}

class AdapterOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdapterOperationError";
  }
}

/**
 * Alta Terminal adapter — real implementation against the shared Alta Terminal /
 * Exchange trading-cash ledger (TerminalCashAccount / TerminalCashEntry). This is
 * the single Alta trading-cash system of record; Alta Exchange settlement shares
 * it via institutionKey "alta-exchange" (see alta-exchange.adapter.ts).
 */
export class AltaTerminalInstitutionAdapter implements InstitutionAdapter {
  constructor(readonly institutionKey: InstitutionAdapterKey = "alta-terminal") {}

  async validateAccountReference(input: {
    accountReference: string;
  }): Promise<AdapterValidationResult> {
    const accountReference = input.accountReference?.trim();
    if (!accountReference) {
      return { ok: false, code: "INVALID_ACCOUNT_REF", reason: "Account reference required" };
    }
    const account = await prisma.terminalCashAccount.findUnique({ where: { id: accountReference } });
    if (!account) {
      return { ok: false, code: "ACCOUNT_NOT_FOUND", reason: "Terminal cash account not found" };
    }
    if (account.status !== "ACTIVE") {
      return { ok: false, code: "ACCOUNT_INACTIVE", reason: `Terminal cash account is ${account.status.toLowerCase()}` };
    }
    return { ok: true, accountReference: account.id };
  }

  async prepareDebit(input: InstitutionAdapterDebitInput): Promise<AdapterPreparationResult> {
    if (!input.accountReference) {
      return { ok: true, holdReference: `${INSTITUTION_FLOAT_PREFIX}:${input.settlementInstructionId}` };
    }
    const accountId = input.accountReference;
    const amount = asDecimal(input.amount);
    const idempotencyKey = `ncc-term-prep:${input.settlementInstructionId}`;

    const existingEntry = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
    if (existingEntry) {
      return { ok: true, holdReference: existingEntry.id };
    }

    const settlementInstructionId = await resolveSettlementInstructionFk(input.settlementInstructionId);
    try {
      const entry = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<TerminalCashAccount[]>`
          SELECT * FROM "TerminalCashAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Terminal cash account not found");
        if (account.status !== "ACTIVE") {
          throw new AdapterOperationError(
            "ACCOUNT_INACTIVE",
            `Terminal cash account is ${account.status.toLowerCase()}`,
          );
        }

        const available = asDecimal(account.availableBalance);
        if (moneyLt(available, amount)) {
          throw new AdapterOperationError("INSUFFICIENT_FUNDS", "Insufficient terminal cash available balance");
        }

        const nextAvailable = moneySub(available, amount);
        const nextReserved = moneyAdd(asDecimal(account.reservedBalance), amount);
        const ledger = asDecimal(account.ledgerBalance);

        await tx.terminalCashAccount.update({
          where: { id: account.id },
          data: { availableBalance: nextAvailable, reservedBalance: nextReserved },
        });

        return tx.terminalCashEntry.create({
          data: {
            terminalCashAccountId: account.id,
            entryType: "RESERVATION",
            amount,
            currency: input.currency,
            balanceBefore: ledger,
            balanceAfter: ledger,
            availableBefore: available,
            availableAfter: nextAvailable,
            settlementInstructionId,
            idempotencyKey,
          },
        });
      });
      return { ok: true, holdReference: entry.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
        if (race) return { ok: true, holdReference: race.id };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }

  async commitDebit(
    input: InstitutionAdapterDebitInput & { holdReference: string },
  ): Promise<AdapterCommitResult> {
    if (input.holdReference.startsWith(`${INSTITUTION_FLOAT_PREFIX}:`)) {
      return { ok: true, externalReference: `${INSTITUTION_FLOAT_PREFIX}-commit:${input.settlementInstructionId}` };
    }

    const idempotencyKey = `ncc-term-commit:${input.settlementInstructionId}`;
    const existing = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return { ok: true, externalReference: existing.id };
    }

    const settlementInstructionId = await resolveSettlementInstructionFk(input.settlementInstructionId);
    try {
      const entry = await prisma.$transaction(async (tx) => {
        const reservation = await tx.terminalCashEntry.findUnique({ where: { id: input.holdReference } });
        if (!reservation) throw new AdapterOperationError("RESERVATION_NOT_FOUND", "Reservation not found");

        const rows = await tx.$queryRaw<TerminalCashAccount[]>`
          SELECT * FROM "TerminalCashAccount" WHERE id = ${reservation.terminalCashAccountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Terminal cash account not found");

        const amount = asDecimal(reservation.amount);
        const ledger = asDecimal(account.ledgerBalance);
        const reserved = asDecimal(account.reservedBalance);
        const nextLedger = moneySub(ledger, amount);
        const nextReserved = moneySub(reserved, amount);
        if (moneyLt(nextLedger, asDecimal(0)) || moneyLt(nextReserved, asDecimal(0))) {
          throw new AdapterOperationError("NEGATIVE_BALANCE_DENIED", "Commit would overdraw terminal cash account");
        }

        await tx.terminalCashAccount.update({
          where: { id: account.id },
          data: { ledgerBalance: nextLedger, reservedBalance: nextReserved },
        });

        return tx.terminalCashEntry.create({
          data: {
            terminalCashAccountId: account.id,
            entryType: "WITHDRAWAL_DEBIT",
            amount,
            currency: reservation.currency,
            balanceBefore: ledger,
            balanceAfter: nextLedger,
            availableBefore: asDecimal(account.availableBalance),
            availableAfter: asDecimal(account.availableBalance),
            settlementInstructionId,
            idempotencyKey,
          },
        });
      });
      return { ok: true, externalReference: entry.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
        if (race) return { ok: true, externalReference: race.id };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }

  async releaseDebit(input: { holdReference: string; settlementInstructionId: string }): Promise<void> {
    if (input.holdReference.startsWith(`${INSTITUTION_FLOAT_PREFIX}:`)) return;

    const idempotencyKey = `ncc-term-release:${input.settlementInstructionId}`;
    const existing = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
    if (existing) return;

    const settlementInstructionId = await resolveSettlementInstructionFk(input.settlementInstructionId);
    try {
      await prisma.$transaction(async (tx) => {
        const reservation = await tx.terminalCashEntry.findUnique({ where: { id: input.holdReference } });
        if (!reservation) return;

        const rows = await tx.$queryRaw<TerminalCashAccount[]>`
          SELECT * FROM "TerminalCashAccount" WHERE id = ${reservation.terminalCashAccountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) return;

        const amount = asDecimal(reservation.amount);
        const ledger = asDecimal(account.ledgerBalance);
        const available = asDecimal(account.availableBalance);
        const nextAvailable = moneyAdd(available, amount);
        const nextReserved = moneySub(asDecimal(account.reservedBalance), amount);

        await tx.terminalCashAccount.update({
          where: { id: account.id },
          data: { availableBalance: nextAvailable, reservedBalance: nextReserved },
        });

        await tx.terminalCashEntry.create({
          data: {
            terminalCashAccountId: account.id,
            entryType: "RESERVATION_RELEASE",
            amount,
            currency: reservation.currency,
            balanceBefore: ledger,
            balanceAfter: ledger,
            availableBefore: available,
            availableAfter: nextAvailable,
            settlementInstructionId,
            idempotencyKey,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }

  async compensateDebit(input: InstitutionAdapterDebitInput): Promise<AdapterCommitResult> {
    if (!input.accountReference) {
      return {
        ok: true,
        externalReference: `${INSTITUTION_FLOAT_PREFIX}-compensate:${input.settlementInstructionId}`,
      };
    }

    const accountId = input.accountReference;
    const idempotencyKey = `ncc-term-compensate:${input.settlementInstructionId}`;
    const existing = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return { ok: true, externalReference: existing.id };
    }

    const amount = asDecimal(input.amount);
    const settlementInstructionId = await resolveSettlementInstructionFk(input.settlementInstructionId);
    try {
      const entry = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<TerminalCashAccount[]>`
          SELECT * FROM "TerminalCashAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Terminal cash account not found");

        const ledger = asDecimal(account.ledgerBalance);
        const available = asDecimal(account.availableBalance);
        const nextLedger = moneyAdd(ledger, amount);
        const nextAvailable = moneyAdd(available, amount);

        await tx.terminalCashAccount.update({
          where: { id: account.id },
          data: { ledgerBalance: nextLedger, availableBalance: nextAvailable },
        });

        return tx.terminalCashEntry.create({
          data: {
            terminalCashAccountId: account.id,
            entryType: "REVERSAL_CREDIT",
            amount,
            currency: input.currency,
            balanceBefore: ledger,
            balanceAfter: nextLedger,
            availableBefore: available,
            availableAfter: nextAvailable,
            settlementInstructionId,
            idempotencyKey,
          },
        });
      });
      return { ok: true, externalReference: entry.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
        if (race) return { ok: true, externalReference: race.id };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }

  async notifyCredit(input: InstitutionAdapterCreditInput): Promise<AdapterCreditResult> {
    if (!input.accountReference) {
      return {
        ok: true,
        credited: true,
        externalReference: `${INSTITUTION_FLOAT_PREFIX}-credit:${input.settlementInstructionId}`,
      };
    }

    const accountId = input.accountReference;
    const idempotencyKey = `ncc-term-credit:${input.settlementInstructionId}`;
    const existing = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return { ok: true, credited: true, externalReference: existing.id };
    }

    const amount = asDecimal(input.amount);
    const settlementInstructionId = await resolveSettlementInstructionFk(input.settlementInstructionId);
    try {
      const entry = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<TerminalCashAccount[]>`
          SELECT * FROM "TerminalCashAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Terminal cash account not found");
        if (account.status !== "ACTIVE") {
          throw new AdapterOperationError(
            "ACCOUNT_INACTIVE",
            `Terminal cash account is ${account.status.toLowerCase()}`,
          );
        }

        const ledger = asDecimal(account.ledgerBalance);
        const available = asDecimal(account.availableBalance);
        const nextLedger = moneyAdd(ledger, amount);
        const nextAvailable = moneyAdd(available, amount);

        await tx.terminalCashAccount.update({
          where: { id: account.id },
          data: { ledgerBalance: nextLedger, availableBalance: nextAvailable },
        });

        return tx.terminalCashEntry.create({
          data: {
            terminalCashAccountId: account.id,
            entryType: "FUNDING_CREDIT",
            amount,
            currency: input.currency,
            balanceBefore: ledger,
            balanceAfter: nextLedger,
            availableBefore: available,
            availableAfter: nextAvailable,
            settlementInstructionId,
            idempotencyKey,
          },
        });
      });
      return { ok: true, credited: true, externalReference: entry.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.terminalCashEntry.findUnique({ where: { idempotencyKey } });
        if (race) return { ok: true, credited: true, externalReference: race.id };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }
}
