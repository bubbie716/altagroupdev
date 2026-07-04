import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

export type BalanceReconciliationMismatch = {
  accountId: string;
  accountNumber: string;
  storedBalance: number;
  ledgerBalance: number;
  delta: number;
};

export type BalanceReconciliationResult = {
  accountsChecked: number;
  mismatchCount: number;
  mismatches: BalanceReconciliationMismatch[];
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function signedAmountForTransaction(row: {
  type: string;
  amount: { toString(): string };
  description: string;
}): number {
  const amount = decimalToNumber(row.amount);
  switch (row.type) {
    case "DEPOSIT":
      return amount;
    case "WITHDRAWAL":
      return -amount;
    case "ADJUSTMENT": {
      const desc = row.description.toLowerCase();
      if (desc.includes("debit adjustment") || desc.includes("admin debit")) return -amount;
      return amount;
    }
    default:
      return 0;
  }
}

export async function computeLedgerBalanceForAccount(accountId: string): Promise<number> {
  const transactions = await prisma.bankTransaction.findMany({
    where: { bankAccountId: accountId, status: "APPROVED" },
    select: { type: true, amount: true, description: true },
  });
  return transactions.reduce((sum, tx) => sum + signedAmountForTransaction(tx), 0);
}

export async function reconcileBankAccountBalances(input?: {
  accountIds?: string[];
  actorUserId?: string;
}): Promise<BalanceReconciliationResult> {
  const accounts = await prisma.bankAccount.findMany({
    where: input?.accountIds?.length ? { id: { in: input.accountIds } } : { status: { not: "CLOSED" } },
    select: { id: true, accountNumber: true, balance: true },
  });

  const mismatches: BalanceReconciliationMismatch[] = [];

  for (const account of accounts) {
    const ledgerBalance = await computeLedgerBalanceForAccount(account.id);
    const storedBalance = decimalToNumber(account.balance);
    const delta = Number((storedBalance - ledgerBalance).toFixed(2));
    if (Math.abs(delta) >= 0.01) {
      mismatches.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        storedBalance,
        ledgerBalance,
        delta,
      });
    }
  }

  if (mismatches.length > 0) {
    const actorUserId = input?.actorUserId ?? (await resolveSystemActorUserId());
    await writeAuditLog({
      actorUserId,
      action: "BANK_BALANCE_RECONCILIATION_MISMATCH",
      entityType: "PLATFORM",
      description: `Balance reconciliation found ${mismatches.length} mismatch(es)`,
      metadata: {
        source: input?.actorUserId ? "INTERNAL" : "CRON",
        severity: "critical",
        mismatchCount: mismatches.length,
        mismatches: mismatches.map((m) => ({
          accountId: m.accountId,
          accountNumber: m.accountNumber,
          storedBalance: m.storedBalance,
          ledgerBalance: m.ledgerBalance,
          delta: m.delta,
        })),
        requiresAction: true,
      },
    });

    sendStaffAuditMessage({
      product: "Banking",
      action: "Balance reconciliation mismatch",
      actorUserId: input?.actorUserId,
      details: `${mismatches.length} account(s) with ledger drift — review required`,
      internalUrl: "/internal/queues/exceptions",
      severity: "CRITICAL",
      requiresAction: true,
      dedupeKey: `balance-reconciliation:${mismatches.length}:${mismatches[0]?.accountId}`,
    });
  }

  return {
    accountsChecked: accounts.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}
