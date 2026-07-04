import type { Prisma } from "@prisma/client";
import { computeAvailableBalance } from "@/server/account-balance.service";

export type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type AvailableBalanceOptions = {
  /** When approving a pending withdrawal, exclude it from reserved pending totals. */
  excludePendingWithdrawalId?: string;
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function lockBankAccountRow(tx: TransactionClient, accountId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "BankAccount" WHERE id = ${accountId} FOR UPDATE`;
}

export async function lockBankAccountsInOrder(
  tx: TransactionClient,
  accountIds: string[],
): Promise<void> {
  const unique = [...new Set(accountIds)].sort();
  for (const id of unique) {
    await lockBankAccountRow(tx, id);
  }
}

export async function lockAltaCardRow(tx: TransactionClient, cardId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "AltaCard" WHERE id = ${cardId} FOR UPDATE`;
}

export async function getAccountAvailableBalanceInTx(
  tx: TransactionClient,
  accountId: string,
  options?: AvailableBalanceOptions,
): Promise<number> {
  await lockBankAccountRow(tx, accountId);

  const account = await tx.bankAccount.findUnique({
    where: { id: accountId },
    select: { balance: true },
  });
  if (!account) throw new Error("NOT_FOUND");

  const pendingWhere: Prisma.BankTransactionWhereInput = {
    bankAccountId: accountId,
    type: "WITHDRAWAL",
    status: "PENDING",
  };
  if (options?.excludePendingWithdrawalId) {
    pendingWhere.id = { not: options.excludePendingWithdrawalId };
  }

  const [pendingAgg, holdsAgg] = await Promise.all([
    tx.bankTransaction.aggregate({ where: pendingWhere, _sum: { amount: true } }),
    tx.bankAccountHold.aggregate({
      where: { bankAccountId: accountId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  const balance = decimalToNumber(account.balance);
  const pending = pendingAgg._sum.amount ? decimalToNumber(pendingAgg._sum.amount) : 0;
  const holds = holdsAgg._sum.amount ? decimalToNumber(holdsAgg._sum.amount) : 0;
  return computeAvailableBalance(balance, pending, holds);
}

export async function assertAccountAvailableForDebitInTx(
  tx: TransactionClient,
  accountId: string,
  amount: number,
  options?: AvailableBalanceOptions & { message?: string },
): Promise<number> {
  const available = await getAccountAvailableBalanceInTx(tx, accountId, options);
  if (amount > available) {
    throw new Error(
      `BAD_REQUEST:${options?.message ?? "Insufficient available balance."}`,
    );
  }
  return available;
}

export async function debitBankAccountInTx(
  tx: TransactionClient,
  accountId: string,
  amount: number,
  options?: AvailableBalanceOptions & {
    message?: string;
    /** Admin override — skip available-balance check (balance may go negative). */
    allowOverdraft?: boolean;
  },
): Promise<void> {
  if (options?.allowOverdraft) {
    await lockBankAccountRow(tx, accountId);
  } else {
    await assertAccountAvailableForDebitInTx(tx, accountId, amount, options);
  }

  await tx.bankAccount.update({
    where: { id: accountId },
    data: { balance: { decrement: amount } },
  });
}

export async function creditBankAccountInTx(
  tx: TransactionClient,
  accountId: string,
  amount: number,
): Promise<void> {
  await lockBankAccountRow(tx, accountId);
  await tx.bankAccount.update({
    where: { id: accountId },
    data: { balance: { increment: amount } },
  });
}

export const INTERBANK_TRANSFERS_UNAVAILABLE_MESSAGE =
  "Interbank wire transfers are not yet available. NCC settlement infrastructure is still being built.";
