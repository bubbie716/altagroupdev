import { prisma } from "@/server/db";

const PERSONAL_ACCOUNT_TYPES = [
  "ALTA_ACCESS",
  "CHECKING",
  "SAVINGS",
  "RESERVE",
  "PRIVATE",
] as const;

function decimalSum(value: { toNumber(): number } | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type BankMetrics = {
  totalAccounts: number;
  activeAccounts: number;
  pendingAccounts: number;
  frozenAccounts: number;
  totalDepositsHeld: number;
  totalBusinessOperatingAccounts: number;
  totalPersonalAccounts: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  monthlyTransactionVolume: number;
  approvedDepositVolume: number;
  approvedWithdrawalVolume: number;
};

export async function getBankMetrics(): Promise<BankMetrics> {
  const monthStart = startOfMonth();

  const [
    totalAccounts,
    activeAccounts,
    pendingAccounts,
    frozenAccounts,
    totalBusinessOperatingAccounts,
    totalPersonalAccounts,
    pendingDeposits,
    pendingWithdrawals,
    depositsHeld,
    approvedDeposits,
    approvedWithdrawals,
    monthlyVolume,
  ] = await Promise.all([
    prisma.bankAccount.count(),
    prisma.bankAccount.count({ where: { status: "ACTIVE" } }),
    prisma.bankAccount.count({ where: { status: "PENDING" } }),
    prisma.bankAccount.count({ where: { status: "FROZEN" } }),
    prisma.bankAccount.count({ where: { accountType: "BUSINESS_OPERATING" } }),
    prisma.bankAccount.count({
      where: {
        accountType: { in: [...PERSONAL_ACCOUNT_TYPES] },
        companyId: null,
      },
    }),
    prisma.bankTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.bankAccount.aggregate({
      where: { status: "ACTIVE" },
      _sum: { balance: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "DEPOSIT", status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "WITHDRAWAL", status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: {
        status: "APPROVED",
        type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalAccounts,
    activeAccounts,
    pendingAccounts,
    frozenAccounts,
    totalDepositsHeld: decimalSum(depositsHeld._sum.balance),
    totalBusinessOperatingAccounts,
    totalPersonalAccounts,
    pendingDeposits,
    pendingWithdrawals,
    monthlyTransactionVolume: decimalSum(monthlyVolume._sum.amount),
    approvedDepositVolume: decimalSum(approvedDeposits._sum.amount),
    approvedWithdrawalVolume: decimalSum(approvedWithdrawals._sum.amount),
  };
}
