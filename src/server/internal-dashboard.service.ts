import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

export type InternalDashboardMetrics = {
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingAccountOpenings: number;
  pendingLoanApplications: number;
  pendingCompanyVerifications: number;
  activeLoans: number;
  frozenAccounts: number;
  restrictedUsers: number;
  pendingScheduledTransfers: number;
  failedScheduledTransfers: number;
  totalUsers: number;
  totalCompanies: number;
  verifiedCompanies: number;
  totalBankAccounts: number;
  activeBankAccounts: number;
  totalBalancesHeld: number;
};

function decimalSum(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

export async function getInternalDashboardMetrics(): Promise<InternalDashboardMetrics> {
  await requireOperator();

  const [
    pendingDeposits,
    pendingWithdrawals,
    pendingAccountOpenings,
    pendingLoanApplications,
    pendingCompanyVerifications,
    activeLoans,
    frozenAccounts,
    restrictedUsers,
    pendingScheduledTransfers,
    failedScheduledTransfers,
    totalUsers,
    totalCompanies,
    verifiedCompanies,
    totalBankAccounts,
    activeBankAccounts,
    balanceAgg,
  ] = await Promise.all([
    prisma.bankTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.bankAccount.count({ where: { status: "PENDING" } }),
    prisma.loanApplication.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
    prisma.company.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING"] } } }),
    prisma.loan.count({ where: { status: "ACTIVE" } }),
    prisma.bankAccount.count({ where: { status: "FROZEN" } }),
    prisma.user.count({ where: { accountStatus: "RESTRICTED" } }),
    prisma.scheduledPayment.count({
      where: { status: { in: ["PENDING_REVIEW", "APPROVED"] }, transferScope: "INTRABANK" },
    }),
    prisma.scheduledPayment.count({ where: { status: "FAILED", transferScope: "INTRABANK" } }),
    prisma.user.count(),
    prisma.company.count(),
    prisma.company.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.bankAccount.count(),
    prisma.bankAccount.count({ where: { status: "ACTIVE" } }),
    prisma.bankAccount.aggregate({ where: { status: "ACTIVE" }, _sum: { balance: true } }),
  ]);

  return {
    pendingDeposits,
    pendingWithdrawals,
    pendingAccountOpenings,
    pendingLoanApplications,
    pendingCompanyVerifications,
    activeLoans,
    frozenAccounts,
    restrictedUsers,
    pendingScheduledTransfers,
    failedScheduledTransfers,
    totalUsers,
    totalCompanies,
    verifiedCompanies,
    totalBankAccounts,
    activeBankAccounts,
    totalBalancesHeld: decimalSum(balanceAgg._sum.balance),
  };
}

export type InternalComplianceSnapshot = {
  frozenAccounts: number;
  restrictedUsers: number;
  frozenUsers: number;
  failedScheduledTransfers: number;
  deniedWithdrawalsLast30Days: number;
  largeAdjustmentsLast30Days: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingAccountOpenings: number;
};

export async function getInternalComplianceSnapshot(): Promise<InternalComplianceSnapshot> {
  await requireOperator();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    frozenAccounts,
    restrictedUsers,
    frozenUsers,
    failedScheduledTransfers,
    deniedWithdrawalsLast30Days,
    largeAdjustmentsLast30Days,
    pendingDeposits,
    pendingWithdrawals,
    pendingAccountOpenings,
  ] = await Promise.all([
    prisma.bankAccount.count({ where: { status: "FROZEN" } }),
    prisma.user.count({ where: { accountStatus: "RESTRICTED" } }),
    prisma.user.count({ where: { accountStatus: "FROZEN" } }),
    prisma.scheduledPayment.count({ where: { status: "FAILED" } }),
    prisma.bankTransaction.count({
      where: { type: "WITHDRAWAL", status: "DENIED", reviewedAt: { gte: since } },
    }),
    prisma.bankTransaction.count({
      where: {
        type: "ADJUSTMENT",
        status: "APPROVED",
        createdAt: { gte: since },
        amount: { gte: 100_000 },
      },
    }),
    prisma.bankTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.bankAccount.count({ where: { status: "PENDING" } }),
  ]);

  return {
    frozenAccounts,
    restrictedUsers,
    frozenUsers,
    failedScheduledTransfers,
    deniedWithdrawalsLast30Days,
    largeAdjustmentsLast30Days,
    pendingDeposits,
    pendingWithdrawals,
    pendingAccountOpenings,
  };
}
