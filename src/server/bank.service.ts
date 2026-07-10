import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  AdminAccountAdjustmentInput,
  InternalBankAccountDetail,
  InternalBankAccountFilters,
  InternalBankAccountRow,
  InternalBankOpsSummary,
  InternalBankTransactionRow,
  OpenBankAccountInput,
  OpenBankAccountResult,
  SubmitDepositInput,
  SubmitInternalTransferInput,
  SubmitWithdrawalInput,
  BankProofInput,
  BankRequestInProgress,
  UserBankAccount,
  UserBankAccountDetail,
  UserBankDashboard,
  UserBankSummary,
  UserBankTransaction,
  UserBankTransfer,
} from "@/lib/bank/backend-types";
import { generateAccountNumber, isValidAltaAccountNumber } from "@/lib/bank/account-number";
import { getRoutingNumber } from "@/lib/bank/routing";
import {
  countsTowardMoneyMarketCard,
  countsTowardPrivateBankCard,
  countsTowardSavingsCard,
} from "@/lib/bank/dashboard-balances";
import {
  formatBankAccountTypeLabel,
  getBankAccountTypeOptionsForOpening,
  isInstantApprovalAccountType,
  isPrivateBankingAccountType,
} from "@/lib/bank/backend-types";
import { formatBankAccountOpenedCopy } from "@/lib/bank/relationship-timeline-customer-copy";
import { getProofFileUrl, hasStoredProof } from "@/lib/storage/proof-upload.constants";
import {
  creditAdjustmentDescription,
  debitAdjustmentDescription,
  DEPOSIT_APPROVED_DESCRIPTION,
  DEPOSIT_DECLINED_DESCRIPTION,
  DEPOSIT_PENDING_DESCRIPTION,
  transferFromDescription,
  transferToDescription,
  WITHDRAWAL_APPROVED_DESCRIPTION,
  WITHDRAWAL_DECLINED_DESCRIPTION,
  WITHDRAWAL_PENDING_DESCRIPTION,
} from "@/lib/bank/customer-transaction-copy";
import { buildCustomerAccountStatus } from "@/lib/bank/account-status-copy";
import {
  formatBankRequestDenialMessage,
  formatBankRequestDisplayStatus,
} from "@/lib/bank/bank-request-status-copy";
import type { BankingStaffAuditContext } from "@/lib/staff-audit/staff-audit-types";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { isPrivateClient, canManageBusinessTreasury } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import {
  bankAccountAccessWhere,
  isBankAccountAccessibleByUser,
  loadAltaUserOrThrow,
} from "@/server/bank-account-access.service";
import {
  fromDbBankTransactionStatus,
  mapInternalBankAccountRow,
  mapInternalBankTransactionRow,
  mapUserBankAccount,
  mapUserBankTransaction,
  toDbBankAccountType,
} from "@/server/bank-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { isAdmin } from "@/lib/auth/permissions";
import { requireOperator } from "@/server/permissions.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function notifyIncomingTransferBestEffort(
  senderUserId: string,
  toAccount: { userId: string; companyId: string | null; accountName: string },
  amount: number,
  referenceCode: string,
): Promise<void> {
  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { discordUsername: true, minecraftUsername: true },
  });
  const senderName = sender?.minecraftUsername?.trim() || sender?.discordUsername || "An Alta customer";

  const { notifyTransferReceived, notifyTransferReceivedToCompany } = await import(
    "@/server/banking-notification.service"
  );

  if (toAccount.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: toAccount.companyId },
      select: { name: true },
    });
    if (!company) return;
    await notifyTransferReceivedToCompany({
      companyId: toAccount.companyId,
      companyName: company.name,
      amount,
      referenceCode,
      senderName,
      toAccountName: toAccount.accountName,
    });
    return;
  }

  if (toAccount.userId === senderUserId) return;

  await notifyTransferReceived(
    toAccount.userId,
    amount,
    referenceCode,
    senderName,
    toAccount.accountName,
  );
}

function decimalToNumber(value: { toNumber(): number }): number {
  return value.toNumber();
}

async function generateUniqueAccountNumber(
  accountType: OpenBankAccountInput["accountType"],
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const accountNumber = generateAccountNumber(accountType);
    const existing = await prisma.bankAccount.findUnique({ where: { accountNumber } });
    if (!existing) return accountNumber;
  }
  throw new Error("ACCOUNT_NUMBER_GENERATION_FAILED");
}

