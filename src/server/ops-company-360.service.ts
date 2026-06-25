import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { getInternalCompanyDetail } from "@/server/company.service";
import { fromDbCompanyRole } from "@/server/enum-map";
import { COMPANY_ROLE_LABELS } from "@/lib/bank/business-banking-types";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import { fromDbBankAccountType } from "@/server/bank-mapper";
import { buildActivityTimeline } from "@/server/ops-platform.service";
import { listInternalNotes } from "@/server/internal-note.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function getInternalCompany360(companyId: string) {
  await requireOperator();
  const company = await getInternalCompanyDetail(companyId);
  if (!company) throw new Error("NOT_FOUND");

  const [notes, timeline, accounts, loans, altaPay, statements, auditCount] = await Promise.all([
    listInternalNotes("COMPANY", companyId),
    buildActivityTimeline("COMPANY", companyId, 40),
    prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { companyId },
        description: { contains: "Alta Pay", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { bankAccount: true },
    }),
    prisma.bankStatement.findMany({
      where: { bankAccount: { companyId } },
      orderBy: { periodEnd: "desc" },
      take: 10,
    }),
    prisma.auditLog.count({ where: { targetCompanyId: companyId } }),
  ]);

  return {
    company: {
      id: company.id,
      name: company.name,
      ticker: company.ticker,
      type: company.type,
      sector: company.sector,
      status: company.status,
      verificationStatus: company.verificationStatus,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      members: company.memberships.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        discordUsername: m.user.discordUsername,
        role: fromDbCompanyRole(m.role),
        roleLabel: COMPANY_ROLE_LABELS[fromDbCompanyRole(m.role)],
        joinedAt: m.createdAt.toISOString(),
      })),
    },
    notes,
    timeline,
    relationshipManager: null as string | null,
    verificationTimeline: [
      {
        label: "Registered",
        at: company.createdAt.toISOString(),
      },
      {
        label: `Verification: ${company.verificationStatus}`,
        at: company.updatedAt.toISOString(),
      },
    ],
    bankAccounts: accounts.map((a) => ({
      id: a.id,
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      accountTypeLabel: formatBankAccountTypeLabel(fromDbBankAccountType(a.accountType)),
      status: a.status,
      balance: decimalToNumber(a.balance),
    })),
    loans: loans.map((l) => ({
      id: l.id,
      status: l.status,
      principalAmount: decimalToNumber(l.principalAmount),
      outstandingBalance: decimalToNumber(l.outstandingBalance),
      createdAt: l.createdAt.toISOString(),
    })),
    altaPayActivity: altaPay.map((tx) => ({
      id: tx.id,
      accountId: tx.bankAccountId,
      accountName: tx.bankAccount.accountName,
      referenceCode: tx.referenceCode,
      amount: decimalToNumber(tx.amount),
      accountNumber: tx.bankAccount.accountNumber,
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    })),
    statements: statements.map((s) => ({
      id: s.id,
      statementNumber: s.statementNumber,
      periodEnd: s.periodEnd.toISOString(),
      status: s.status,
    })),
    auditCount,
  };
}
