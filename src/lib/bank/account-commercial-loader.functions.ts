import { createServerFn } from "@tanstack/react-start";

export const fetchAccountCommercialLayout = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { resolveBusinessAccountContext } = await import(
      "@/server/business-account-context.service"
    );
    const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");
    const { loadCommercialPlanSettings, canAccessCommercialPayroll } = await import(
      "@/server/commercial-plan.service"
    );
    const { getBusinessModuleAccess } = await import("@/lib/bank/business-account-access");

    const user = await requireAuth();
    const accountContext = await resolveBusinessAccountContext(user, accountId);
    const roleCanPayroll = getBusinessModuleAccess(accountContext.role, "payroll") !== "none";
    let planHasPayroll = false;
    if (roleCanPayroll) {
      try {
        const plan = await loadCommercialPlanSettings(accountContext.companyId);
        planHasPayroll = canAccessCommercialPayroll(plan);
      } catch {
        planHasPayroll = false;
      }
    }
    const showPayroll = roleCanPayroll && planHasPayroll;

    let context = null;
    try {
      const commercial = await resolveCommercialBankingContext(user, accountContext.companyId);
      context = { ...commercial, accountId };
    } catch {
      // Merchant commercial access not available for this user.
    }

    if (!context && !showPayroll) {
      throw new Error("FORBIDDEN");
    }

    return {
      accountContext,
      context,
      showPayroll,
      showMerchant: context !== null,
    };
  });

export const fetchAccountCommercialContext = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { resolveBusinessAccountContext } = await import(
      "@/server/business-account-context.service"
    );
    const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");

    const user = await requireAuth();
    const accountContext = await resolveBusinessAccountContext(user, accountId);
    const context = await resolveCommercialBankingContext(user, accountContext.companyId);

    return {
      accountContext,
      context: { ...context, accountId },
    };
  });
