import { createServerFn } from "@tanstack/react-start";
import type {
  AccountInterestBatchResult,
  AccountInterestOpsSummary,
  AccountInterestPreview,
  AccountInterestAccrualResult,
} from "@/lib/bank/account-interest-service";

export const fetchAccountInterestOps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { getAccountInterestOpsSummary } = await import("@/lib/bank/account-interest-service");
  await requireOperator();
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
    const { requireAdmin } = await import("@/server/permissions.service");
    const { accrueInterestForAccount } = await import("@/lib/bank/account-interest-service");
    const admin = await requireAdmin();
    return accrueInterestForAccount(data.accountId, admin.id);
  });

export const accrueAllDueAccountInterest = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountInterestBatchResult> => {
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
