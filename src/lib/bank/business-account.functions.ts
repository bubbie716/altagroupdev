import { createServerFn } from "@tanstack/react-start";
import type { BusinessAccountModule } from "@/lib/bank/business-account-access";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchBusinessAccountContext = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessAccountContext } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      const context = getUiLabBusinessAccountContext(accountId);
      if (!context) throw new Error("FORBIDDEN");
      return context;
    }
    const { resolveBusinessAccountContext } = await import("@/server/business-account-context.service");
    const user = await actor();
    return resolveBusinessAccountContext(user, accountId);
  });

export const fetchBusinessAccountContextForModule = createServerFn({ method: "GET" })
  .inputValidator((input: { accountId: string; module: BusinessAccountModule }) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessAccountContext } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      const context = getUiLabBusinessAccountContext(data.accountId, data.module);
      if (!context) throw new Error("FORBIDDEN");
      return context;
    }
    const { assertBusinessAccountAccess } = await import("@/server/business-account-context.service");
    const user = await actor();
    return assertBusinessAccountAccess(user, data.accountId, data.module);
  });

export const resolveBusinessOperatingAccountRedirect = createServerFn({ method: "GET" })
  .inputValidator((companyId: string | undefined) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessBankingOverview, resolveUiLabOperatingAccountId } = await import(
        "@/lib/bank/ui-lab-commercial-fixtures"
      );
      const overview = getUiLabBusinessBankingOverview(companyId);
      const id = overview.selectedCompanyId ?? overview.companies[0]?.companyId;
      if (!id) return null;
      const accountId = resolveUiLabOperatingAccountId(id);
      if (!accountId) return null;
      return { accountId, companyId: id };
    }
    const { getBusinessBankingOverview } = await import("@/server/business-banking.service");
    const { resolveOperatingAccountIdForCompany } = await import(
      "@/server/business-account-context.service"
    );
    const user = await actor();
    const overview = await getBusinessBankingOverview(user, companyId);
    const id = overview.selectedCompanyId ?? overview.companies[0]?.companyId;
    if (!id) return null;
    const accountId = await resolveOperatingAccountIdForCompany(user, id);
    return { accountId, companyId: id };
  });
