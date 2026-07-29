import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";

export type RiskSignal = {
  id: string;
  label: string;
  count: number;
  to: string;
  search: Record<string, unknown>;
  hint: string;
};

/** Build active (nonzero) risk signals from the compliance snapshot. */
export function buildActiveRiskSignals(
  s: {
    frozenAccounts: number;
    restrictedUsers: number;
    frozenUsers: number;
    failedScheduledTransfers: number;
    deniedWithdrawalsLast30Days: number;
    largeAdjustmentsLast30Days: number;
  },
  siteKey: string,
): RiskSignal[] {
  const candidates: RiskSignal[] = [
    {
      id: "frozen-accounts",
      label: "Frozen bank accounts",
      count: s.frozenAccounts,
      to: "/internal/bank/accounts",
      search: withInternalSiteSearch({ status: "frozen" }, siteKey),
      hint: "Account workspace",
    },
    {
      id: "restricted-users",
      label: "Restricted users",
      count: s.restrictedUsers,
      to: "/internal/users",
      search: withInternalSiteSearch({ accountStatus: "restricted" }, siteKey),
      hint: "Customer workspace",
    },
    {
      id: "frozen-users",
      label: "Frozen users",
      count: s.frozenUsers,
      to: "/internal/users",
      search: withInternalSiteSearch({ accountStatus: "frozen" }, siteKey),
      hint: "Customer workspace",
    },
    {
      id: "failed-transfers",
      label: "Failed scheduled transfers",
      count: s.failedScheduledTransfers,
      to: "/internal/bank/scheduled",
      search: withInternalSiteSearch({}, siteKey),
      hint: "Scheduled transfers",
    },
    {
      id: "denied-withdrawals",
      label: "Denied withdrawals (30d)",
      count: s.deniedWithdrawalsLast30Days,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "money" as const, type: "withdrawal" as const },
        siteKey,
      ),
      hint: "Withdrawals inbox",
    },
    {
      id: "large-adjustments",
      label: "Large adjustments (30d)",
      count: s.largeAdjustmentsLast30Days,
      to: "/internal/audit",
      search: withInternalSiteSearch({ action: "ADJUSTMENT" }, siteKey),
      hint: "Filtered audit log",
    },
  ];
  return candidates.filter((c) => c.count > 0);
}
