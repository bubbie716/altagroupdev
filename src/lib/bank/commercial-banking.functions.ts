import { createServerFn } from "@tanstack/react-start";
import type {
  CommercialFeatureKey,
  CommercialPlanStatus,
  CommercialBillingStatus,
  MerchantAnalyticsRange,
} from "@/lib/bank/commercial-banking-types";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchCommercialBankingContext = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");
    const user = await actor();
    return resolveCommercialBankingContext(user, companyId);
  });

export const fetchCommercialDashboard = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCommercialDashboard } = await import("@/server/merchant-analytics.service");
    const user = await actor();
    return getCommercialDashboard(user, companyId);
  });

export const fetchMerchantAnalytics = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; range?: MerchantAnalyticsRange }) => input)
  .handler(async ({ data }) => {
    const { getMerchantAnalytics } = await import("@/server/merchant-analytics.service");
    const user = await actor();
    return getMerchantAnalytics(user, data.companyId, data.range ?? "30D");
  });

export const fetchBasicMerchantAnalytics = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getBasicMerchantAnalytics } = await import("@/server/merchant-analytics.service");
    const user = await actor();
    return getBasicMerchantAnalytics(user, companyId);
  });

export const fetchCommercialSettings = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const {
      loadCommercialPlanSettings,
      canManageCommercialPlan,
      canPurchaseCommercialPro,
      resolveCommercialBankingContext,
    } = await import("@/server/commercial-plan.service");
    const { canManageCommercialBillingAccount, canDowngradeCommercialPro } = await import(
      "@/server/commercial-billing.service"
    );
    const { getCommercialUsageSummary } = await import("@/server/commercial-limits.service");
    const { DEFAULT_COMMERCIAL_FEATURES } = await import("@/lib/bank/commercial-banking-types");
    const { prisma } = await import("@/server/db");
    const user = await actor();
    const ctx = await resolveCommercialBankingContext(user, companyId);
    const plan = await loadCommercialPlanSettings(companyId);
    const usage = await getCommercialUsageSummary(companyId);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        commercialBillingAccountId: true,
        commercialNextBillingAt: true,
        commercialPastDueAt: true,
        commercialProSubscribedAt: true,
        commercialProGrantSource: true,
        commercialProExpiresAt: true,
      },
    });

    return {
      companyId: ctx.companyId,
      companyName: ctx.companyName,
      canManagePlan: canManageCommercialPlan(user, companyId),
      canPurchasePro: canPurchaseCommercialPro(user, companyId),
      canDowngradePro: canDowngradeCommercialPro(user, companyId),
      canManageBillingAccount: canManageCommercialBillingAccount(user, companyId),
      planFeatures: DEFAULT_COMMERCIAL_FEATURES[plan.commercialPlan],
      billingAccountId: company?.commercialBillingAccountId ?? null,
      nextBillingAt: company?.commercialNextBillingAt?.toISOString() ?? null,
      pastDueAt: company?.commercialPastDueAt?.toISOString() ?? null,
      proSubscribedAt: company?.commercialProSubscribedAt?.toISOString() ?? null,
      grantSource: company?.commercialProGrantSource ?? null,
      expiresAt: company?.commercialProExpiresAt?.toISOString() ?? null,
      usage: {
        invoicesThisMonth: usage.invoicesThisMonth,
        paymentLinksThisMonth: usage.paymentLinksThisMonth,
        teamMembers: usage.teamMembers,
        limits: {
          coreInvoiceMonthlyLimit: usage.limits.coreInvoiceMonthlyLimit,
          corePaymentLinkMonthlyLimit: usage.limits.corePaymentLinkMonthlyLimit,
          coreTeamMemberLimit: usage.limits.coreTeamMemberLimit,
        },
        isPro: usage.isPro,
      },
      ...plan,
    };
  });

export const fetchCommercialBillingAccounts = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { listCommercialBillingAccounts } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return listCommercialBillingAccounts(user, companyId);
  });

export const fetchCommercialBillingPreview = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; billingAccountId?: string }) => input)
  .handler(async ({ data }) => {
    const { getCommercialBillingPreview } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return getCommercialBillingPreview(user, data.companyId, data.billingAccountId);
  });

export const purchaseCommercialProPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; billingAccountId: string }) => input)
  .handler(async ({ data }) => {
    const { purchaseCommercialPro } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return purchaseCommercialPro(user, data);
  });

export const fetchCommercialDowngradePreview = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCommercialDowngradePreview } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return getCommercialDowngradePreview(user, companyId);
  });

export const downgradeCommercialProPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string }) => input)
  .handler(async ({ data }) => {
    const { downgradeCommercialProByCustomer } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return downgradeCommercialProByCustomer(user, data);
  });

export const updateCommercialBillingAccountFn = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; billingAccountId: string }) => input)
  .handler(async ({ data }) => {
    const { updateCommercialBillingAccount } = await import("@/server/commercial-billing.service");
    const user = await actor();
    return updateCommercialBillingAccount(user, data);
  });

export const updateCommercialSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      companyId: string;
      planStatus?: CommercialPlanStatus;
      billingStatus?: CommercialBillingStatus;
      enabledFeatures?: CommercialFeatureKey[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { updateCommercialPlanSettings, canManageCommercialPlan } = await import(
      "@/server/commercial-plan.service"
    );
    const user = await actor();
    if (!canManageCommercialPlan(user, data.companyId)) throw new Error("FORBIDDEN");
    return updateCommercialPlanSettings(user.id, data.companyId, data);
  });

export const resolveCommercialCompanyContext = createServerFn({ method: "GET" })
  .inputValidator((companyId: string | undefined) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getBusinessBankingOverview } = await import("@/server/business-banking.service");
    const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");
    const { resolveOperatingAccountIdForCompany } = await import(
      "@/server/business-account-context.service"
    );
    const user = await actor();
    const overview = await getBusinessBankingOverview(user, companyId);
    const activeCompanyId =
      companyId ?? overview.selectedCompanyId ?? overview.companies[0]?.companyId;
    if (!activeCompanyId) return null;

    let accountId: string | null = null;
    try {
      accountId = await resolveOperatingAccountIdForCompany(user, activeCompanyId);
    } catch {
      accountId = null;
    }

    const context = await resolveCommercialBankingContext(user, activeCompanyId);
    return { ...context, accountId: accountId ?? context.accountId };
  });
