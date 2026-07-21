import { Prisma, type BankAccount } from "@prisma/client";
import { prisma } from "@/server/db";
import { isValidAltaAccountNumber } from "@/lib/bank/account-number";
import {
  isLikelyInternalDatabaseId,
  maskPaymentAccountNumber,
  normalizeAltaBankAccountIdentifier,
} from "@/lib/ncc/ncc-account-number";
import { asDecimal, moneyAdd, moneyLt, moneySub, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import type {
  AdapterCommitResult,
  AdapterCreditResult,
  AdapterPreparationResult,
  AdapterResolveResult,
  AdapterValidationResult,
  InstitutionAdapter,
  InstitutionAdapterCreditInput,
  InstitutionAdapterDebitInput,
} from "@/server/ncc/institution-adapter";

const RESOLVER_KEY = "alta-bank@1";

/** Marker prefix recorded when a settlement leg has no customer accountReference. */
const INSTITUTION_FLOAT_PREFIX = "institution-float";

class AdapterOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdapterOperationError";
  }
}

function debitHoldReason(publicReference: string): string {
  return `Transfer to Alta Terminal · ${publicReference}`;
}

function creditDescription(publicReference: string): string {
  return `Transfer from Alta Terminal · ${publicReference}`;
}

/**
 * Alta Bank adapter — real implementation against BankAccount / BankAccountHold /
 * BankTransaction. NCC never mutates these tables directly outside this adapter.
 */
export class AltaBankInstitutionAdapter implements InstitutionAdapter {
  institutionKey = "alta-bank" as const;

  async resolveAccount(input: {
    accountNumber: string;
    currency: string;
    direction: "debit" | "credit";
  }): Promise<AdapterResolveResult> {
    // Alta Bank policy: AB- prefix is case-insensitive. NCC does not apply this rule.
    const normalized = normalizeAltaBankAccountIdentifier(input.accountNumber);
    if (!normalized || isLikelyInternalDatabaseId(normalized) || !isValidAltaAccountNumber(normalized)) {
      return { ok: false, code: "INVALID_PAYMENT_ADDRESS", reason: "Invalid payment address" };
    }
    const currency = input.currency.toUpperCase();
    if (currency !== NCC_DEFAULT_CURRENCY) {
      return { ok: false, code: "UNSUPPORTED_CURRENCY", reason: "Unsupported currency" };
    }

    const account = await prisma.bankAccount.findUnique({ where: { accountNumber: normalized } });
    // Uniform unavailable surface — do not disclose existence.
    if (!account || account.status !== "ACTIVE" || account.currency !== currency) {
      return { ok: false, code: "ACCOUNT_UNAVAILABLE", reason: "Account unavailable" };
    }

    const debitEligible = !account.restrictWithdrawals;
    const creditEligible = !account.restrictDeposits;
    if (input.direction === "debit" && !debitEligible) {
      return { ok: false, code: "ACCOUNT_NOT_DEBITABLE", reason: "Account not eligible for debit" };
    }
    if (input.direction === "credit" && !creditEligible) {
      return { ok: false, code: "ACCOUNT_NOT_CREDITABLE", reason: "Account not eligible for credit" };
    }

    return {
      ok: true,
      account: {
        internalAccountReference: account.id,
        canonicalAccountNumber: account.accountNumber,
        maskedAccountNumber: maskPaymentAccountNumber(account.accountNumber),
        currency: account.currency,
        status: account.status,
        debitEligible,
        creditEligible,
        beneficiaryLabel: account.accountName,
        resolvedAt: new Date().toISOString(),
        resolverKey: RESOLVER_KEY,
      },
    };
  }

