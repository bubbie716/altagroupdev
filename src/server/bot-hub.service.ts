import type { AltaPrivateCustomerPageState } from "@/lib/bank/alta-private-types";
import type {
  UserBankAccount,
  UserBankSummary,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import { getCustomerAltaPrivatePageState } from "@/server/alta-private-invitation.service";
import {
  getUserBankAccountDetail,
  getUserBankSummary,
  listUserBankAccounts,
  listUserRecentTransactions,
} from "@/server/bank.service";

export type BotHubContext = {
  summary: UserBankSummary;
  accounts: UserBankAccount[];
  recentTransactions: UserBankTransaction[];
  privateState: AltaPrivateCustomerPageState;
};

export async function getBotHubContext(userId: string): Promise<BotHubContext> {
  const [summary, accounts, recentTransactions, privateState] = await Promise.all([
    getUserBankSummary(userId),
    listUserBankAccounts(userId),
    listUserRecentTransactions(userId, 8),
    getCustomerAltaPrivatePageState(userId),
  ]);

  return {
    summary,
    accounts,
    recentTransactions,
    privateState,
  };
}

export async function getBotHubAccountDetail(userId: string, accountId: string) {
  return getUserBankAccountDetail(userId, accountId);
}

export function shouldShowAltaPrivateNav(state: AltaPrivateCustomerPageState): boolean {
  if (state.kind === "member" || state.kind === "invited") return true;
  if (state.kind === "aspirational" && state.eligible) return true;
  return false;
}