function generateReferenceCode(type: "DEP" | "WDR" | "TRF" | "PVR"): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${type}-${date}-${suffix}`;
}

async function getAvailableBalance(accountId: string): Promise<number> {
  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  return getAccountAvailableBalance(accountId);
}

function proofData(proof: BankProofInput) {
  return {
    proofImageUrl: proof.proofImageUrl,
    proofFileName: proof.proofFileName,
    proofMimeType: proof.proofMimeType,
    proofSizeBytes: proof.proofSizeBytes,
    proofUploadedAt: proof.proofUploadedAt,
  };
}

function initialAccountStatus(
  accountType: OpenBankAccountInput["accountType"],
  companyVerificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED",
  privateClient = false,
): "PENDING" | "ACTIVE" {
  if (accountType === "business_operating") {
    return companyVerificationStatus === "VERIFIED" ? "ACTIVE" : "PENDING";
  }
  if (privateClient && isPrivateBankingAccountType(accountType)) {
    return "ACTIVE";
  }
  return isInstantApprovalAccountType(accountType) ? "ACTIVE" : "PENDING";
}

async function requireAccessibleAccount(
  accountId: string,
  userId: string,
  access: "view" | "manage" = "view",
) {
  const user = await loadAltaUserOrThrow(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...bankAccountAccessWhere(user, access) },
    include: {
      company: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!account) forbidden();
  return account;
}

export async function isAccountAccessibleByUser(accountId: string, userId: string): Promise<boolean> {
  return isBankAccountAccessibleByUser(userId, accountId, "view");
}

export function normalizeAccountNumber(input: string): string {
  return input.trim().toUpperCase();
}

const accountInclude = {
  company: true,
  transactions: {
    where: { status: { not: "PENDING" as const } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

export async function listUserBankAccounts(userId: string): Promise<UserBankAccount[]> {
  const user = await loadAltaUserOrThrow(userId);
  return listUserBankAccountsForUser(user);
}

export async function listUserBankAccountsForUser(user: AltaUser): Promise<UserBankAccount[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: bankAccountAccessWhere(user, "view"),
    include: accountInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const {
    getActiveHoldsByAccountIds,
    getPendingWithdrawalsByAccountIds,
    computeAvailableBalance,
  } = await import("@/server/account-balance.service");
  const [holdsByAccount, pendingByAccount] = await Promise.all([
    getActiveHoldsByAccountIds(accountIds),
    getPendingWithdrawalsByAccountIds(accountIds),
  ]);

  return accounts.map((account) => {
    const mapped = mapUserBankAccount(account);
    const holds = holdsByAccount.get(account.id) ?? 0;
    const pending = pendingByAccount.get(account.id) ?? 0;
    const availableBalance = computeAvailableBalance(mapped.balance, pending, holds);
    const accountStatusInfo = buildCustomerAccountStatus({
      status: mapped.status,
      restrictDeposits: mapped.restrictDeposits,
      restrictWithdrawals: mapped.restrictWithdrawals,
      restrictTransfers: mapped.restrictTransfers,
      heldFunds: holds,
      pendingWithdrawals: pending,
    });
    return {
      ...mapped,
      availableBalance,
      accountStatusInfo,
    };
  });
}

function buildUserBankDashboardMetrics(
  user: AltaUser,
  accounts: UserBankAccount[],
): UserBankDashboard {
  let checkingBalance = 0;
  let savingsBalance = 0;
  let privateBalance = 0;
  let moneyMarketBalance = 0;
  let businessBalance = 0;
  let totalRelationshipValue = 0;

  for (const account of accounts) {
    if (account.status !== "active") continue;
    totalRelationshipValue += account.balance;
    if (account.accountType === "checking" || account.accountType === "alta_access") {
      checkingBalance += account.balance;
    }
    if (countsTowardSavingsCard(account)) savingsBalance += account.balance;
    if (countsTowardPrivateBankCard(account)) privateBalance += account.balance;
    if (countsTowardMoneyMarketCard(account)) moneyMarketBalance += account.balance;
    if (account.accountType === "business_operating") businessBalance += account.balance;
  }

  const enrolledInPrivate = isPrivateClient(user);

  return {
    totalRelationshipValue,
    checkingBalance,
    savingsBalance,
    privateBalance,
    moneyMarketBalance,
    businessBalance,
    creditAvailable: 0,
    privateStatus: enrolledInPrivate ? "Alta Private Client" : "Not enrolled",
    enrolledInPrivate,
    accountCount: accounts.length,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  };
}

async function resolvePrivateDashboardStatus(user: AltaUser): Promise<string> {
  if (isPrivateClient(user)) return "Alta Private Client";
  const { countPendingAltaPrivateInvitations } = await import(
    "@/server/alta-private-invitation.service"
  );
  const pending = await countPendingAltaPrivateInvitations(user.id);
  if (pending > 0) return "Invitation pending";
  return "Not enrolled";
}

export async function getUserBankDashboardFromAccounts(
  user: AltaUser,
  accounts: UserBankAccount[],
): Promise<UserBankDashboard> {
  const [pendingDeposits, pendingWithdrawals] = await Promise.all([
    prisma.bankTransaction.count({
      where: {
        type: "DEPOSIT",
        status: "PENDING",
        bankAccount: bankAccountAccessWhere(user, "view"),
      },
    }),
    prisma.bankTransaction.count({
      where: {
        type: "WITHDRAWAL",
        status: "PENDING",
        bankAccount: bankAccountAccessWhere(user, "view"),
      },
    }),
  ]);

  return {
    ...buildUserBankDashboardMetrics(user, accounts),
    privateStatus: await resolvePrivateDashboardStatus(user),
    pendingDeposits,
    pendingWithdrawals,
  };
}

export async function getUserBankDashboardBundle(userId: string): Promise<{
  dashboard: UserBankDashboard;
  accounts: UserBankAccount[];
  transactions: UserBankTransaction[];
}> {
  const user = await loadAltaUserOrThrow(userId);
  const [accounts, transactions] = await Promise.all([
    listUserBankAccountsForUser(user),
    listUserRecentTransactionsForUser(user, 10),
  ]);
  const dashboard = await getUserBankDashboardFromAccounts(user, accounts);
  return { dashboard, accounts, transactions };
}

export async function getUserBankAccountDetail(
  userId: string,
  accountId: string,
): Promise<UserBankAccountDetail> {
  const account = await requireAccessibleAccount(accountId, userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordUsername: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const recentTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: accountId,
      status: { not: "PENDING" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      bankAccount: {
        include: {
          user: { select: { discordUsername: true } },
          company: true,
        },
      },
    },
  });

  const monthTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: accountId,
      status: "APPROVED",
      createdAt: { gte: monthStart },
    },
  });

  let depositsThisMonth = 0;
  let withdrawalsThisMonth = 0;
  for (const tx of monthTransactions) {
    const amount = decimalToNumber(tx.amount);
    if (tx.type === "DEPOSIT" || tx.type === "INTEREST_CREDIT") depositsThisMonth += amount;
    if (tx.type === "WITHDRAWAL" || tx.type === "LOAN_PAYMENT" || tx.type === "INTEREST_CHARGE") {
      withdrawalsThisMonth += amount;
    }
  }

  const balance = decimalToNumber(account.balance);
  const { getAccountAvailableBalance, getActiveHoldTotal, getPendingWithdrawalTotal } = await import(
    "@/server/account-balance.service"
  );
  const [availableBalance, heldFunds, pendingWithdrawals] = await Promise.all([
    getAccountAvailableBalance(accountId),
    getActiveHoldTotal(accountId),
    getPendingWithdrawalTotal(accountId),
  ]);
  const summary = mapUserBankAccount({
    ...account,
    transactions: recentTransactions.slice(0, 1),
  });
  const accountStatusInfo = buildCustomerAccountStatus({
    status: summary.status,
    restrictDeposits: summary.restrictDeposits,
    restrictWithdrawals: summary.restrictWithdrawals,
    restrictTransfers: summary.restrictTransfers,
    heldFunds,
    pendingWithdrawals,
  });

  const { buildAccountInterestInfo } = await import("@/lib/bank/account-interest-service");
  const lastInterestCredit = await prisma.bankTransaction.findFirst({
    where: {
      bankAccountId: accountId,
      type: "INTEREST_CREDIT",
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, amount: true },
  });
  const interestInfo = buildAccountInterestInfo(account, lastInterestCredit);

  const ownerLabel = account.company?.name ?? user?.discordUsername ?? "Personal";

  return {
    ...summary,
    ownerLabel,
    depositsThisMonth,
    withdrawalsThisMonth,
    netChangeThisMonth: depositsThisMonth - withdrawalsThisMonth,
    availableBalance,
    accountStatusInfo,
    recentTransactions: recentTransactions.map(mapUserBankTransaction),
    interestInfo,
  };
}

export async function listActiveDepositAccounts(userId: string): Promise<UserBankAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts.filter((a) => a.status === "active");
}

export async function getUserBankDashboard(userId: string): Promise<UserBankDashboard> {
  const user = await loadAltaUserOrThrow(userId);
  const accounts = await listUserBankAccountsForUser(user);
  return getUserBankDashboardFromAccounts(user, accounts);
}

export async function getUserBankSummary(userId: string): Promise<UserBankSummary> {
  const accounts = await listUserBankAccounts(userId);
  const user = await loadAltaUserOrThrow(userId);

  const [pendingDepositCount, pendingWithdrawalCount] = await Promise.all([
    prisma.bankTransaction.count({
      where: { type: "DEPOSIT", status: "PENDING", bankAccount: bankAccountAccessWhere(user, "view") },
    }),
    prisma.bankTransaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING", bankAccount: bankAccountAccessWhere(user, "view") },
    }),
  ]);

  return summarizeBankAccounts(accounts, pendingDepositCount, pendingWithdrawalCount);
}

function summarizeBankAccounts(
  accounts: UserBankAccount[],
  pendingDepositCount: number,
  pendingWithdrawalCount: number,
): UserBankSummary {
  return {
    totalBalance: accounts.filter((a) => a.status === "active").reduce((sum, a) => sum + a.balance, 0),
    activeAccountCount: accounts.filter((a) => a.status === "active").length,
    pendingAccountCount: accounts.filter((a) => a.status === "pending").length,
    pendingDepositCount,
    pendingWithdrawalCount,
  };
}

export async function getCompanyBankSummary(companyId: string, userId: string): Promise<UserBankSummary> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) {
    throw new Error("FORBIDDEN");
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId, accountType: "BUSINESS_OPERATING" },
  });
  const mapped = accounts.map((account) => mapUserBankAccount(account));
  const accountIds = accounts.map((account) => account.id);

  const pendingWhere =
    accountIds.length > 0
      ? { bankAccountId: { in: accountIds } }
      : { bankAccountId: { in: ["__none__"] } };

  const [pendingDepositCount, pendingWithdrawalCount] = await Promise.all([
    prisma.bankTransaction.count({
      where: { type: "DEPOSIT", status: "PENDING", ...pendingWhere },
    }),
    prisma.bankTransaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING", ...pendingWhere },
    }),
  ]);

  return summarizeBankAccounts(mapped, pendingDepositCount, pendingWithdrawalCount);
}

export async function listUserRecentTransactions(userId: string, limit = 10): Promise<UserBankTransaction[]> {
  const user = await loadAltaUserOrThrow(userId);
  return listUserRecentTransactionsForUser(user, limit);
}

export async function listUserRecentTransactionsForUser(
  user: AltaUser,
  limit = 10,
): Promise<UserBankTransaction[]> {
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      status: { not: "PENDING" },
      bankAccount: bankAccountAccessWhere(user, "view"),
    },
    include: {
      bankAccount: {
        include: {
          user: true,
          company: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return transactions.map(mapUserBankTransaction);
}

const RECENT_RESOLVED_REQUEST_DAYS = 7;

export async function listUserBankRequestsInProgress(
  userId: string,
  type: "deposit" | "withdrawal",
): Promise<BankRequestInProgress[]> {
  const user = await loadAltaUserOrThrow(userId);
  return listUserBankRequestsInProgressForUser(user, type);
}

export async function listUserBankRequestsInProgressForUser(
  user: AltaUser,
  type: "deposit" | "withdrawal",
): Promise<BankRequestInProgress[]> {
  const recentResolvedSince = new Date();
  recentResolvedSince.setDate(recentResolvedSince.getDate() - RECENT_RESOLVED_REQUEST_DAYS);

  const transactions = await prisma.bankTransaction.findMany({
    where: {
      type: type === "deposit" ? "DEPOSIT" : "WITHDRAWAL",
      bankAccount: bankAccountAccessWhere(user, "view"),
      OR: [
        { status: "PENDING" },
        { status: "DENIED", reviewedAt: { gte: recentResolvedSince } },
        { status: "APPROVED", reviewedAt: { gte: recentResolvedSince } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      referenceCode: true,
      amount: true,
      status: true,
      reviewNote: true,
      createdAt: true,
      updatedAt: true,
      reviewedAt: true,
      bankAccountId: true,
      proofImageUrl: true,
      bankAccount: {
        select: { accountName: true, accountNumber: true },
      },
    },
  });

  return transactions.map((tx) => {
    const status = fromDbBankTransactionStatus(tx.status) as "pending" | "approved" | "denied";
    return {
      id: tx.id,
      referenceCode: tx.referenceCode,
      bankAccountId: tx.bankAccountId,
      accountName: tx.bankAccount.accountName,
      accountNumber: tx.bankAccount.accountNumber,
      amount: decimalToNumber(tx.amount),
      status,
      statusLabel: formatBankRequestDisplayStatus(status),
      denialMessage: status === "denied" ? formatBankRequestDenialMessage(tx.reviewNote) : null,
      submittedAt: tx.createdAt.toISOString(),
      lastUpdatedAt: (tx.reviewedAt ?? tx.updatedAt).toISOString(),
      proofImageUrl: getProofFileUrl(tx.proofImageUrl, { transactionId: tx.id }),
      hasProof: hasStoredProof(tx.proofImageUrl),
    };
  });
}

export async function openBankAccount(
  userId: string,
  input: OpenBankAccountInput,
): Promise<OpenBankAccountResult> {
  const accountName = input.accountName.trim();
  if (!accountName) badRequest("Account name is required");

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) forbidden();

  const user = mapDbUserToAltaUser(userRecord);
  const allowedTypes = getBankAccountTypeOptionsForOpening(
    input.ownership,
    isPrivateClient(user),
  );
  if (!allowedTypes.some((option) => option.value === input.accountType)) {
    badRequest("Invalid account type for the selected ownership");
  }

  let companyId: string | null = null;
  let companyVerificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | undefined;
  if (input.ownership === "company") {
    if (!input.companyId) badRequest("Company is required for business accounts");
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: input.companyId } },
      include: { company: true },
    });
    if (!membership) forbidden();
    if (!canManageBusinessTreasury(user, { companyId: input.companyId })) {
      forbidden();
    }
    if (membership.company.verificationStatus !== "VERIFIED") {
      badRequest("Company must be verified before opening a business operating account");
    }
    companyId = input.companyId;
    companyVerificationStatus = membership.company.verificationStatus;
  }

  const accountNumber = await generateUniqueAccountNumber(input.accountType);
  const status = initialAccountStatus(
    input.accountType,
    companyVerificationStatus,
    isPrivateClient(user),
  );
  const instant = status === "ACTIVE";

  const { buildInterestInitializationData } = await import("@/lib/bank/account-interest-service");
  const interestData = buildInterestInitializationData(input.accountType, status, new Date());

  const account = await prisma.bankAccount.create({
    data: {
      userId,
      companyId,
      ownershipType: companyId ? "COMPANY" : "PERSONAL",
      accountType: toDbBankAccountType(input.accountType),
      accountName,
      accountNumber,
      status,
      openingNotes: input.openingNotes?.trim() || null,
      currency: "FLR",
      interestRate: interestData.interestRate,
      interestRatePeriod: interestData.interestRatePeriod,
      interestAccrualEnabled: interestData.interestAccrualEnabled,
      nextInterestAccrualAt: interestData.nextInterestAccrualAt,
    },
  });

  const accountScope = companyId ? ("business" as const) : ("personal" as const);
  const accountCopy = formatBankAccountOpenedCopy(accountName, accountScope);

  if (companyId) {
    const { recordCompanyTimelineEventIfBusiness } = await import(
      "@/server/company-relationship-timeline.service"
    );
    await recordCompanyTimelineEventIfBusiness(companyId, {
      eventType: "BUSINESS_ACCOUNT_OPENED",
      title: accountCopy.title,
      description: accountCopy.description,
      occurredAt: new Date(),
      relatedEntityType: "BANK_ACCOUNT",
      relatedEntityId: account.id,
      metadata: { accountName },
      dedupeKey: `account:${account.id}`,
    });
  } else {
    const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
    await recordRelationshipTimelineEvent({
      userId,
      eventType: "BANK_ACCOUNT_OPENED",
      title: accountCopy.title,
      description: accountCopy.description,
      occurredAt: new Date(),
      relatedEntityType: "BANK_ACCOUNT",
      relatedEntityId: account.id,
      metadata: { accountName },
    });
  }

  void (async () => {
    const { refreshFromBankAccountContextBestEffort } = await import(
      "@/server/relationship-refresh-hooks.service"
    );
    try {
      await refreshFromBankAccountContextBestEffort(
        { userId, companyId },
        companyId ? "business-account-opened" : "bank-account-opened",
      );
    } catch (error) {
      console.error("[bank] relationship refresh failed", error);
    }
  })();

  const statusLabel =
    status === "ACTIVE" ? "Active" : "Pending Review";

  const accountTypeLabel = formatBankAccountTypeLabel(input.accountType);

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: companyId ? "BUSINESS_ACCOUNT_OPENED" : "BANK_ACCOUNT_OPENED",
    entityType: "BANK_ACCOUNT",
    entityId: account.id,
    targetUserId: userId,
    targetAccountId: account.id,
    targetCompanyId: companyId ?? undefined,
    description: `Opened ${accountName}`,
    metadata: auditSourceMetadata("website", {
      accountName,
      accountType: input.accountType,
      accountNumber,
      status,
    }),
  });

  return {
    accountId: account.id,
    accountName,
    accountTypeLabel,
    accountNumber,
    routingNumber: getRoutingNumber(),
    statusLabel,
    instant,
  };
}

export async function submitDepositRequest(
  userId: string,
  input: SubmitDepositInput,
  proof: BankProofInput,
  auditContext?: BankingStaffAuditContext,
): Promise<{ transactionId: string; referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const account = await requireAccessibleAccount(input.bankAccountId, userId, "manage");
  if (account.status !== "ACTIVE") {
    badRequest("This deposit couldn't be completed because this account is not active.");
  }
  if (account.restrictDeposits) {
    badRequest("Deposits are currently unavailable for this account.");
  }

  if (!proof.proofImageUrl?.trim()) badRequest("Screenshot proof is required");

  const transaction = await prisma.bankTransaction.create({
    data: {
      bankAccountId: account.id,
      type: "DEPOSIT",
      amount: input.amount,
      status: "PENDING",
      description: DEPOSIT_PENDING_DESCRIPTION,
      memo: input.memo?.trim() || null,
      referenceCode: generateReferenceCode("DEP"),
      ...proofData(proof),
    },
  });

  void (async () => {
    try {
      const { notifyDepositSubmitted } = await import("@/server/banking-notification.service");
      await notifyDepositSubmitted(
        userId,
        input.amount,
        transaction.referenceCode,
        account.accountName,
        getProofFileUrl(proof.proofImageUrl, { transactionId: transaction.id }),
      );
    } catch (error) {
      console.error("[bank] deposit submitted notification failed", error);
    }
  })();

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: "BANK_DEPOSIT_REQUEST_SUBMITTED",
    entityType: "BANK_TRANSACTION",
    entityId: transaction.id,
    targetUserId: userId,
    targetAccountId: account.id,
    targetTransactionId: transaction.id,
    description: `Deposit request ${transaction.referenceCode}`,
    metadata: auditSourceMetadata(auditContext?.source, {
      amount: input.amount,
      referenceCode: transaction.referenceCode,
      requiresAction: true,
    }),
  });

  return { transactionId: transaction.id, referenceCode: transaction.referenceCode };
}

export async function submitWithdrawalRequest(
  userId: string,
  input: SubmitWithdrawalInput,
  auditContext?: BankingStaffAuditContext,
): Promise<{ transactionId: string; referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const account = await requireAccessibleAccount(input.bankAccountId, userId, "manage");
  if (account.status !== "ACTIVE") {
    badRequest("This withdrawal couldn't be completed because this account is not active.");
  }
  if (account.restrictWithdrawals) {
    badRequest("Withdrawals are currently unavailable for this account.");
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const { assertAccountAvailableForDebitInTx } = await import("@/server/financial-integrity.service");
    await assertAccountAvailableForDebitInTx(tx, account.id, input.amount, {
      message: "This withdrawal couldn't be completed because your available balance is insufficient.",
    });

    return tx.bankTransaction.create({
      data: {
        bankAccountId: account.id,
        type: "WITHDRAWAL",
        amount: input.amount,
        status: "PENDING",
        description: WITHDRAWAL_PENDING_DESCRIPTION,
        memo: input.memo?.trim() || null,
        referenceCode: generateReferenceCode("WDR"),
      },
    });
  });

  void (async () => {
    try {
      const { notifyWithdrawalSubmitted } = await import("@/server/banking-notification.service");
      await notifyWithdrawalSubmitted(
        userId,
        input.amount,
        transaction.referenceCode,
        account.accountName,
      );
    } catch (error) {
      console.error("[bank] withdrawal submitted notification failed", error);
    }
  })();

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: userId,
    action: "BANK_WITHDRAWAL_REQUEST_SUBMITTED",
    entityType: "BANK_TRANSACTION",
    entityId: transaction.id,
    targetUserId: userId,
    targetAccountId: account.id,
    targetTransactionId: transaction.id,
    description: `Withdrawal request ${transaction.referenceCode}`,
    metadata: auditSourceMetadata(auditContext?.source, {
      amount: input.amount,
      referenceCode: transaction.referenceCode,
      requiresAction: true,
    }),
  });

  return { transactionId: transaction.id, referenceCode: transaction.referenceCode };
}

export async function submitInternalTransfer(
  userId: string,
  input: SubmitInternalTransferInput,
  auditContext?: BankingStaffAuditContext,
  transferOptions?: { skipAuditLog?: boolean; suppressRecipientNotification?: boolean },
): Promise<{ referenceCode: string }> {
  const { beginFinancialIdempotency } = await import("@/server/financial-idempotency.service");

  return beginFinancialIdempotency({
    userId,
    scope: "internal_transfer",
    idempotencyKey: input.idempotencyKey,
    payload: {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId ?? null,
      toAccountNumber: input.toAccountNumber?.trim() ?? null,
      amount: input.amount,
      memo: input.memo?.trim() ?? null,
    },
    execute: () =>
      executeInternalTransfer(userId, input, auditContext, transferOptions),
  });
}

async function executeInternalTransfer(
  userId: string,
  input: SubmitInternalTransferInput,
  auditContext?: BankingStaffAuditContext,
  transferOptions?: { skipAuditLog?: boolean; suppressRecipientNotification?: boolean },
): Promise<{ referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const hasToAccountId = !!input.toAccountId;
  const hasToAccountNumber = !!input.toAccountNumber?.trim();
  if (hasToAccountId === hasToAccountNumber) {
    badRequest("Choose a destination account or enter a recipient account number");
  }

  const fromAccount = await requireAccessibleAccount(input.fromAccountId, userId, "manage");
  if (fromAccount.status !== "ACTIVE") {
    badRequest("This transfer couldn't be completed because the source account is not active.");
  }
  if (fromAccount.restrictTransfers) {
    badRequest("This transfer couldn't be completed because transfers are currently restricted on this account.");
  }

  let toAccount: NonNullable<Awaited<ReturnType<typeof prisma.bankAccount.findUnique>>>;

  if (input.toAccountId) {
    if (input.fromAccountId === input.toAccountId) {
      badRequest("Choose two different accounts for a transfer");
    }
    toAccount = await requireAccessibleAccount(input.toAccountId, userId, "manage");
  } else {
    const toAccountNumber = normalizeAccountNumber(input.toAccountNumber!);
    if (!isValidAltaAccountNumber(toAccountNumber)) {
      badRequest("Enter a valid Alta Bank account number (AB-####-######)");
    }
    const recipient = await prisma.bankAccount.findUnique({ where: { accountNumber: toAccountNumber } });
    if (!recipient) badRequest("Recipient account not found");
    if (recipient.id === fromAccount.id) badRequest("Choose a different recipient account");
    if (await isAccountAccessibleByUser(recipient.id, userId)) {
      badRequest("Select this account from the dropdown when transferring between your own accounts");
    }
    toAccount = recipient;
  }

  if (toAccount.status !== "ACTIVE") {
    badRequest("This transfer couldn't be completed because the destination account is not active.");
  }
  if (toAccount.restrictDeposits) {
    badRequest("This transfer couldn't be completed because deposits are currently restricted on the destination account.");
  }

  const referenceBase = generateReferenceCode("TRF");
  const outReference = `${referenceBase}-OUT`;
  const inReference = `${referenceBase}-IN`;
  const memo = input.memo?.trim() || null;
  const amount = input.amount;

  await prisma.$transaction(async (tx) => {
    const { assertAccountAvailableForDebitInTx, lockBankAccountsInOrder } = await import(
      "@/server/financial-integrity.service"
    );
    await lockBankAccountsInOrder(tx, [fromAccount.id, toAccount.id]);
    await assertAccountAvailableForDebitInTx(tx, fromAccount.id, amount, {
      message: "This transfer couldn't be completed because your available balance is insufficient.",
    });

    await tx.bankAccount.update({
      where: { id: fromAccount.id },
      data: { balance: { decrement: amount } },
    });
    await tx.bankAccount.update({
      where: { id: toAccount.id },
      data: { balance: { increment: amount } },
    });

    const outTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: fromAccount.id,
        type: "WITHDRAWAL",
        amount,
        status: "APPROVED",
        description: transferToDescription(toAccount.accountName),
        memo,
        referenceCode: outReference,
        proofImageUrl: null,
      },
    });

    const inTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: toAccount.id,
        type: "DEPOSIT",
        amount,
        status: "APPROVED",
        description: transferFromDescription(fromAccount.accountName),
        memo,
        referenceCode: inReference,
        proofImageUrl: null,
      },
    });

    const { recordPairedPaymentInTx } = await import("@/server/payment-entity.service");
    await recordPairedPaymentInTx(tx, {
      paymentType: "INTRABANK_TRANSFER",
      referenceCode: referenceBase,
      payerUserId: fromAccount.userId,
      recipientUserId: toAccount.userId,
      sourceBankAccountId: fromAccount.id,
      destinationBankAccountId: toAccount.id,
      amount,
      initiatedByUserId: userId,
      memo,
      debitTransactionId: outTx.id,
      creditTransactionId: inTx.id,
    });
  });

  if (input.toAccountId) {
    void (async () => {
      try {
        const { notifyTransferCompleted } = await import("@/server/banking-notification.service");
        await notifyTransferCompleted(
          userId,
          amount,
          referenceBase,
          fromAccount.accountName,
          toAccount.accountName,
        );
      } catch (error) {
        console.error("[bank] transfer completed notification failed", error);
      }
    })();
  } else if (!transferOptions?.suppressRecipientNotification) {
    void notifyIncomingTransferBestEffort(userId, toAccount, amount, referenceBase).catch((error) => {
      console.error("[bank] transfer received notification failed", error);
    });
  }

  if (!transferOptions?.skipAuditLog) {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: userId,
      action: "BANK_INTERNAL_TRANSFER_COMPLETED",
      entityType: "BANK_TRANSACTION",
      entityId: referenceBase,
      targetUserId: userId,
      targetAccountId: fromAccount.id,
      description: `Transfer ${referenceBase}: ${fromAccount.accountName} → ${toAccount.accountName}`,
      metadata: auditSourceMetadata(auditContext?.source, {
        amount,
        referenceCode: referenceBase,
        fromAccountName: fromAccount.accountName,
        toAccountName: toAccount.accountName,
      }),
    });
  }

  return { referenceCode: referenceBase };
}

/** Operator-initiated transfer between any Alta accounts (bypasses user ownership checks). */
export async function submitOperatorInternalTransfer(input: {
  fromAccountId: string;
  toAccountNumber: string;
  amount: number;
  memo: string;
}): Promise<{ referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const fromAccount = await prisma.bankAccount.findUnique({ where: { id: input.fromAccountId } });
  if (!fromAccount) notFound();
  if (fromAccount.status !== "ACTIVE") badRequest("Source account must be active");

  const toAccountNumber = normalizeAccountNumber(input.toAccountNumber);
  if (!isValidAltaAccountNumber(toAccountNumber)) {
    badRequest("Enter a valid Alta Bank account number (AB-####-######)");
  }
  const toAccount = await prisma.bankAccount.findUnique({ where: { accountNumber: toAccountNumber } });
  if (!toAccount) badRequest("Recipient account not found");
  if (toAccount.id === fromAccount.id) badRequest("Choose a different recipient account");
  if (toAccount.status !== "ACTIVE") badRequest("Destination account must be active");

  const referenceBase = generateReferenceCode("TRF");
  const outReference = `${referenceBase}-OUT`;
  const inReference = `${referenceBase}-IN`;
  const memo = input.memo?.trim() || null;
  const amount = input.amount;

  await prisma.$transaction(async (tx) => {
    const { assertAccountAvailableForDebitInTx, lockBankAccountsInOrder } = await import(
      "@/server/financial-integrity.service"
    );
    await lockBankAccountsInOrder(tx, [fromAccount.id, toAccount.id]);
    await assertAccountAvailableForDebitInTx(tx, fromAccount.id, amount, {
      message: "Insufficient available balance for this transfer",
    });

    await tx.bankAccount.update({
      where: { id: fromAccount.id },
      data: { balance: { decrement: amount } },
    });
    await tx.bankAccount.update({
      where: { id: toAccount.id },
      data: { balance: { increment: amount } },
    });

    const outTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: fromAccount.id,
        type: "WITHDRAWAL",
        amount,
        status: "APPROVED",
        description: transferToDescription(toAccount.accountName),
        memo,
        referenceCode: outReference,
        proofImageUrl: null,
      },
    });

    const inTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: toAccount.id,
        type: "DEPOSIT",
        amount,
        status: "APPROVED",
        description: transferFromDescription(fromAccount.accountName),
        memo,
        referenceCode: inReference,
        proofImageUrl: null,
      },
    });

    const { recordPairedPaymentInTx } = await import("@/server/payment-entity.service");
    await recordPairedPaymentInTx(tx, {
      paymentType: "INTRABANK_TRANSFER",
      referenceCode: referenceBase,
      payerUserId: fromAccount.userId,
      recipientUserId: toAccount.userId,
      sourceBankAccountId: fromAccount.id,
      destinationBankAccountId: toAccount.id,
      amount,
      initiatedByUserId: fromAccount.userId,
      memo,
      debitTransactionId: outTx.id,
      creditTransactionId: inTx.id,
      metadata: { operatorInitiated: true },
    });
  });

  return { referenceCode: referenceBase };
}

function mapTransferPair(
  outTx: {
    id: string;
    referenceCode: string;
    bankAccountId: string;
    amount: { toNumber(): number };
    memo: string | null;
    createdAt: Date;
    bankAccount: { accountName: string; accountNumber: string };
  },
  inTx: {
    bankAccountId: string;
    bankAccount: { accountName: string; accountNumber: string };
  },
  direction: "sent" | "received",
): UserBankTransfer {
  return {
    id: outTx.id,
    referenceCode: outTx.referenceCode.replace(/-OUT$/, ""),
    fromAccountId: outTx.bankAccountId,
    fromAccountName: outTx.bankAccount.accountName,
    fromAccountNumber: outTx.bankAccount.accountNumber,
    toAccountId: inTx.bankAccountId,
    toAccountName: inTx.bankAccount.accountName,
    toAccountNumber: inTx.bankAccount.accountNumber,
    amount: decimalToNumber(outTx.amount),
    memo: outTx.memo,
    createdAt: outTx.createdAt.toISOString(),
    direction,
  };
}

export async function listUserInternalTransfers(
  userId: string,
  limit = 20,
): Promise<UserBankTransfer[]> {
  const user = await loadAltaUserOrThrow(userId);
  const accountWhere = bankAccountAccessWhere(user, "view");

  const [outTransactions, inTransactions] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: {
        referenceCode: { startsWith: "TRF-", endsWith: "-OUT" },
        status: "APPROVED",
        type: "WITHDRAWAL",
        bankAccount: accountWhere,
      },
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.bankTransaction.findMany({
      where: {
        referenceCode: { startsWith: "TRF-", endsWith: "-IN" },
        status: "APPROVED",
        type: "DEPOSIT",
        bankAccount: accountWhere,
      },
      include: { bankAccount: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  if (outTransactions.length === 0 && inTransactions.length === 0) return [];

  const outReferences = outTransactions.map((tx) => tx.referenceCode.replace(/-OUT$/, "-IN"));
  const inReferences = inTransactions.map((tx) => tx.referenceCode.replace(/-IN$/, "-OUT"));

  const [pairedInTransactions, pairedOutTransactions] = await Promise.all([
    outReferences.length > 0
      ? prisma.bankTransaction.findMany({
          where: { referenceCode: { in: outReferences } },
          include: { bankAccount: true },
        })
      : [],
    inReferences.length > 0
      ? prisma.bankTransaction.findMany({
          where: { referenceCode: { in: inReferences } },
          include: { bankAccount: true },
        })
      : [],
  ]);

  const inByReference = new Map(pairedInTransactions.map((tx) => [tx.referenceCode, tx]));
  const outByReference = new Map(pairedOutTransactions.map((tx) => [tx.referenceCode, tx]));

  const sent = outTransactions.flatMap((outTx) => {
    const inTx = inByReference.get(outTx.referenceCode.replace(/-OUT$/, "-IN"));
    if (!inTx) return [];
    return [mapTransferPair(outTx, inTx, "sent")];
  });

  const received = inTransactions.flatMap((inTx) => {
    const outTx = outByReference.get(inTx.referenceCode.replace(/-IN$/, "-OUT"));
    if (!outTx) return [];
    return [mapTransferPair(outTx, inTx, "received")];
  });

  return [...sent, ...received]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getInternalBankOpsSummary(): Promise<InternalBankOpsSummary> {
  const [
    totalAccounts,
    pendingAccountOpenings,
    pendingDeposits,
    pendingWithdrawals,
    frozenAccounts,
    lendingQueue,
    altaPayVolume,
    pendingPrivateInvites,
  ] = await Promise.all([
    prisma.bankAccount.count(),
    prisma.bankAccount.count({ where: { status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.bankAccount.count({ where: { status: "FROZEN" } }),
    import("@/server/lending.service").then((m) => m.countPendingLoanApplications()),
    import("@/server/alta-pay.service").then((m) => m.getAltaPayVolumeSummary()),
    prisma.altaPrivateInvitation.count({ where: { status: "PENDING" } }),
  ]);

  return {
    totalAccounts,
    pendingAccountOpenings,
    pendingDeposits,
    pendingWithdrawals,
    frozenAccounts,
    lendingQueue,
    transfersInReview: 0,
    privateInvitesPending: pendingPrivateInvites,
    altaPayCountThisMonth: altaPayVolume.countThisMonth,
    altaPayVolumeThisMonth: altaPayVolume.volumeThisMonth,
  };
}

export async function listInternalBankAccounts(
  filters: InternalBankAccountFilters = {},
): Promise<InternalBankAccountRow[]> {
  const and: Prisma.BankAccountWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { accountNumber: { contains: q, mode: "insensitive" } },
        { accountName: { contains: q, mode: "insensitive" } },
        { user: { discordUsername: { contains: q, mode: "insensitive" } } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.accountType) {
    and.push({ accountType: filters.accountType.toUpperCase() as Prisma.EnumBankAccountTypeFilter["equals"] });
  }
  if (filters.status) {
    and.push({ status: filters.status.toUpperCase() as Prisma.EnumBankAccountStatusFilter["equals"] });
  }
  if (filters.companyId) and.push({ companyId: filters.companyId });

  const accounts = await prisma.bankAccount.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    include: { user: true, company: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return accounts.map(mapInternalBankAccountRow);
}

export async function listPendingAccountOpenings(): Promise<InternalBankAccountRow[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { status: "PENDING" },
    include: { user: true, company: true },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map(mapInternalBankAccountRow);
}

export async function listPendingBankTransactions(
  type?: "DEPOSIT" | "WITHDRAWAL",
): Promise<InternalBankTransactionRow[]> {
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      status: "PENDING",
      ...(type ? { type } : {}),
    },
    include: {
      bankAccount: {
        include: { user: true, company: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return transactions.map(mapInternalBankTransactionRow);
}

export async function approveDeposit(
  adminId: string,
  transactionId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();

  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Review note");

  const record = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${transactionId} FOR UPDATE`;

    const row = await tx.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!row) notFound();
    if (row.type !== "DEPOSIT" || row.status !== "PENDING") badRequest("Invalid deposit request");

    const updated = await tx.bankTransaction.updateMany({
      where: { id: transactionId, status: "PENDING", type: "DEPOSIT" },
      data: {
        status: "APPROVED",
        description: DEPOSIT_APPROVED_DESCRIPTION,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: trimmedNote,
      },
    });
    if (updated.count !== 1) badRequest("Invalid deposit request");

    await tx.bankAccount.update({
      where: { id: row.bankAccountId },
      data: { balance: { increment: row.amount } },
    });
    return row;
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { customerNotificationSent, auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    deliver: async () => {
      const { notifyDepositApproved } = await import("@/server/banking-notification.service");
      await notifyDepositApproved(
        record.bankAccount.userId,
        decimalToNumber(record.amount),
        record.referenceCode,
      );
      return true;
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "DEPOSIT_APPROVED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetUserId: record.bankAccount.userId,
    targetAccountId: record.bankAccountId,
    targetTransactionId: transactionId,
    description: `Approved deposit ${record.referenceCode}`,
    metadata: {
      amount: decimalToNumber(record.amount),
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });

  const { refreshFromBankAccountContextBestEffort } = await import(
    "@/server/relationship-refresh-hooks.service"
  );
  await refreshFromBankAccountContextBestEffort(
    { userId: record.bankAccount.userId, companyId: record.bankAccount.companyId },
    "deposit-completed",
  );
}