  /** Validates an opaque internal BankAccount.id already resolved for execution. */
  async validateAccountReference(input: {
    accountReference: string;
  }): Promise<AdapterValidationResult> {
    const accountReference = input.accountReference?.trim();
    if (!accountReference) {
      return { ok: false, code: "INVALID_ACCOUNT_REF", reason: "Account reference required" };
    }
    const account = await prisma.bankAccount.findUnique({ where: { id: accountReference } });
    if (!account) {
      return { ok: false, code: "ACCOUNT_UNAVAILABLE", reason: "Account unavailable" };
    }
    if (account.status !== "ACTIVE") {
      return { ok: false, code: "ACCOUNT_UNAVAILABLE", reason: "Account unavailable" };
    }
    if (account.currency !== NCC_DEFAULT_CURRENCY) {
      return { ok: false, code: "UNSUPPORTED_CURRENCY", reason: "Unsupported currency" };
    }
    return { ok: true, accountReference: account.id };
  }

  async prepareDebit(input: InstitutionAdapterDebitInput): Promise<AdapterPreparationResult> {
    if (!input.accountReference) {
      return { ok: true, holdReference: `${INSTITUTION_FLOAT_PREFIX}:${input.settlementInstructionId}` };
    }
    const accountId = input.accountReference;
    const amount = asDecimal(input.amount);
    const nccOperationKey = `ncc-prep:${input.settlementInstructionId}:${accountId}`;

    const existingHold = await prisma.bankAccountHold.findUnique({ where: { nccOperationKey } });
    if (existingHold) {
      return { ok: true, holdReference: existingHold.id };
    }

    try {
      const hold = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<BankAccount[]>`
          SELECT * FROM "BankAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Bank account not found");
        if (account.status !== "ACTIVE") {
          throw new AdapterOperationError("ACCOUNT_INACTIVE", `Bank account is ${account.status.toLowerCase()}`);
        }
        if (account.restrictWithdrawals) {
          throw new AdapterOperationError("ACCOUNT_RESTRICTED", "Withdrawals are restricted on this account");
        }

        const [holdTotal, pendingTotal] = await Promise.all([
          tx.bankAccountHold.aggregate({
            where: { bankAccountId: accountId, status: "ACTIVE" },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: accountId, type: "WITHDRAWAL", status: "PENDING" },
            _sum: { amount: true },
          }),
        ]);

        const balance = asDecimal(account.balance);
        const holds = holdTotal._sum.amount ? asDecimal(holdTotal._sum.amount) : asDecimal(0);
        const pending = pendingTotal._sum.amount ? asDecimal(pendingTotal._sum.amount) : asDecimal(0);
        const available = moneySub(moneySub(balance, holds), pending);
        if (moneyLt(available, amount)) {
          throw new AdapterOperationError("INSUFFICIENT_FUNDS", "Insufficient available balance");
        }

        const actorUserId = input.actorUserId ?? account.userId;
        return tx.bankAccountHold.create({
          data: {
            bankAccountId: accountId,
            amount,
            reason: debitHoldReason(input.publicReference),
            createdById: actorUserId,
            nccOperationKey,
            settlementInstructionId: input.settlementInstructionId,
          },
        });
      });
      return { ok: true, holdReference: hold.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.bankAccountHold.findUnique({ where: { nccOperationKey } });
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

    const referenceCode = `NCC-DBT-${input.settlementInstructionId}`;
    const existingTx = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
    if (existingTx) {
      return { ok: true, externalReference: existingTx.referenceCode };
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const hold = await tx.bankAccountHold.findUnique({ where: { id: input.holdReference } });
        if (!hold) throw new AdapterOperationError("HOLD_NOT_FOUND", "Debit hold not found");
        if (hold.status === "RELEASED") {
          // Hold already released — only valid if it was released by a prior successful commit.
          const priorCommit = await tx.bankTransaction.findUnique({ where: { referenceCode } });
          if (priorCommit) return priorCommit;
          throw new AdapterOperationError(
            "HOLD_ALREADY_RELEASED",
            "Debit hold was already released without a matching commit",
          );
        }

        const rows = await tx.$queryRaw<BankAccount[]>`
          SELECT * FROM "BankAccount" WHERE id = ${hold.bankAccountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Bank account not found");

        const amount = asDecimal(hold.amount);
        const nextBalance = moneySub(asDecimal(account.balance), amount);
        if (moneyLt(nextBalance, asDecimal(0))) {
          throw new AdapterOperationError("NEGATIVE_BALANCE_DENIED", "Debit would overdraw account");
        }

        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balance: nextBalance },
        });

