import { createServerFn } from "@tanstack/react-start";
import type { CommercialBankingContext } from "@/lib/bank/commercial-banking-types";

export type AccountCommercialRouteContext = CommercialBankingContext & { accountId: string };

export type AccountCommercialLayoutData = {
  accountContext: unknown;
  context: AccountCommercialRouteContext | null;
  showPayroll: boolean;
  showMerchant: boolean;
};

/** Read commercial context placed on the route tree by the commercial layout beforeLoad. */
export function requireCommercialFromRouteContext(context: {
  commercialLayout?: AccountCommercialLayoutData;
}): AccountCommercialRouteContext {
  const commercial = context.commercialLayout?.context ?? null;
  if (!commercial) {
    throw new Error("FORBIDDEN");
  }
  return commercial;
}

export const fetchAccountCommercialLayout = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }): Promise<AccountCommercialLayoutData> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessAccountContext, getUiLabCommercialContext } = await import(
        "@/lib/bank/ui-lab-commercial-fixtures"
      );
      const { requireAuth } = await import("@/server/auth.service");
      const user = await requireAuth();
      const accountContext = getUiLabBusinessAccountContext(accountId);
      if (!accountContext) throw new Error("FORBIDDEN");
      const commercial = getUiLabCommercialContext(user, accountContext.companyId);
      const showPayroll = accountContext.moduleAccess.payroll !== "none";
      if (!commercial && !showPayroll) throw new Error("FORBIDDEN");
      return {
        accountContext,
        context: commercial ? { ...commercial, accountId } : null,
        showPayroll,
        showMerchant: commercial !== null,
      };
    }

    const { requireAuth } = await import("@/server/auth.service");
    const { resolveBusinessAccountContext } = await import(
      "@/server/business-account-context.service"
    );
    const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");
    const { getBusinessModuleAccess } = await import("@/lib/bank/business-account-access");

    const user = await requireAuth();
    const accountContext = await resolveBusinessAccountContext(user, accountId);
    const roleCanPayroll = getBusinessModuleAccess(accountContext.role, "payroll") !== "none";
    // Allow Commercial layout for payroll role even on Core (upgrade preview), not only active Pro.
    const showPayroll = roleCanPayroll;

    let context: AccountCommercialRouteContext | null = null;
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
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessAccountContext, getUiLabCommercialContext } = await import(
        "@/lib/bank/ui-lab-commercial-fixtures"
      );
      const { requireAuth } = await import("@/server/auth.service");
      const user = await requireAuth();
      const accountContext = getUiLabBusinessAccountContext(accountId);
      if (!accountContext) throw new Error("FORBIDDEN");
      const context = getUiLabCommercialContext(user, accountContext.companyId);
      if (!context) throw new Error("FORBIDDEN");
      return { accountContext, context: { ...context, accountId } };
    }

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
