import { randomInt } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canViewBusinessTreasury } from "@/lib/auth/permissions";
import type {
  BankStatementDetail,
  BankStatementSummary,
  GenerateStatementInput,
  GenerateStatementsBatchInput,
  GenerateStatementsBatchResult,
  InternalStatementOpsSummary,
  StatementGeneratableAccount,
} from "@/lib/bank/statement-types";
import { formatStatementNumber } from "@/lib/bank/statement-number";
import { prisma } from "@/server/db";
import {
  bankAccountAccessWhere,
  isBankAccountAccessibleByUser,
  loadAltaUserOrThrow,
} from "@/server/bank-account-access.service";
import {
  isTransferReference,
  mapBankStatementDetail,
  mapBankStatementSummary,
} from "@/server/statement-mapper";
import type { Prisma } from "@prisma/client";
import { userWithMembershipsInclude } from "@/server/user-mapper";

const statementInclude = {
  bankAccount: {
    include: {
      user: true,
      company: true,
    },
  },
} satisfies Prisma.BankStatementInclude;

function sortStatementsNewestGeneratedFirst(
  statements: BankStatementSummary[],
): BankStatementSummary[] {
  return [...statements].sort((a, b) => {
    const aMs = new Date(a.generatedAt ?? a.createdAt).getTime();
    const bMs = new Date(b.generatedAt ?? b.createdAt).getTime();
    return bMs - aMs;
  });
}

const periodTransactionInclude = {
  bankAccount: {
    include: {
      user: { select: { discordUsername: true } },
      company: true,
    },
  },
} satisfies Prisma.BankTransactionInclude;

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

async function requireAccessibleAccount(accountId: string, userId: string) {
  const user = await loadAltaUserOrThrow(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...bankAccountAccessWhere(user, "view") },
    include: { user: true, company: true },
  });
  if (!account) forbidden();
  return account;
}

function canViewBusinessStatements(user: AltaUser, companyId: string): boolean {
  return canViewBusinessTreasury(user, { companyId });
}

async function assertCanViewAccountStatements(userId: string, account: { companyId: string | null }) {
  if (!account.companyId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) forbidden();
  const { mapDbUserToAltaUser } = await import("@/server/user-mapper");
  const altaUser = mapDbUserToAltaUser(user);
  if (!canViewBusinessTreasury(altaUser, { companyId: account.companyId })) forbidden();
}

function canGenerateBusinessStatement(user: AltaUser, companyId: string): boolean {
  return canManageBusinessTreasury(user, { companyId });
}

function parsePeriod(start: string, end: string): { periodStart: Date; periodEnd: Date } {
  const periodStart = start.includes("T")
    ? new Date(start)
    : new Date(`${start}T00:00:00.000Z`);
  const periodEnd = end.includes("T") ? new Date(end) : new Date(`${end}T23:59:59.999Z`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    badRequest("Invalid statement period dates.");
  }
  if (periodEnd <= periodStart) {
    badRequest("Period end must be after period start.");
  }
  return { periodStart, periodEnd };
}

/**
 * Opening balance is derived from approved transaction history before periodStart.
 * TODO: Replace with immutable ledger snapshots when full balance history is available.
 * Accounts opened with non-zero seed balances may show estimated openings until ledger v2.
 */
async function calculateOpeningBalance(accountId: string, periodStart: Date): Promise<number> {
  const prior = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: accountId,
      status: "APPROVED",
      createdAt: { lt: periodStart },
    },
    select: { type: true, amount: true },
  });

  return prior.reduce((balance, tx) => {
    const amount = decimalToNumber(tx.amount);
    if (tx.type === "DEPOSIT" || tx.type === "ADJUSTMENT" || tx.type === "INTEREST_CREDIT") {
      return balance + amount;
    }
    if (tx.type === "WITHDRAWAL" || tx.type === "LOAN_PAYMENT" || tx.type === "INTEREST_CHARGE") {
      return balance - amount;
    }
    return balance;
  }, 0);
}

function summarizePeriodTransactions(
  transactions: {
    type: "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT" | "LOAN_PAYMENT" | "INTEREST_CHARGE" | "INTEREST_CREDIT";
    amount: { toString(): string };
    referenceCode: string;
  }[],
) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalTransfersIn = 0;
  let totalTransfersOut = 0;

  for (const tx of transactions) {
    const amount = decimalToNumber(tx.amount);
    if (tx.type === "DEPOSIT" || tx.type === "INTEREST_CREDIT") {
      totalDeposits += amount;
      if (tx.type === "DEPOSIT" && isTransferReference(tx.referenceCode, "DEPOSIT")) {
        totalTransfersIn += amount;
      }
    } else if (tx.type === "WITHDRAWAL" || tx.type === "LOAN_PAYMENT" || tx.type === "INTEREST_CHARGE") {
      totalWithdrawals += amount;
      if (tx.type === "WITHDRAWAL" && isTransferReference(tx.referenceCode, "WITHDRAWAL")) {
        totalTransfersOut += amount;
      }
    } else if (tx.type === "ADJUSTMENT") {
      totalDeposits += amount;
    }
  }

  const netChange = totalDeposits - totalWithdrawals;
  return { totalDeposits, totalWithdrawals, totalTransfersIn, totalTransfersOut, netChange };
}