export async function denyDeposit(
  adminId: string,
  transactionId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Review note");

  const record = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${transactionId} FOR UPDATE`;

    const row = await tx.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!row) notFound();
    if (row.type !== "DEPOSIT" || row.status !== "PENDING") badRequest("Invalid deposit request");

    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "DENIED",
        description: DEPOSIT_DECLINED_DESCRIPTION,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: trimmedNote,
      },
    });
    return row;
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    silentRestriction: { kind: "payment_blocked", action: "deny_deposit" },
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: record.bankAccount.id,
          accountNumber: record.bankAccount.accountNumber,
          userId: record.bankAccount.userId,
          companyId: record.bankAccount.companyId,
        },
        kind: "payment_blocked",
        amount: decimalToNumber(record.amount),
        transactionId,
        source: "deny_deposit",
        silentNotification: notificationOptions?.silentNotification,
        actorUserId: adminId,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "BANK_PAYMENT_BLOCKED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetUserId: record.bankAccount.userId,
    targetAccountId: record.bankAccountId,
    targetTransactionId: transactionId,
    description: `Denied deposit ${record.referenceCode}`,
    metadata: {
      amount: decimalToNumber(record.amount),
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });
}

export async function approveWithdrawal(
  adminId: string,
  transactionId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();

  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Review note");

  let record;
  try {
    record = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${transactionId} FOR UPDATE`;

      const row = await tx.bankTransaction.findUnique({
        where: { id: transactionId },
        include: { bankAccount: true },
      });
      if (!row) notFound();
      if (row.type !== "WITHDRAWAL" || row.status !== "PENDING") {
        badRequest("Invalid withdrawal request");
      }

      const amount = decimalToNumber(row.amount);
      const { assertAccountAvailableForDebitInTx } = await import("@/server/financial-integrity.service");
      await assertAccountAvailableForDebitInTx(tx, row.bankAccountId, amount, {
        excludePendingWithdrawalId: transactionId,
        message:
          "Insufficient available balance to approve this withdrawal. Check holds and other pending withdrawals.",
      });

      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: {
          status: "APPROVED",
          description: WITHDRAWAL_APPROVED_DESCRIPTION,
          reviewedById: adminId,
          reviewedAt: new Date(),
          reviewNote: trimmedNote,
        },
      });

      await tx.bankAccount.update({
        where: { id: row.bankAccountId },
        data: { balance: { decrement: row.amount } },
      });
      return row;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Insufficient available balance")) {
      const pending = await prisma.bankTransaction.findUnique({
        where: { id: transactionId },
        include: { bankAccount: true },
      });
      if (pending) {
        const { writeAuditLog } = await import("@/server/audit.service");
        await writeAuditLog({
          actorUserId: adminId,
          action: "BANK_WITHDRAWAL_APPROVAL_REJECTED",
          entityType: "BANK_TRANSACTION",
          entityId: transactionId,
          targetUserId: pending.bankAccount.userId,
          targetAccountId: pending.bankAccountId,
          targetTransactionId: transactionId,
          description: `Rejected withdrawal approval ${pending.referenceCode} — insufficient available balance`,
          metadata: {
            amount: decimalToNumber(pending.amount),
            reason: "insufficient_available_balance",
            reviewNote: trimmedNote,
            source: "website",
          },
        });
      }
    }
    throw error;
  }

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    deliver: async () => {
      const { notifyWithdrawalApproved } = await import("@/server/banking-notification.service");
      await notifyWithdrawalApproved(
        record.bankAccount.userId,
        decimalToNumber(record.amount),
        record.referenceCode,
      );
      return true;
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "WITHDRAWAL_APPROVED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetUserId: record.bankAccount.userId,
    targetAccountId: record.bankAccountId,
    targetTransactionId: transactionId,
    description: `Approved withdrawal ${record.referenceCode}`,
    metadata: {
      amount: decimalToNumber(record.amount),
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });

  const { refreshFromBankAccountContextBestEffort } = await import(
    "@/server/relationship-refresh-hooks.service"
  );
  await refreshFromBankAccountContextBestEffort(
    { userId: record.bankAccount.userId, companyId: record.bankAccount.companyId },
    "withdrawal-completed",
  );
}

