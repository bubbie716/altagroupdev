export type CommercialPlan = "CORE" | "PRO";
export type CommercialPlanStatus = "ACTIVE" | "SUSPENDED" | "PENDING";
export type CommercialBillingStatus = "NOT_BILLED" | "CURRENT" | "PAST_DUE";

export type MerchantAnalyticsRange = "7D" | "30D" | "90D" | "YTD" | "ALL";

export const MERCHANT_ANALYTICS_RANGES: MerchantAnalyticsRange[] = [
  "7D",
  "30D",
  "90D",
  "YTD",
  "ALL",
];

export const MERCHANT_ANALYTICS_RANGE_LABELS: Record<MerchantAnalyticsRange, string> = {
  "7D": "7 days",
  "30D": "30 days",
  "90D": "90 days",
  YTD: "Year to date",
  ALL: "All time",
};

export type CommercialFeatureKey =
  | "invoices"
  | "payment_links"
  | "merchant_analytics"
  | "priority_support"
  | "payroll"
  | "invoice_branding";

export const COMMERCIAL_PLAN_LABELS: Record<CommercialPlan, string> = {
  CORE: "Core",
  PRO: "Pro",
};

export const COMMERCIAL_BILLING_STATUS_LABELS: Record<CommercialBillingStatus, string> = {
  NOT_BILLED: "Not billed",
  CURRENT: "Current",
  PAST_DUE: "Past due",
};

export const COMMERCIAL_FEATURE_LABELS: Record<CommercialFeatureKey, string> = {
  invoices: "Invoices",
  payment_links: "Payment links",
  merchant_analytics: "Advanced analytics",
  priority_support: "Priority support",
  payroll: "Payroll",
  invoice_branding: "Custom branding",
};

export const COMMERCIAL_PLAN_DESCRIPTIONS: Record<CommercialPlan, string> = {
  CORE: "Business banking, basic invoices, payment links, and basic analytics.",
  PRO: "Unlimited invoices and payment links, advanced analytics, payroll, custom branding, and priority support.",
};

/** Default Pro monthly fee in florins (platform settings may override). */
export const DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE = 10_000;

export const DEFAULT_COMMERCIAL_FEATURES: Record<CommercialPlan, CommercialFeatureKey[]> = {
  CORE: ["invoices", "payment_links"],
  PRO: [
    "invoices",
    "payment_links",
    "merchant_analytics",
    "priority_support",
    "payroll",
    "invoice_branding",
  ],
};

export type CommercialPlanSettings = {
  commercialPlan: CommercialPlan;
  planStatus: CommercialPlanStatus;
  billingStatus: CommercialBillingStatus;
  monthlyFee: number | null;
  enabledFeatures: CommercialFeatureKey[];
};

export function isCommercialProActive(plan: CommercialPlanSettings): boolean {
  return plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE";
}

export function canAccessCommercialPayroll(plan: CommercialPlanSettings): boolean {
  return isCommercialProActive(plan) && plan.enabledFeatures.includes("payroll");
}

export function canPublishInvoiceBranding(plan: CommercialPlanSettings): boolean {
  return isCommercialProActive(plan) && plan.enabledFeatures.includes("invoice_branding");
}

/** UI / loader classification for the Commercial payroll page. */
export type CommercialPayrollPageMode = "active" | "upgrade" | "forbidden" | "error";

export function classifyCommercialPayrollPageAccess(input: {
  roleCanAccessPayroll: boolean;
  plan: CommercialPlanSettings | null;
  errorMessage?: string | null;
}): { mode: CommercialPayrollPageMode; customerMessage: string | null } {
  const raw = (input.errorMessage ?? "").trim();
  if (raw === "FORBIDDEN" || raw.startsWith("FORBIDDEN")) {
    return {
      mode: "forbidden",
      customerMessage:
        "You do not have permission to view payroll for this business account. Ask a company owner or executive to update your role.",
    };
  }
  if (raw) {
    return {
      mode: "error",
      customerMessage:
        "Payroll could not be loaded right now. Refresh the page or try again in a few minutes.",
    };
  }
  if (!input.roleCanAccessPayroll) {
    return {
      mode: "forbidden",
      customerMessage:
        "You do not have permission to view payroll for this business account. Ask a company owner or executive to update your role.",
    };
  }
  if (!input.plan || !canAccessCommercialPayroll(input.plan)) {
    return { mode: "upgrade", customerMessage: null };
  }
  return { mode: "active", customerMessage: null };
}