export async function generateStatementForAccount(
  accountId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<BankStatementDetail> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { user: true, company: true },
  });
  if (!account) notFound();

  const existing = await prisma.bankStatement.findFirst({
    where: {
      bankAccountId: accountId,
      periodStart,
      periodEnd,
      status: { not: "VOID" },
    },
    include: statementInclude,
  });
  if (existing) {
    const periodTransactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: accountId,
        status: "APPROVED",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { createdAt: "asc" },
      include: periodTransactionInclude,
    });
    return mapBankStatementDetail(existing, periodTransactions, true);
  }

  const periodTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: accountId,
      status: "APPROVED",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { createdAt: "asc" },
    include: periodTransactionInclude,
  });

  const openingBalance = await calculateOpeningBalance(accountId, periodStart);
  const totals = summarizePeriodTransactions(periodTransactions);
  const closingBalance = openingBalance + totals.netChange;

  const openingBalanceEstimated = true;

  let statementNumber = formatStatementNumber(periodEnd, account.accountNumber);
  for (let attempt = 0; attempt < 8; attempt++) {
    const collision = await prisma.bankStatement.findUnique({ where: { statementNumber } });
    if (!collision) break;
    statementNumber = formatStatementNumber(periodEnd, account.accountNumber, String(randomInt(1000, 9999)));
  }

  const row = await prisma.bankStatement.create({
    data: {
      bankAccountId: accountId,
      statementNumber,
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      totalDeposits: totals.totalDeposits,
      totalWithdrawals: totals.totalWithdrawals,
      totalTransfersIn: totals.totalTransfersIn,
      totalTransfersOut: totals.totalTransfersOut,
      transactionCount: periodTransactions.length,
      status: "GENERATED",
      generatedAt: new Date(),
    },
    include: statementInclude,
  });

  return mapBankStatementDetail(row, periodTransactions, openingBalanceEstimated);
}

export async function listPersonalStatements(userId: string): Promise<BankStatementSummary[]> {
  const rows = await prisma.bankStatement.findMany({
    where: {
      bankAccount: {
        userId,
        companyId: null,
      },
    },
    include: statementInclude,
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
  });
  return sortStatementsNewestGeneratedFirst(rows.map(mapBankStatementSummary));
}

/** Personal and business operating statements the user may view in Statement Center. */
export async function listStatementCenterStatements(userId: string): Promise<BankStatementSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) return [];

  const { mapDbUserToAltaUser } = await import("@/server/user-mapper");
  const altaUser = mapDbUserToAltaUser(user);

  const viewableCompanyIds = altaUser.companyMemberships
    .filter((membership) => canViewBusinessTreasury(altaUser, { companyId: membership.companyId }))
    .map((membership) => membership.companyId);

  const rows = await prisma.bankStatement.findMany({
    where: {
      status: { not: "VOID" },
      bankAccount: {
        OR: [
          { userId, companyId: null },
          ...(viewableCompanyIds.length > 0
            ? [{ companyId: { in: viewableCompanyIds } }]
            : []),
        ],
      },
    },
    include: statementInclude,
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
  });
  return sortStatementsNewestGeneratedFirst(rows.map(mapBankStatementSummary));
}

export async function listAccountStatements(
  userId: string,
  accountId: string,
): Promise<BankStatementSummary[]> {
  const account = await requireAccessibleAccount(accountId, userId);
  await assertCanViewAccountStatements(userId, account);
  const rows = await prisma.bankStatement.findMany({
    where: { bankAccountId: accountId, status: { not: "VOID" } },
    include: statementInclude,
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
  });
  return sortStatementsNewestGeneratedFirst(rows.map(mapBankStatementSummary));
}

export async function listBusinessStatements(
  user: AltaUser,
  companyId: string,
): Promise<BankStatementSummary[]> {
  if (!canViewBusinessStatements(user, companyId)) forbidden();

  const rows = await prisma.bankStatement.findMany({
    where: {
      bankAccount: { companyId },
      status: { not: "VOID" },
    },
    include: statementInclude,
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
  });
  return sortStatementsNewestGeneratedFirst(rows.map(mapBankStatementSummary));
}

