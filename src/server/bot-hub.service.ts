import type { AltaPrivateCustomerPageState } from "@/lib/bank/alta-private-types";
import type {
  UserBankAccount,
  UserBankSummary,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import { getCustomerAltaPrivatePageState } from "@/server/alta-private-invitation.service";
import { bankAccountAccessWhere, loadAltaUserOrThrow } from "@/server/bank-account-access.service";
import {
  getUserBankAccountDetail,
  getUserBankSummary,
  listUserBankAccounts,
  listUserRecentTransactions,
} from "@/server/bank.service";
import { getUserNotifications } from "@/server/notification.service";
import { prisma } from "@/server/db";

export type BotPendingRequest = {
  kind: "deposit" | "withdrawal";
  referenceCode: string;
  amount: number;
  statusLabel: string;
  accountName: string;
  createdAt: string;
};

export type BotRecentUpdate = {
  title: string;
  body: string;
  createdAt: string;
  linkUrl: string | null;
};

export type BotHubContext = {
  summary: UserBankSummary;
  accounts: UserBankAccount[];
  recentTransactions: UserBankTransaction[];
  privateState: AltaPrivateCustomerPageState;
  pendingRequests: BotPendingRequest[];
  recentUpdates: BotRecentUpdate[];
};

export async function listBotPendingRequests(userId: string): Promise<BotPendingRequest[]> {
  const user = await loadAltaUserOrThrow(userId);
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      status: "PENDING",
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
      bankAccount: bankAccountAccessWhere(user, "view"),
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      bankAccount: { select: { accountName: true } },
    },
  });

  return transactions.map((tx) => ({
    kind: tx.type === "DEPOSIT" ? "deposit" : "withdrawal",
    referenceCode: tx.referenceCode,
    amount: Number(tx.amount.toString()),
    statusLabel: "Pending review",
    accountName: tx.bankAccount.accountName,
    createdAt: tx.createdAt.toISOString(),
  }));
}

export async function listBotRecentUpdates(userId: string, limit = 3): Promise<BotRecentUpdate[]> {
  const { items } = await getUserNotifications(userId, limit);
  return items.map((item) => ({
    title: item.title,
    body: item.body.length > 140 ? `${item.body.slice(0, 137)}…` : item.body,
    createdAt: item.createdAt,
    linkUrl: item.linkUrl,
  }));
}

export async function getBotHubContext(userId: string): Promise<BotHubContext> {
  const [summary, accounts, recentTransactions, privateState, pendingRequests, recentUpdates] =
    await Promise.all([
      getUserBankSummary(userId),
      listUserBankAccounts(userId),
      listUserRecentTransactions(userId, 8),
      getCustomerAltaPrivatePageState(userId),
      listBotPendingRequests(userId),
      listBotRecentUpdates(userId, 3),
    ]);

  return {
    summary,
    accounts,
    recentTransactions,
    privateState,
    pendingRequests,
    recentUpdates,
  };
}

export async function getBotHubAccountDetail(userId: string, accountId: string) {
  return getUserBankAccountDetail(userId, accountId);
}

export function shouldShowAltaPrivateNav(state: AltaPrivateCustomerPageState): boolean {
  return state.kind === "member" || state.kind === "invited";
}