export type CommercialBankingContext = {
  companyId: string;
  companyName: string;
  accountId: string | null;
  verificationStatus: "verified" | "pending" | "unverified" | "rejected";
  isVerified: boolean;
  canManage: boolean;
  canViewAnalytics: boolean;
  plan: CommercialPlanSettings;
};

export type CommercialMerchantActivityRow = {
  id: string;
  kind: "invoice" | "payment_link" | "invoice_payment" | "link_payment" | "alta_pay_payment";
  label: string;
  amount: number | null;
  status: string;
  referenceCode: string;
  createdAt: string;
};

export type CommercialDashboard = {
  cashBalance: number;
  outstandingInvoices: number;
  paidThisMonth: number;
  netReceiptsThisMonth: number;
  paymentLinkVolume: number;
  altaPayVolumeThisMonth: number;
  altaPayPaymentCountThisMonth: number;
  overdueInvoiceTotal: number;
  recentActivity: CommercialMerchantActivityRow[];
  invoiceDashboard: {
    outstandingTotal: number;
    paidThisMonth: number;
    overdueCount: number;
  };
  paymentLinkDashboard: {
    activeCount: number;
    totalCollected: number;
    paymentCount: number;
  };
};

export type MerchantAnalyticsTopCustomer = {
  customerLabel: string;
  paymentCount: number;
  grossVolume: number;
};

export type MerchantAnalyticsRecentPayment = {
  id: string;
  source: "invoice" | "payment_link" | "alta_pay";
  customerLabel: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  referenceCode: string;
  createdAt: string;
};

export type MerchantAnalyticsTrendPoint = {
  month: string;
  grossVolume: number;
  netVolume: number;
  invoiceRevenue: number;
  paymentLinkRevenue: number;
  altaPayRevenue: number;
};

export type MerchantAnalytics = {
  range: MerchantAnalyticsRange;
  grossVolume: number;
  netVolume: number;
  totalFees: number;
  invoiceRevenue: number;
  paymentLinkRevenue: number;
  altaPayRevenue: number;
  outstandingInvoiceTotal: number;
  overdueInvoiceTotal: number;
  paidInvoicesCount: number;
  averagePaymentSize: number;
  /**
   * Whole percentage points in [0, 100] (e.g. 97 = 97%).
   * Never a 0–1 fraction. See formatMerchantAnalyticsPercent.
   */
  paymentSuccessRate: number;
  /** Whole percentage points in [0, 100]. See paymentSuccessRate. */
  paymentFailureRate: number;
  successfulPayments: number;
  failedPayments: number;
  topCustomers: MerchantAnalyticsTopCustomer[];
  recentPayments: MerchantAnalyticsRecentPayment[];
  monthlyTrend: MerchantAnalyticsTrendPoint[];
};

export type CommercialSettingsView = CommercialPlanSettings & {
  companyId: string;
  companyName: string;
  canManagePlan: boolean;
  canPurchasePro: boolean;
  canDowngradePro: boolean;
  canManageBillingAccount: boolean;
  planFeatures: CommercialFeatureKey[];
  billingAccountId: string | null;
  nextBillingAt: string | null;
  pastDueAt: string | null;
  proSubscribedAt: string | null;
  downgradeScheduledAt: string | null;
  grantSource: "PURCHASED" | "ADMIN_GRANT" | null;
  expiresAt: string | null;
  usage: {
    invoicesThisMonth: number;
    paymentLinksThisMonth: number;
    teamMembers: number;
    limits: {
      coreInvoiceMonthlyLimit: number;
      corePaymentLinkMonthlyLimit: number;
      coreTeamMemberLimit: number;
    };
    isPro: boolean;
  };
};

export type BasicMerchantAnalytics = {
  revenueThisMonth: number;
  outstandingInvoiceTotal: number;
  recentPayments: MerchantAnalyticsRecentPayment[];
};
