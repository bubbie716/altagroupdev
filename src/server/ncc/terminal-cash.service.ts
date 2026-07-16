import { Prisma, type TerminalCashAccount } from "@prisma/client";
import { prisma } from "@/server/db";
import { asDecimal, decimalToNumber, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";

export type TerminalCashAccountView = {
  id: string;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  currency: string;
  ledgerBalance: number;
  availableBalance: number;
  reservedBalance: number;
  status: TerminalCashAccount["status"];
  createdAt: string;
  updatedAt: string;
};

function mapTerminalCashAccount(row: TerminalCashAccount): TerminalCashAccountView {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    ownerCompanyId: row.ownerCompanyId,
    currency: row.currency,
    ledgerBalance: decimalToNumber(row.ledgerBalance),
    availableBalance: decimalToNumber(row.availableBalance),
    reservedBalance: decimalToNumber(row.reservedBalance),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Idempotently provisions (or returns) a user's Alta Terminal / Exchange trading-cash account. */
export async function ensureUserTerminalCashAccount(
  userId: string,
  currency: string = NCC_DEFAULT_CURRENCY,
): Promise<TerminalCashAccountView> {
  const normalizedCurrency = currency.toUpperCase();
  const existing = await prisma.terminalCashAccount.findFirst({
    where: { ownerUserId: userId, ownerCompanyId: null, currency: normalizedCurrency },
  });
  if (existing) return mapTerminalCashAccount(existing);

  try {
    const created = await prisma.terminalCashAccount.create({
      data: {
        ownerUserId: userId,
        currency: normalizedCurrency,
        ledgerBalance: 0,
        availableBalance: 0,
        reservedBalance: 0,
        status: "ACTIVE",
      },
    });
    return mapTerminalCashAccount(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await prisma.terminalCashAccount.findFirst({
        where: { ownerUserId: userId, ownerCompanyId: null, currency: normalizedCurrency },
      });
      if (race) return mapTerminalCashAccount(race);
    }
    throw error;
  }
}

/** Idempotently provisions (or returns) a company's Alta Terminal / Exchange trading-cash account. */
export async function ensureCompanyTerminalCashAccount(
  companyId: string,
  currency: string = NCC_DEFAULT_CURRENCY,
): Promise<TerminalCashAccountView> {
  const normalizedCurrency = currency.toUpperCase();
  const existing = await prisma.terminalCashAccount.findFirst({
    where: { ownerCompanyId: companyId, currency: normalizedCurrency },
  });
  if (existing) return mapTerminalCashAccount(existing);

  try {
    const created = await prisma.terminalCashAccount.create({
      data: {
        ownerCompanyId: companyId,
        currency: normalizedCurrency,
        ledgerBalance: 0,
        availableBalance: 0,
        reservedBalance: 0,
        status: "ACTIVE",
      },
    });
    return mapTerminalCashAccount(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await prisma.terminalCashAccount.findFirst({
        where: { ownerCompanyId: companyId, currency: normalizedCurrency },
      });
      if (race) return mapTerminalCashAccount(race);
    }
    throw error;
  }
}

export async function getTerminalCashAccountById(id: string): Promise<TerminalCashAccountView | null> {
  const row = await prisma.terminalCashAccount.findUnique({ where: { id } });
  return row ? mapTerminalCashAccount(row) : null;
}

export async function getUserTerminalCashAccount(
  userId: string,
  currency: string = NCC_DEFAULT_CURRENCY,
): Promise<TerminalCashAccountView | null> {
  const row = await prisma.terminalCashAccount.findFirst({
    where: { ownerUserId: userId, ownerCompanyId: null, currency: currency.toUpperCase() },
  });
  return row ? mapTerminalCashAccount(row) : null;
}

/** Available-to-trade balance, i.e. ledger minus anything reserved by in-flight NCC operations. */
export function computeTerminalAvailableBalance(account: {
  ledgerBalance: Prisma.Decimal | number | string;
  reservedBalance: Prisma.Decimal | number | string;
}): number {
  return decimalToNumber(asDecimal(account.ledgerBalance).sub(asDecimal(account.reservedBalance)));
}

export async function listTerminalCashEntries(accountId: string, limit = 50) {
  const rows = await prisma.terminalCashEntry.findMany({
    where: { terminalCashAccountId: accountId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
  return rows.map((row) => ({
    id: row.id,
    entryType: row.entryType,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    balanceBefore: decimalToNumber(row.balanceBefore),
    balanceAfter: decimalToNumber(row.balanceAfter),
    availableBefore: decimalToNumber(row.availableBefore),
    availableAfter: decimalToNumber(row.availableAfter),
    settlementInstructionId: row.settlementInstructionId,
    externalReference: row.externalReference,
    createdAt: row.createdAt.toISOString(),
  }));
}
