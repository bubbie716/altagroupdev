import { prisma } from "@/server/db";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function getActiveHoldTotal(accountId: string): Promise<number> {
  const result = await prisma.bankAccountHold.aggregate({
    where: { bankAccountId: accountId, status: "ACTIVE" },
    _sum: { amount: true },
  });
  return result._sum.amount ? decimalToNumber(result._sum.amount) : 0;
}

export async function getPendingWithdrawalTotal(accountId: string): Promise<number> {
  const result = await prisma.bankTransaction.aggregate({
    where: { bankAccountId: accountId, type: "WITHDRAWAL", status: "PENDING" },
    _sum: { amount: true },
  });
  return result._sum.amount ? decimalToNumber(result._sum.amount) : 0;
}

export async function getActiveHoldsByAccountIds(accountIds: string[]): Promise<Map<string, number>> {
  if (accountIds.length === 0) return new Map();
  const rows = await prisma.bankAccountHold.groupBy({
    by: ["bankAccountId"],
    where: { bankAccountId: { in: accountIds }, status: "ACTIVE" },
    _sum: { amount: true },
  });
  return new Map(
    rows.map((row) => [row.bankAccountId, row._sum.amount ? decimalToNumber(row._sum.amount) : 0]),
  );
}

export async function getPendingWithdrawalsByAccountIds(
  accountIds: string[],
): Promise<Map<string, number>> {
  if (accountIds.length === 0) return new Map();
  const rows = await prisma.bankTransaction.groupBy({
    by: ["bankAccountId"],
    where: { bankAccountId: { in: accountIds }, type: "WITHDRAWAL", status: "PENDING" },
    _sum: { amount: true },
  });
  return new Map(
    rows.map((row) => [row.bankAccountId, row._sum.amount ? decimalToNumber(row._sum.amount) : 0]),
  );
}

/** Spendable balance after pending withdrawals and active holds. */
export async function getAccountAvailableBalance(accountId: string): Promise<number> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    select: { balance: true },
  });
  if (!account) throw new Error("NOT_FOUND");

  const balance = decimalToNumber(account.balance);
  const [pending, holds] = await Promise.all([
    getPendingWithdrawalTotal(accountId),
    getActiveHoldTotal(accountId),
  ]);
  return balance - pending - holds;
}

export function computeAvailableBalance(
  ledgerBalance: number,
  pendingWithdrawals: number,
  activeHolds: number,
): number {
  return ledgerBalance - pendingWithdrawals - activeHolds;
}
