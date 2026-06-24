import { prisma } from "@/server/db";
import { getBankMetrics } from "@/server/bank-metrics.service";

function decimalSum(value: { toNumber(): number } | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type PlatformMetrics = {
  totalUsers: number;
  totalCompanies: number;
  verifiedCompanies: number;
  pendingCompanyVerifications: number;
  totalBankAccounts: number;
  activeBankAccounts: number;
  pendingBankAccounts: number;
  totalBankDeposits: number;
  totalBusinessAccounts: number;
  totalPersonalAccounts: number;
  pendingDepositRequests: number;
  pendingWithdrawalRequests: number;
  pendingBankReviews: number;
  totalBankTransactionVolume: number;
  totalApprovedDeposits: number;
  totalApprovedWithdrawals: number;
  frozenBankAccounts: number;
  authorizedRepresentatives: number;
};

export async function queryPlatformMetrics(): Promise<PlatformMetrics> {
  const monthStart = startOfMonth();
  const bank = await getBankMetrics();

  const [
    totalUsers,
    totalCompanies,
    verifiedCompanies,
    pendingCompanyVerifications,
    pendingUserReviews,
    authorizedRepresentatives,
    approvedDepositsSum,
    approvedWithdrawalsSum,
    monthlyVolumeSum,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.company.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.company.count({ where: { verificationStatus: "PENDING" } }),
    prisma.user.count({ where: { accountStatus: "PENDING_REVIEW" } }),
    prisma.companyMembership.count(),
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

  const totalApprovedDeposits = decimalSum(approvedDepositsSum._sum.amount);
  const totalApprovedWithdrawals = decimalSum(approvedWithdrawalsSum._sum.amount);

  const pendingBankReviews =
    bank.pendingAccounts +
    bank.pendingDeposits +
    bank.pendingWithdrawals +
    pendingUserReviews;

  return {
    totalUsers,
    totalCompanies,
    verifiedCompanies,
    pendingCompanyVerifications,
    totalBankAccounts: bank.totalAccounts,
    activeBankAccounts: bank.activeAccounts,
    pendingBankAccounts: bank.pendingAccounts,
    totalBankDeposits: bank.totalDepositsHeld,
    totalBusinessAccounts: bank.totalBusinessOperatingAccounts,
    totalPersonalAccounts: bank.totalPersonalAccounts,
    pendingDepositRequests: bank.pendingDeposits,
    pendingWithdrawalRequests: bank.pendingWithdrawals,
    pendingBankReviews,
    totalBankTransactionVolume: totalApprovedDeposits + totalApprovedWithdrawals,
    totalApprovedDeposits,
    totalApprovedWithdrawals,
    frozenBankAccounts: bank.frozenAccounts,
    authorizedRepresentatives,
  };
}
