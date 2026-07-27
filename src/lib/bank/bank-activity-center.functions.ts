import { createServerFn } from "@tanstack/react-start";
import type { BankActivityCenterBundle } from "@/lib/bank/bank-activity-center-types";
import {
  mapAltaPaySchedule,
  mapTransferSchedule,
} from "@/lib/bank/bank-activity-center-types";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

/**
 * Authorized activity-center bundle for the signed-in user.
 * All rows are already scoped by existing service access rules.
 */
export const fetchBankActivityCenterBundle = createServerFn({ method: "GET" })
  .inputValidator((input?: { accountId?: string; transactionLimit?: number }) => input ?? {})
  .handler(async ({ data }): Promise<BankActivityCenterBundle> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBankAccounts, getUiLabBankAccountDetail } = await import(
        "@/lib/bank/ui-lab-commercial-fixtures"
      );
      const accounts = getUiLabBankAccounts();
      const scoped = data.accountId
        ? accounts.filter((account) => account.id === data.accountId)
        : accounts;
      const transactions = scoped.flatMap((account) => {
        const detail = getUiLabBankAccountDetail(account.id);
        return detail?.recentTransactions ?? [];
      });
      return {
        accounts: scoped,
        transactions,
        requests: [],
        scheduled: [],
        autopay: [],
      };
    }

    const user = await actor();
    const limit = data.transactionLimit ?? 80;

    const [
      { listUserBankAccounts, listUserRecentTransactionsForUser, listUserBankRequestsInProgressForUser },
      { listUserScheduledTransfers },
      { listAltaPaySchedules },
      { listMerchantAutopayApprovals },
    ] = await Promise.all([
      import("@/server/bank.service"),
      import("@/server/scheduled-transfer.service"),
      import("@/server/alta-pay-schedule.service"),
      import("@/server/merchant-autopay.service"),
    ]);

    const [accounts, transactions, depositRequests, withdrawalRequests, transferSchedules, altaPaySchedules, autopay] =
      await Promise.all([
        listUserBankAccounts(user.id),
        listUserRecentTransactionsForUser(user, limit),
        listUserBankRequestsInProgressForUser(user, "deposit"),
        listUserBankRequestsInProgressForUser(user, "withdrawal"),
        listUserScheduledTransfers(user, "intrabank"),
        listAltaPaySchedules(user),
        listMerchantAutopayApprovals(user),
      ]);

    let scopedAccounts = accounts;
    if (data.accountId) {
      const allowed = accounts.some((account) => account.id === data.accountId);
      if (!allowed) {
        return {
          accounts: [],
          transactions: [],
          requests: [],
          scheduled: [],
          autopay: [],
        };
      }
      scopedAccounts = accounts.filter((account) => account.id === data.accountId);
    }

    const accountIds = new Set(scopedAccounts.map((account) => account.id));
    const filterByAccount = <T extends { bankAccountId?: string | null }>(rows: T[]) =>
      data.accountId ? rows.filter((row) => row.bankAccountId && accountIds.has(row.bankAccountId)) : rows;

    const requests = [...depositRequests, ...withdrawalRequests]
      .filter((row) => !data.accountId || accountIds.has(row.bankAccountId))
      .sort((a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt));

    const accountLabelById = new Map(
      accounts.map((account) => [account.id, account.accountName] as const),
    );

    const scheduled = [
      ...transferSchedules.map((row) => {
        const mapped = mapTransferSchedule(row);
        return {
          ...mapped,
          fundingLabel: row.bankAccountId
            ? (accountLabelById.get(row.bankAccountId) ?? "Funding account")
            : "—",
        };
      }),
      ...altaPaySchedules.map(mapAltaPaySchedule),
    ]
      .filter((row) => !data.accountId || (row.bankAccountId && accountIds.has(row.bankAccountId)))
      .sort((a, b) => {
        const aTime = a.nextRunDate ? Date.parse(a.nextRunDate) : 0;
        const bTime = b.nextRunDate ? Date.parse(b.nextRunDate) : 0;
        return aTime - bTime;
      });

    const scopedAutopay = data.accountId
      ? autopay.filter(
          (row) =>
            row.fundingSource.kind === "bank_account" &&
            accountIds.has(row.fundingSource.accountId),
        )
      : autopay;

    return {
      accounts: scopedAccounts,
      transactions: filterByAccount(transactions),
      requests,
      scheduled,
      autopay: scopedAutopay,
    };
  });
