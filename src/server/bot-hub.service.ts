import type { AltaPrivateCustomerPageState } from "@/lib/bank/alta-private-types";
import type {
  UserBankAccount,
  UserBankSummary,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import type { NotificationRow } from "@/server/notification.service";
import { getCustomerAltaPrivatePageState } from "@/server/alta-private-invitation.service";
import {
  getUserBankAccountDetail,
  getUserBankSummary,
  listUserBankAccounts,
  listUserRecentTransactions,
} from "@/server/bank.service";
import { getUserNotifications } from "@/server/notification.service";

export type BotHubContext = {
  summary: UserBankSummary;
  accounts: UserBankAccount[];
  recentTransactions: UserBankTransaction[];
  notifications: { items: NotificationRow[]; unreadCount: number };
  privateState: AltaPrivateCustomerPageState;
};

export async function getBotHubContext(userId: string): Promise<BotHubContext> {
  const [summary, accounts, recentTransactions, notifications, privateState] = await Promise.all([
    getUserBankSummary(userId),
    listUserBankAccounts(userId),
    listUserRecentTransactions(userId, 8),
    getUserNotifications(userId, 12),
    getCustomerAltaPrivatePageState(userId),
  ]);

  return {
    summary,
    accounts,
    recentTransactions,
    notifications,
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
