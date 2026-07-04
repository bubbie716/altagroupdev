import type { CommercialPlan } from "@/lib/bank/commercial-banking-types";

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

export type CommercialSettingsBillingView = {
  billingAccountId: string | null;
  nextBillingAt: string | null;
  pastDueAt: string | null;
  proSubscribedAt: string | null;
  canPurchasePro: boolean;
  canManageBillingAccount: boolean;
  usage: {
    invoicesThisMonth: number;
    activePaymentLinks: number;
    teamMembers: number;
    limits: {
      coreInvoiceMonthlyLimit: number;
      coreActivePaymentLinkLimit: number;
      coreTeamMemberLimit: number;
    };
    isPro: boolean;
  };
};
