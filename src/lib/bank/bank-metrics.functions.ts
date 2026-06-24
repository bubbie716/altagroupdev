import { createServerFn } from "@tanstack/react-start";
import type { BankMetrics } from "@/lib/bank/bank-metrics";

const emptyBankMetrics: BankMetrics = {
  totalAccounts: 0,
  activeAccounts: 0,
  pendingAccounts: 0,
  frozenAccounts: 0,
  totalDepositsHeld: 0,
  totalBusinessOperatingAccounts: 0,
  totalPersonalAccounts: 0,
  pendingDeposits: 0,
  pendingWithdrawals: 0,
  monthlyTransactionVolume: 0,
  approvedDepositVolume: 0,
  approvedWithdrawalVolume: 0,
};

export const fetchBankMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { isDatabaseConfigured } = await import("@/server/db");
  if (!isDatabaseConfigured()) return emptyBankMetrics;

  try {
    const { getBankMetrics } = await import("@/server/bank-metrics.service");
    return getBankMetrics();
  } catch {
    return emptyBankMetrics;
  }
});
