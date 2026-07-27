export type CommercialSubscriptionChargeHistoryRow = {
  id: string;
  chargeType: "INITIAL_PURCHASE" | "MONTHLY_RENEWAL";
  chargeTypeLabel: string;
  billingPeriod: string;
  billingPeriodLabel: string;
  amount: number;
  status: "SUCCEEDED" | "FAILED" | "PENDING";
  statusLabel: string;
  createdAt: string;
  referenceCode: string | null;
  billingAccountId: string;
  billingAccountName: string;
  billingAccountNumber: string;
  /** Customer-safe failure copy only; never stack traces or provider details. */
  failureReason: string | null;
};

export type CommercialSubscriptionBillingHistory = {
  companyId: string;
  nextBillingAt: string | null;
  charges: CommercialSubscriptionChargeHistoryRow[];
};

export const COMMERCIAL_CHARGE_TYPE_LABELS: Record<
  CommercialSubscriptionChargeHistoryRow["chargeType"],
  string
> = {
  INITIAL_PURCHASE: "Initial purchase",
  MONTHLY_RENEWAL: "Monthly renewal",
};

export const COMMERCIAL_CHARGE_STATUS_LABELS: Record<
  CommercialSubscriptionChargeHistoryRow["status"],
  string
> = {
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  PENDING: "Pending",
};

export function formatCommercialBillingPeriodLabel(billingPeriod: string): string {
  if (!billingPeriod || billingPeriod === "initial" || billingPeriod.endsWith(":initial")) {
    return "Initial purchase";
  }
  const dayKey = billingPeriod.includes(":")
    ? billingPeriod.slice(billingPeriod.lastIndexOf(":") + 1)
    : billingPeriod;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const start = new Date(`${dayKey}T12:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }
  return billingPeriod;
}
