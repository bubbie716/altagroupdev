import type { BankStatement, BankStatementStatus, BankAccount, Company, User } from "@prisma/client";
import type { BankStatementStatusCode, BankStatementDetail, BankStatementSummary } from "@/lib/bank/statement-types";
import { mapUserBankTransaction } from "@/server/bank-mapper";
import { getRoutingNumber } from "@/lib/bank/routing";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import type { BankTransactionType } from "@prisma/client";

const STATUS_FROM_DB: Record<BankStatementStatus, BankStatementStatusCode> = {
  DRAFT: "draft",
  GENERATED: "generated",
  VOID: "void",
};

const STATUS_LABELS: Record<BankStatementStatusCode, string> = {
  draft: "Draft",
  generated: "Generated",
  void: "Void",
};

type StatementWithAccount = BankStatement & {
  bankAccount: BankAccount & {
    user: User;
    company: Company | null;
  };
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function ownerLabel(account: BankAccount & { user: User; company: Company | null }): string {
  if (account.company) return account.company.name;
  return account.user.discordUsername;
}

export function mapBankStatementSummary(row: StatementWithAccount): BankStatementSummary {
  const status = STATUS_FROM_DB[row.status];
  const account = row.bankAccount;

  return {
    id: row.id,
    statementNumber: row.statementNumber,
    bankAccountId: row.bankAccountId,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ownerLabel: ownerLabel(account),
    isCompanyAccount: account.companyId !== null,
    companyName: account.company?.name ?? null,
    companyId: account.companyId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    openingBalance: decimalToNumber(row.openingBalance),
    closingBalance: decimalToNumber(row.closingBalance),
    totalDeposits: decimalToNumber(row.totalDeposits),
    totalWithdrawals: decimalToNumber(row.totalWithdrawals),
    totalTransfersIn: decimalToNumber(row.totalTransfersIn),
    totalTransfersOut: decimalToNumber(row.totalTransfersOut),
    transactionCount: row.transactionCount,
    status,
    statusLabel: STATUS_LABELS[status],
    generatedAt: row.generatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapBankStatementDetail(
  row: StatementWithAccount,
  transactions: Parameters<typeof mapUserBankTransaction>[0][],
  openingBalanceEstimated: boolean,
): BankStatementDetail {
  const summary = mapBankStatementSummary(row);
  const netChange = summary.closingBalance - summary.openingBalance;

  return {
    ...summary,
    routingNumber: getRoutingNumber(),
    currency: row.bankAccount.currency,
    netChange,
    transactions: transactions.map(mapUserBankTransaction),
    openingBalanceEstimated,
    accountName: row.bankAccount.accountName,
    ownerLabel: ownerLabel(row.bankAccount),
  };
}

export function accountTypeLabelForStatement(accountType: BankAccount["accountType"]): string {
  const code = accountType
    .toLowerCase()
    .replace(/_(.)/g, (_, c: string) => c.toUpperCase()) as Parameters<typeof formatBankAccountTypeLabel>[0];
  return formatBankAccountTypeLabel(code);
}

export function isTransferReference(referenceCode: string, type: BankTransactionType): boolean {
  if (type === "DEPOSIT") return referenceCode.endsWith("-IN");
  if (type === "WITHDRAWAL") return referenceCode.endsWith("-OUT");
  return referenceCode.startsWith("TRF-");
}