export async function denyWithdrawal(
  adminId: string,
  transactionId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Review note");

  const record = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${transactionId} FOR UPDATE`;

    const row = await tx.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!row) notFound();
    if (row.type !== "WITHDRAWAL" || row.status !== "PENDING") {
      badRequest("Invalid withdrawal request");
    }

    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "DENIED",
        description: WITHDRAWAL_DECLINED_DESCRIPTION,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: trimmedNote,
      },
    });
    return row;
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    silentRestriction: { kind: "payment_blocked", action: "deny_withdrawal" },
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: record.bankAccount.id,
          accountNumber: record.bankAccount.accountNumber,
          userId: record.bankAccount.userId,
          companyId: record.bankAccount.companyId,
        },
        kind: "payment_blocked",
        amount: decimalToNumber(record.amount),
        transactionId,
        source: "deny_withdrawal",
        silentNotification: notificationOptions?.silentNotification,
        actorUserId: adminId,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "BANK_PAYMENT_BLOCKED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetUserId: record.bankAccount.userId,
    targetAccountId: record.bankAccountId,
    targetTransactionId: transactionId,
    description: `Denied withdrawal ${record.referenceCode}`,
    metadata: {
      amount: decimalToNumber(record.amount),
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });
}

function appendAccountNote(existing: string | null | undefined, note: string): string {
  return existing ? `${existing}\n${note}` : note;
}

export type PrivateBankingLiquidationResult = {
  accountsClosed: number;
  totalTransferred: number;
  destinationAccountId: string | null;
};

/** Move personal reserve/private balances to the oldest active personal account, then close them. */
export async function liquidatePrivateBankingOnAccessRevoked(
  userId: string,
): Promise<PrivateBankingLiquidationResult> {
  const privateAccounts = await prisma.bankAccount.findMany({
    where: {
      userId,
      companyId: null,
      accountType: { in: ["RESERVE", "PRIVATE"] },
      status: { not: "CLOSED" },
    },
    orderBy: { createdAt: "asc" },
  });

  if (privateAccounts.length === 0) {
    return { accountsClosed: 0, totalTransferred: 0, destinationAccountId: null };
  }

  const totalToMove = privateAccounts.reduce((sum, account) => sum + decimalToNumber(account.balance), 0);

  let destination: { id: string; accountName: string; accountNumber: string } | null = null;
  if (totalToMove > 0) {
    destination = await prisma.bankAccount.findFirst({
      where: {
        userId,
        companyId: null,
        status: "ACTIVE",
        accountType: { notIn: ["RESERVE", "PRIVATE"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, accountName: true, accountNumber: true },
    });

    if (!destination) {
      badRequest(
        "Cannot revoke Alta Private access while private accounts hold funds and no other active personal account exists to receive the balance.",
      );
    }
  }

  let totalTransferred = 0;
  const closedNote = `Closed ${new Date().toISOString()}: Alta Private access revoked.`;

  await prisma.$transaction(async (tx) => {
    for (const privateAccount of privateAccounts) {
      const balance = decimalToNumber(privateAccount.balance);

      if (balance > 0 && destination) {
        const referenceBase = generateReferenceCode("PVR");
        const outReference = `${referenceBase}-OUT`;
        const inReference = `${referenceBase}-IN`;

        await tx.bankAccount.update({
          where: { id: privateAccount.id },
          data: { balance: { decrement: balance } },
        });
        await tx.bankAccount.update({
          where: { id: destination.id },
          data: { balance: { increment: balance } },
        });

        await tx.bankTransaction.create({
          data: {
            bankAccountId: privateAccount.id,
            type: "WITHDRAWAL",
            amount: balance,
            status: "APPROVED",
            description: transferToDescription(destination.accountName),
            referenceCode: outReference,
            proofImageUrl: null,
          },
        });

        await tx.bankTransaction.create({
          data: {
            bankAccountId: destination.id,
            type: "DEPOSIT",
            amount: balance,
            status: "APPROVED",
            description: transferFromDescription(privateAccount.accountName),
            referenceCode: inReference,
            proofImageUrl: null,
          },
        });

        totalTransferred += balance;
      }

      await tx.bankAccount.update({
        where: { id: privateAccount.id },
        data: {
          status: "CLOSED",
          balance: 0,
          openingNotes: appendAccountNote(privateAccount.openingNotes, closedNote),
        },
      });
    }
  });

  return {
    accountsClosed: privateAccounts.length,
    totalTransferred,
    destinationAccountId: destination?.id ?? null,
  };
}

export async function activatePendingPrivateBankAccounts(): Promise<{ updated: number }> {
  const result = await prisma.bankAccount.updateMany({
    where: {
      status: "PENDING",
      accountType: { in: ["RESERVE", "PRIVATE"] },
      user: {
        tags: {
          some: { tag: "PRIVATE_CLIENT" },
        },
      },
    },
    data: { status: "ACTIVE" },
  });
  return { updated: result.count };
}

export async function approveBankAccount(adminId: string, accountId: string, reviewNote?: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status !== "PENDING") badRequest("Account is not pending approval");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "ACTIVE",
      openingNotes: reviewNote?.trim()
        ? [account.openingNotes, `Approved: ${reviewNote.trim()}`].filter(Boolean).join("\n")
        : account.openingNotes,
    },
  });

  const { ensureInterestScheduleOnActivation } = await import("@/lib/bank/account-interest-service");
  await ensureInterestScheduleOnActivation(accountId);

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "ACCOUNT_STATUS_CHANGED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetUserId: account.userId,
    targetAccountId: accountId,
    description: `Approved account opening ${account.accountNumber}`,
    metadata: { status: "ACTIVE", reviewNote: reviewNote ?? null },
  });
}

export async function freezeBankAccount(
  adminId: string,
  accountId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Reason");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status === "CLOSED") badRequest("Account is closed");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "FROZEN",
      openingNotes: [account.openingNotes, `Frozen: ${trimmedNote}`].filter(Boolean).join("\n"),
    },
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    silentRestriction: { kind: "account_frozen", action: "account_freeze" },
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: "account_frozen",
        source: "freeze_account",
        silentNotification: notificationOptions?.silentNotification,
        actorUserId: adminId,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "BANK_ACCOUNT_FROZEN",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetUserId: account.userId,
    targetAccountId: accountId,
    description: `Froze account ${account.accountNumber}`,
    metadata: {
      status: "FROZEN",
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });
}

export async function unfreezeBankAccount(
  adminId: string,
  accountId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Reason");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status !== "FROZEN") badRequest("Account is not frozen");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "ACTIVE",
      openingNotes: [account.openingNotes, `Unfrozen: ${trimmedNote}`].filter(Boolean).join("\n"),
    },
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: "account_unfrozen",
        source: "unfreeze_account",
        silentNotification: notificationOptions?.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "BANK_ACCOUNT_UNFROZEN",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetUserId: account.userId,
    targetAccountId: accountId,
    description: `Unfroze account ${account.accountNumber}`,
    metadata: {
      status: "ACTIVE",
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });
}

export async function closeBankAccount(
  adminId: string,
  accountId: string,
  reviewNote?: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
) {
  const { requireOperatorReason } = await import("@/server/operator-reason.service");
  const trimmedNote = requireOperatorReason(reviewNote, "Reason");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status === "CLOSED") badRequest("Account is already closed");
  if (decimalToNumber(account.balance) !== 0) {
    badRequest("Account balance must be zero before closing.");
  }

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "CLOSED",
      openingNotes: [account.openingNotes, `Closed: ${trimmedNote}`].filter(Boolean).join("\n"),
    },
  });

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId: adminId,
    notificationOptions,
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: "account_closed",
        source: "close_account",
        silentNotification: notificationOptions?.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: adminId,
    action: "BANK_ACCOUNT_CLOSED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetUserId: account.userId,
    targetAccountId: accountId,
    description: `Closed account ${account.accountNumber}`,
    metadata: {
      status: "CLOSED",
      reviewNote: trimmedNote,
      source: "website",
      ...auditMetadata,
    },
  });
}

export async function getInternalBankAccountDetail(accountId: string): Promise<InternalBankAccountDetail> {
  await requireOperator();
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { user: true, company: true },
  });
  if (!account) notFound();

  const [pendingTransactions, recentTransactions] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { bankAccountId: accountId, status: "PENDING" },
      include: { bankAccount: { include: { user: true, company: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: { bankAccountId: accountId },
      include: { bankAccount: { include: { user: true, company: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const row = mapInternalBankAccountRow(account);
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    holder: row.holder,
    ownerUserId: account.userId,
    product: row.product,
    balance: decimalToNumber(account.balance),
    currency: account.currency,
    status: row.status,
    routingNumber: getRoutingNumber(),
    companyId: account.companyId,
    companyName: account.company?.name ?? null,
    openingNotes: account.openingNotes,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    pendingTransactions: pendingTransactions.map(mapInternalBankTransactionRow),
    recentTransactions: recentTransactions.map(mapInternalBankTransactionRow),
  };
}

export async function adminAdjustBankAccount(
  actorUserId: string,
  input: AdminAccountAdjustmentInput,
): Promise<{ transactionId: string; referenceCode: string }> {
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!actorRecord) forbid();
  const actor = mapDbUserToAltaUser(actorRecord);
  await requireOperator();

  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  const reason = input.reason.trim();
  if (!reason) badRequest("Reason is required.");

  const account = await prisma.bankAccount.findUnique({ where: { id: input.accountId } });
  if (!account) notFound();
  if (account.status !== "ACTIVE") badRequest("Account must be active for adjustments.");

  const referenceCode =
    input.referenceCode?.trim() ||
    generateReferenceCode(input.direction === "credit" ? "DEP" : "WDR");

  const customerDescription =
    input.customerDescription ??
    (input.direction === "credit"
      ? creditAdjustmentDescription(reason)
      : debitAdjustmentDescription(reason));

  const transaction = await prisma.$transaction(async (tx) => {
    const { creditBankAccountInTx, debitBankAccountInTx } = await import(
      "@/server/financial-integrity.service"
    );

    if (input.direction === "credit") {
      await creditBankAccountInTx(tx, account.id, input.amount);
    } else {
      await debitBankAccountInTx(tx, account.id, input.amount, {
        allowOverdraft: !!(input.allowOverdraft && isAdmin(actor)),
        message: "Insufficient balance for debit. Admin override required.",
      });
    }

    return tx.bankTransaction.create({
      data: {
        bankAccountId: account.id,
        type: "ADJUSTMENT",
        amount: input.amount,
        status: "APPROVED",
        description: customerDescription,
        referenceCode,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });
  });

  const {
    classifyAdjustmentKind,
    operatorNotificationAuditAction,
  } = await import("@/lib/bank/customer-operator-notification-copy");
  const adjustmentKind = classifyAdjustmentKind(customerDescription, input.direction);

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions: { silentNotification: input.silentNotification },
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: adjustmentKind,
        amount: input.amount,
        transactionId: transaction.id,
        customerFacingReason: input.customerFacingReason,
        source: "admin_adjustment",
        silentNotification: input.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: operatorNotificationAuditAction(adjustmentKind),
    entityType: "BANK_TRANSACTION",
    entityId: transaction.id,
    targetUserId: account.userId,
    targetAccountId: account.id,
    targetTransactionId: transaction.id,
    description: `${input.direction === "credit" ? "Credited" : "Debited"} ${account.accountNumber} by ƒ${input.amount}`,
    metadata: {
      direction: input.direction,
      amount: input.amount,
      reason,
      referenceCode,
      allowOverdraft: input.allowOverdraft ?? false,
      customerFacingReason: input.customerFacingReason ?? null,
      source: "website",
      ...auditMetadata,
    },
  });

  return { transactionId: transaction.id, referenceCode };
}
