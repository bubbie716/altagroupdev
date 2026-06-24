import { createServerFn } from "@tanstack/react-start";
import type { BusinessAccountModule } from "@/lib/bank/business-account-access";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchBusinessAccountContext = createServerFn({ method: "GET" })
  .validator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { resolveBusinessAccountContext } = await import("@/server/business-account-context.service");
    const user = await actor();
    return resolveBusinessAccountContext(user, accountId);
  });

export const fetchBusinessAccountContextForModule = createServerFn({ method: "GET" })
  .validator((input: { accountId: string; module: BusinessAccountModule }) => input)
  .handler(async ({ data }) => {
    const { assertBusinessAccountAccess } = await import("@/server/business-account-context.service");
    const user = await actor();
    return assertBusinessAccountAccess(user, data.accountId, data.module);
  });

export const resolveBusinessOperatingAccountRedirect = createServerFn({ method: "GET" })
  .validator((companyId: string | undefined) => companyId)
  .handler(async ({ data: companyId }) => {
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
