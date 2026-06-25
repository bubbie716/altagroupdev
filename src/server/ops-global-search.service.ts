import type { GlobalSearchResult } from "@/lib/internal/ops-types";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function globalOpsSearch(query: string, limit = 25): Promise<GlobalSearchResult[]> {
  await requireOperator();
  const q = query.trim();
  if (!q) return [];

  const results: GlobalSearchResult[] = [];
  const perType = Math.max(3, Math.ceil(limit / 5));

  const [users, companies, accounts, transactions, loans, statements] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { discordUsername: { contains: q, mode: "insensitive" } },
          { minecraftUsername: { contains: q, mode: "insensitive" } },
          { discordId: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: perType,
      orderBy: { lastLoginAt: "desc" },
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { ticker: { contains: q, mode: "insensitive" } },
        ],
      },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankAccount.findMany({
      where: {
        OR: [
          { accountNumber: { contains: q, mode: "insensitive" } },
          { accountName: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { user: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findMany({
      where: { id: { contains: q } },
      include: { borrowerUser: true, company: true },
      take: perType,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankStatement.findMany({
      where: {
        OR: [
          { statementNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { bankAccount: { include: { user: true, company: true } } },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const u of users) {
    results.push({
      id: u.id,
      type: "user",
      label: u.discordUsername,
      sublabel: u.discordId,
      href: `/internal/users/${u.id}`,
    });
  }
  for (const c of companies) {
    results.push({
      id: c.id,
      type: "company",
      label: c.name,
      sublabel: c.ticker ?? c.type,
      href: `/internal/companies/${c.id}`,
    });
  }
  for (const a of accounts) {
    results.push({
      id: a.id,
      type: "account",
      label: a.accountNumber,
      sublabel: a.company?.name ?? a.user.discordUsername,
      href: `/internal/bank/accounts/${a.id}`,
    });
  }
  for (const tx of transactions) {
    const isPay = tx.referenceCode.startsWith("PAY-");
    results.push({
      id: tx.id,
      type: isPay ? "alta_pay" : "transaction",
      label: tx.referenceCode,
      sublabel: `${tx.type} · ${decimalToNumber(tx.amount)} FLR`,
      href: isPay
        ? `/internal/bank/alta-pay?ref=${encodeURIComponent(tx.referenceCode.replace(/-OUT$|-IN$/, ""))}`
        : `/internal/bank/transactions/${tx.id}`,
    });
  }
  for (const l of loans) {
    results.push({
      id: l.id,
      type: "loan",
      label: l.id.slice(0, 12),
      sublabel: l.company?.name ?? l.borrowerUser?.discordUsername ?? "Loan",
      href: `/internal/lending/loans/${l.id}`,
    });
  }
  for (const s of statements) {
    results.push({
      id: s.id,
      type: "statement",
      label: s.statementNumber,
      sublabel: s.bankAccount.company?.name ?? s.bankAccount.user.discordUsername,
      href: `/bank/statements/${s.id}`,
    });
  }

  return results.slice(0, limit);
}
