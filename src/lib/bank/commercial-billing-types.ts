import type { CommercialPlan } from "@/lib/bank/commercial-banking-types";

export type CommercialDowngradePayrollRunPreview = {
  id: string;
  label: string;
  payDate: string;
  status: string;
  totalAmount: number;
  sourceAccountName: string;
  sourceAccountNumber: string;
  payouts: Array<{
    displayName: string;
    accountNumber: string;
    amount: number;
  }>;
};

export type CommercialDowngradePayrollEmployeePreview = {
  id: string;
  displayName: string;
  accountNumber: string;
  payAmount: number;
  nextPayDate: string | null;
};

export type CommercialDowngradeCleanupPreview = {
  payrollRunsCancelled: number;
  paymentLinksCancelled: number;
  invoicesCancelled: number;
  payrollRuns: CommercialDowngradePayrollRunPreview[];
  activePayrollEmployees: CommercialDowngradePayrollEmployeePreview[];
};

export type CommercialBillingAccountOption = {
  id: string;
  accountName: string;
  accountNumber: string;
  availableBalance: number;
};

export type CommercialBillingPreview = {
  companyId: string;
  companyName: string;
  currentPlan: CommercialPlan;
  targetPlan: "PRO";
  monthlyFee: number;
  billingAccount: CommercialBillingAccountOption | null;
  billingAccounts: CommercialBillingAccountOption[];
  nextBillingDate: string;
  canPurchase: boolean;
};

export type CommercialPurchaseResult = {
  commercialPlan: "PRO";
  billingStatus: "CURRENT";
  monthlyFee: number;
  billingAccountId: string;
  nextBillingAt: string;
  transactionId: string;
  referenceCode: string;
};

export type CommercialDowngradeMode = "period_end" | "immediate";

export type CommercialDowngradePreview = {
  companyId: string;
  companyName: string;
  currentPlan: "PRO";
  targetPlan: "CORE";
  grantSource: "PURCHASED" | "ADMIN_GRANT" | null;
  monthlyFee: number | null;
  canDowngrade: boolean;
  periodEndAt: string | null;
  downgradeAlreadyScheduled: boolean;
  scheduledDowngradeAt: string | null;
  cleanup: CommercialDowngradeCleanupPreview;
  coreLimits: {
    coreInvoiceMonthlyLimit: number;
    corePaymentLinkMonthlyLimit: number;
    coreTeamMemberLimit: number;
  };
};

export type CommercialDowngradeResult = {
  companyId: string;
  companyName: string;
  commercialPlan: "CORE" | "PRO";
  mode: CommercialDowngradeMode;
  effectiveAt: string;
  cleanup: CommercialDowngradeCleanupPreview;
};

export type CommercialDowngradeInput = {
  companyId: string;
  mode?: CommercialDowngradeMode;
  acknowledgeImmediateCleanup?: boolean;
};

export type AdminCommercialProGrantResult = {
  companyId: string;
  companyName: string;
  monthsGranted: number;
  expiresAt: string;
  memberCount: number;
};

export type AdminCommercialDowngradeResult = {
  companyId: string;
  companyName: string;
  memberCount: number;
};

export type CommercialSettingsBillingView = {
  billingAccountId: string | null;
  nextBillingAt: string | null;
  pastDueAt: string | null;
  proSubscribedAt: string | null;
  downgradeScheduledAt: string | null;
  canPurchasePro: boolean;
  canManageBillingAccount: boolean;
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
