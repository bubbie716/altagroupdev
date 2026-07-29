import { createServerFn } from "@tanstack/react-start";
import type {
  AccountInterestBatchResult,
  AccountInterestOpsSummary,
  AccountInterestPreview,
  AccountInterestAccrualResult,
} from "@/lib/bank/account-interest-service";

export const fetchAccountInterestOps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const { getUiLabInternalInterestOps } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
    return getUiLabInternalInterestOps();
  }
  const { getAccountInterestOpsSummary } = await import("@/lib/bank/account-interest-service");
  return getAccountInterestOpsSummary();
});

export const previewAccountInterest = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }): Promise<AccountInterestPreview> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { previewInterestForAccount } = await import("@/lib/bank/account-interest-service");
    await requireOperator();
    return previewInterestForAccount(accountId);
  });

export const accrueAccountInterest = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data }): Promise<AccountInterestAccrualResult> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Interest posting is disabled in UI Lab.");
    }
    const { requireAdmin } = await import("@/server/permissions.service");
    const { accrueInterestForAccount } = await import("@/lib/bank/account-interest-service");
    const admin = await requireAdmin();
    return accrueInterestForAccount(data.accountId, admin.id);
  });

export const accrueAllDueAccountInterest = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountInterestBatchResult> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Interest posting is disabled in UI Lab.");
    }
    const { requireAdmin } = await import("@/server/permissions.service");
    const { accrueInterestForDueAccounts } = await import("@/lib/bank/account-interest-service");
    const admin = await requireAdmin();
    return accrueInterestForDueAccounts(admin.id);
  },
);

export type {
  AccountInterestOpsSummary,
  AccountInterestPreview,
  AccountInterestAccrualResult,
  AccountInterestBatchResult,
};
