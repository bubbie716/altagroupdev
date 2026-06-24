import { createServerFn } from "@tanstack/react-start";
import type { PlatformMetrics } from "@/lib/metrics/platform-metrics";

const emptyMetrics: PlatformMetrics = {
  totalUsers: 0,
  totalCompanies: 0,
  verifiedCompanies: 0,
  pendingCompanyVerifications: 0,
  totalBankAccounts: 0,
  activeBankAccounts: 0,
  pendingBankAccounts: 0,
  totalBankDeposits: 0,
  totalBusinessAccounts: 0,
  totalPersonalAccounts: 0,
  pendingDepositRequests: 0,
  pendingWithdrawalRequests: 0,
  pendingBankReviews: 0,
  totalBankTransactionVolume: 0,
  totalApprovedDeposits: 0,
  totalApprovedWithdrawals: 0,
  frozenBankAccounts: 0,
  authorizedRepresentatives: 0,
};

export const fetchPlatformMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { isDatabaseConfigured } = await import("@/server/db");
  if (!isDatabaseConfigured()) return emptyMetrics;

  try {
    const { queryPlatformMetrics } = await import("@/server/platform-metrics.service");
    return queryPlatformMetrics();
  } catch {
    return emptyMetrics;
  }
});
