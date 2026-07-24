import type { PlatformMetrics } from "@/lib/metrics/platform-metrics";
import { LIVE_PLATFORM_SOURCE, PREVIEW_SOURCE } from "@/lib/metrics/platform-metrics";
import { florin } from "@/lib/bank/api";

export type GovernanceMetricItem = {
  label: string;
  value: string;
  helper?: string;
  sourceLabel?: string;
};

export function buildGovernancePlatformMetrics(
  metrics: PlatformMetrics,
): GovernanceMetricItem[] {
  return [
    {
      label: "Alta Bank N.V.",
      value: "Operational",
      helper: "Personal, business, and treasury banking.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Alta Terminal LLC",
      value: "In Development",
      helper:
        "Brokerage platform under development. Trading, execution, market data, and custody are not live pending external exchange connectivity.",
      sourceLabel: PREVIEW_SOURCE,
    },
    {
      label: "Company Registry",
      value: metrics.totalCompanies.toLocaleString(),
      helper: "Registered companies on Alta Group.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Verified Companies",
      value: metrics.verifiedCompanies.toLocaleString(),
      helper: "Companies with verified registry status.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Active Bank Accounts",
      value: metrics.activeBankAccounts.toLocaleString(),
      helper: "Open Alta Bank accounts across the platform.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Deposits Held",
      value: florin(metrics.totalBankDeposits),
      helper: "Aggregate balance on active bank accounts.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Pending Reviews",
      value: metrics.pendingBankReviews.toLocaleString(),
      helper: "Pending accounts, deposits, withdrawals, and user reviews.",
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
  ];
}

export function buildHomepagePlatformMetrics(
  metrics: PlatformMetrics,
): GovernanceMetricItem[] {
  return [
    {
      label: "Registered Users",
      value: metrics.totalUsers.toLocaleString(),
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Active Bank Accounts",
      value: metrics.activeBankAccounts.toLocaleString(),
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Verified Companies",
      value: metrics.verifiedCompanies.toLocaleString(),
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
    {
      label: "Deposits Held",
      value: florin(metrics.totalBankDeposits),
      sourceLabel: LIVE_PLATFORM_SOURCE,
    },
  ];
}

export function buildInternalOverviewMetrics(metrics: PlatformMetrics) {
  return {
    totalUsers: metrics.totalUsers,
    registeredCompanies: metrics.totalCompanies,
    verifiedInstitutions: metrics.verifiedCompanies,
    authorizedRepresentatives: metrics.authorizedRepresentatives,
    pendingCompanyReviews: metrics.pendingCompanyVerifications,
    activeBankAccounts: metrics.activeBankAccounts,
    pendingDeposits: metrics.pendingDepositRequests,
    pendingWithdrawals: metrics.pendingWithdrawalRequests,
    frozenAccounts: metrics.frozenBankAccounts,
    totalDepositsHeld: metrics.totalBankDeposits,
    pendingBankReviews: metrics.pendingBankReviews,
    businessAccounts: metrics.totalBusinessAccounts,
    personalAccounts: metrics.totalPersonalAccounts,
  };
}