export async function getStatementDetail(
  userId: string,
  statementId: string,
): Promise<BankStatementDetail> {
  const user = await loadAltaUserOrThrow(userId);
  const row = await prisma.bankStatement.findFirst({
    where: {
      id: statementId,
      bankAccount: bankAccountAccessWhere(user, "view"),
    },
    include: statementInclude,
  });
  if (!row) notFound();
  await assertCanViewAccountStatements(userId, row.bankAccount);

  const periodTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: row.bankAccountId,
      status: "APPROVED",
      createdAt: { gte: row.periodStart, lte: row.periodEnd },
    },
    orderBy: { createdAt: "asc" },
    include: periodTransactionInclude,
  });

  return mapBankStatementDetail(row, periodTransactions, true);
}

export async function generateStatementForUser(
  userId: string,
  input: GenerateStatementInput,
): Promise<BankStatementDetail> {
  const account = await requireAccessibleAccount(input.accountId, userId);
  if (account.companyId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithMembershipsInclude,
    });
    if (!user) forbidden();
    const { mapDbUserToAltaUser } = await import("@/server/user-mapper");
    const altaUser = mapDbUserToAltaUser(user);
    if (!canGenerateBusinessStatement(altaUser, account.companyId)) forbidden();
  }

  const { periodStart, periodEnd } = parsePeriod(input.periodStart, input.periodEnd);
  return generateStatementForAccount(input.accountId, periodStart, periodEnd);
}

export async function getInternalStatementOps(): Promise<InternalStatementOpsSummary> {
  const [recentStatements, voidedCount] = await Promise.all([
    prisma.bankStatement.findMany({
      include: statementInclude,
      orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.bankStatement.count({ where: { status: "VOID" } }),
  ]);

  return {
    recentStatements: sortStatementsNewestGeneratedFirst(
      recentStatements.map(mapBankStatementSummary),
    ),
    voidedCount,
    errorPlaceholder: "No statement generation errors logged yet.",
  };
}

/** Preview batch: generate prior calendar month for all active accounts without an existing statement. */
export async function generateMonthlyStatementsPreview(): Promise<{
  created: number;
  skipped: number;
  errors: string[];
}> {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1, 0, 0, 0, 0));

  const accounts = await prisma.bankAccount.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    const existing = await prisma.bankStatement.findFirst({
      where: {
        bankAccountId: account.id,
        periodStart,
        periodEnd,
        status: { not: "VOID" },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await generateStatementForAccount(account.id, periodStart, periodEnd);
      created++;
    } catch (err) {
      errors.push(
        `${account.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  return { created, skipped, errors };
}

export async function listStatementGeneratableAccountsForUser(
  userId: string,
): Promise<StatementGeneratableAccount[]> {
  const user = await loadAltaUserOrThrow(userId);
  const accounts = await prisma.bankAccount.findMany({
    where: { ...bankAccountAccessWhere(user, "view"), status: "ACTIVE" },
    include: { company: true },
    orderBy: [{ companyId: "asc" }, { accountName: "asc" }],
  });

  const altaUser = user;

  return accounts
    .filter((account) => !account.companyId || canGenerateBusinessStatement(altaUser, account.companyId))
    .map((account) => ({
      id: account.id,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      isCompanyAccount: !!account.companyId,
      companyName: account.company?.name ?? null,
    }));
}

export async function generateStatementsForUserBatch(
  userId: string,
  input: GenerateStatementsBatchInput,
): Promise<GenerateStatementsBatchResult> {
  const generatable = await listStatementGeneratableAccountsForUser(userId);
  const generatableIds = new Set(generatable.map((a) => a.id));

  let targetIds: string[];
  if (input.allAccounts) {
    targetIds = generatable.map((a) => a.id);
  } else if (input.accountIds?.length) {
    const invalid = input.accountIds.filter((id) => !generatableIds.has(id));
    if (invalid.length > 0) forbidden();
    targetIds = input.accountIds;
  } else {
    badRequest("Select at least one account or choose all accounts.");
  }

  if (targetIds.length === 0) {
    badRequest("No eligible accounts available for statement generation.");
  }

  const { periodStart, periodEnd } = parsePeriod(input.periodStart, input.periodEnd);

  let created = 0;
  let skipped = 0;
  const errors: GenerateStatementsBatchResult["errors"] = [];
  const statements: GenerateStatementsBatchResult["statements"] = [];

  for (const accountId of targetIds) {
    const account = generatable.find((a) => a.id === accountId);
    const label = account?.accountNumber ?? accountId;
    try {
      const existing = await prisma.bankStatement.findFirst({
        where: {
          bankAccountId: accountId,
          periodStart,
          periodEnd,
          status: { not: "VOID" },
        },
      });
      if (existing) {
        skipped++;
        statements.push({ id: existing.id, accountId });
        continue;
      }
      const detail = await generateStatementForAccount(accountId, periodStart, periodEnd);
      created++;
      statements.push({ id: detail.id, accountId });
    } catch (err) {
      errors.push({
        accountId,
        label,
        message: err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unknown error",
      });
    }
  }

  return { created, skipped, errors, statements };
}

export function previousCalendarMonthRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1, 0, 0, 0, 0));
  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}
