import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

export type QueueAgingMetrics = {
  olderThan24Hours: number;
  olderThan72Hours: number;
};

function countOlderThan(dates: Date[], hours: number): number {
  const cutoff = Date.now() - hours * 3_600_000;
  return dates.filter((d) => d.getTime() <= cutoff).length;
}

export async function getQueueAgingMetrics(): Promise<QueueAgingMetrics> {
  await requireOperator();

  const [
    pendingDeposits,
    pendingWithdrawals,
    pendingAccounts,
    pendingLoanApps,
    pendingCompanies,
    pendingAltaCardApps,
    pendingAltaCardReviews,
  ] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { type: "DEPOSIT", status: "PENDING" },
      select: { createdAt: true },
    }),
    prisma.bankTransaction.findMany({
      where: { type: "WITHDRAWAL", status: "PENDING" },
      select: { createdAt: true },
    }),
    prisma.bankAccount.findMany({
      where: { status: "PENDING" },
      select: { createdAt: true },
    }),
    prisma.loanApplication.findMany({
      where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
      select: { createdAt: true },
    }),
    prisma.company.findMany({
      where: { verificationStatus: { in: ["UNVERIFIED", "PENDING"] } },
      select: { updatedAt: true },
    }),
    prisma.altaCardApplication.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"] } },
      select: { createdAt: true },
    }),
    prisma.altaCardReviewRequest.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFORMATION"] } },
      select: { createdAt: true },
    }),
  ]);

  const allDates = [
    ...pendingDeposits.map((r) => r.createdAt),
    ...pendingWithdrawals.map((r) => r.createdAt),
    ...pendingAccounts.map((r) => r.createdAt),
    ...pendingLoanApps.map((r) => r.createdAt),
    ...pendingCompanies.map((r) => r.updatedAt),
    ...pendingAltaCardApps.map((r) => r.createdAt),
    ...pendingAltaCardReviews.map((r) => r.createdAt),
  ];

  return {
    olderThan24Hours: countOlderThan(allDates, 24),
    olderThan72Hours: countOlderThan(allDates, 72),
  };
}