        const transaction = await tx.bankTransaction.create({
          data: {
            bankAccountId: account.id,
            type: "WITHDRAWAL",
            amount,
            status: "APPROVED",
            description: debitHoldReason(input.publicReference),
            referenceCode,
          },
        });

        await tx.bankAccountHold.update({
          where: { id: hold.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releasedById: input.actorUserId ?? hold.createdById,
          },
        });

        return transaction;
      });
      return { ok: true, externalReference: created.referenceCode };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
        if (race) return { ok: true, externalReference: race.referenceCode };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }

  async releaseDebit(input: { holdReference: string; settlementInstructionId: string }): Promise<void> {
    if (input.holdReference.startsWith(`${INSTITUTION_FLOAT_PREFIX}:`)) return;
    await prisma.bankAccountHold.updateMany({
      where: { id: input.holdReference, status: "ACTIVE" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
  }

  async compensateDebit(input: InstitutionAdapterDebitInput): Promise<AdapterCommitResult> {
    if (!input.accountReference) {
      return {
        ok: true,
        externalReference: `${INSTITUTION_FLOAT_PREFIX}-compensate:${input.settlementInstructionId}`,
      };
    }

    const accountId = input.accountReference;
    const referenceCode = `NCC-CMP-${input.settlementInstructionId}`;
    const existing = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
    if (existing) {
      return { ok: true, externalReference: existing.referenceCode };
    }

    const amount = asDecimal(input.amount);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<BankAccount[]>`
          SELECT * FROM "BankAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Bank account not found");

        const nextBalance = moneyAdd(asDecimal(account.balance), amount);
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balance: nextBalance },
        });

        return tx.bankTransaction.create({
          data: {
            bankAccountId: account.id,
            type: "DEPOSIT",
            amount,
            status: "APPROVED",
            description: `NCC compensation restore ${input.publicReference}`,
            referenceCode,
          },
        });
      });
      return { ok: true, externalReference: created.referenceCode };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
        if (race) return { ok: true, externalReference: race.referenceCode };
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
    const referenceCode = `NCC-CDT-${input.settlementInstructionId}`;
    const existing = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
    if (existing) {
      return { ok: true, credited: true, externalReference: existing.referenceCode };
    }

    const amount = asDecimal(input.amount);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<BankAccount[]>`
          SELECT * FROM "BankAccount" WHERE id = ${accountId} FOR UPDATE
        `;
        const account = rows[0];
        if (!account) throw new AdapterOperationError("ACCOUNT_NOT_FOUND", "Bank account not found");
        if (account.status !== "ACTIVE") {
          throw new AdapterOperationError("ACCOUNT_INACTIVE", `Bank account is ${account.status.toLowerCase()}`);
        }
        if (account.restrictDeposits) {
          throw new AdapterOperationError("ACCOUNT_RESTRICTED", "Deposits are restricted on this account");
        }

        const nextBalance = moneyAdd(asDecimal(account.balance), amount);
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balance: nextBalance },
        });

        return tx.bankTransaction.create({
          data: {
            bankAccountId: account.id,
            type: "DEPOSIT",
            amount,
            status: "APPROVED",
            description: creditDescription(input.publicReference),
            referenceCode,
          },
        });
      });
      return { ok: true, credited: true, externalReference: created.referenceCode };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const race = await prisma.bankTransaction.findUnique({ where: { referenceCode } });
        if (race) return { ok: true, credited: true, externalReference: race.referenceCode };
      }
      if (error instanceof AdapterOperationError) {
        return { ok: false, code: error.code, reason: error.message };
      }
      throw error;
    }
  }
}
