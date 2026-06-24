import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  InternalBankAccountRow,
  InternalBankOpsSummary,
  InternalBankTransactionRow,
  OpenBankAccountInput,
  OpenBankAccountResult,
  SubmitDepositInput,
  SubmitInternalTransferInput,
  SubmitWithdrawalInput,
  BankProofInput,
  UserBankAccount,
  UserBankAccountDetail,
  UserBankDashboard,
  UserBankSummary,
  UserBankTransaction,
  UserBankTransfer,
} from "@/lib/bank/backend-types";
import {
  formatBankAccountTypeLabel,
  getBankAccountTypeOptionsForOpening,
  isInstantApprovalAccountType,
} from "@/lib/bank/backend-types";
import { generateAccountNumber, isValidAltaAccountNumber } from "@/lib/bank/account-number";
import { getRoutingNumber } from "@/lib/bank/routing";
import { isPrivateClient } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import {
  mapInternalBankAccountRow,
  mapInternalBankTransactionRow,
  mapUserBankAccount,
  mapUserBankTransaction,
  toDbBankAccountType,
} from "@/server/bank-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
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

function generateReferenceCode(type: "DEP" | "WDR" | "TRF"): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${type}-${date}-${suffix}`;
}

async function getAvailableBalance(accountId: string): Promise<number> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();

  const balance = decimalToNumber(account.balance);
  const pendingWithdrawals = await prisma.bankTransaction.aggregate({
    where: {
      bankAccountId: accountId,
      type: "WITHDRAWAL",
      status: "PENDING",
    },
    _sum: { amount: true },
  });
  const reserved = pendingWithdrawals._sum.amount
    ? decimalToNumber(pendingWithdrawals._sum.amount)
    : 0;
  return balance - reserved;
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
): "PENDING" | "ACTIVE" {
  if (accountType === "business_operating") {
    return companyVerificationStatus === "VERIFIED" ? "ACTIVE" : "PENDING";
  }
  return isInstantApprovalAccountType(accountType) ? "ACTIVE" : "PENDING";
}

async function getUserCompanyIds(userId: string): Promise<Set<string>> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return new Set(memberships.map((m) => m.companyId));
}

function accessibleAccountWhere(userId: string, companyIds: Set<string>): Prisma.BankAccountWhereInput {
  return {
    OR: [
      { userId, companyId: null },
      ...(companyIds.size > 0 ? [{ companyId: { in: [...companyIds] } }] : []),
    ],
  };
}

async function requireAccessibleAccount(accountId: string, userId: string) {
  const companyIds = await getUserCompanyIds(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...accessibleAccountWhere(userId, companyIds) },
    include: {
      company: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!account) forbidden();
  return account;
}

export async function isAccountAccessibleByUser(accountId: string, userId: string): Promise<boolean> {
  const companyIds = await getUserCompanyIds(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...accessibleAccountWhere(userId, companyIds) },
    select: { id: true },
  });
  return !!account;
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
  const companyIds = await getUserCompanyIds(userId);
  const accounts = await prisma.bankAccount.findMany({
    where: accessibleAccountWhere(userId, companyIds),
    include: accountInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return accounts.map(mapUserBankAccount);
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
    take: 20,
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
    if (tx.type === "DEPOSIT") depositsThisMonth += amount;
    if (tx.type === "WITHDRAWAL") withdrawalsThisMonth += amount;
  }

  const balance = decimalToNumber(account.balance);
  const summary = mapUserBankAccount({
    ...account,
    transactions: recentTransactions.slice(0, 1),
  });

  const ownerLabel = account.company?.name ?? user?.discordUsername ?? "Personal";

  return {
    ...summary,
    ownerLabel,
    depositsThisMonth,
    withdrawalsThisMonth,
    netChangeThisMonth: depositsThisMonth - withdrawalsThisMonth,
    availableBalance: balance,
    recentTransactions: recentTransactions.map(mapUserBankTransaction),
  };
}

export async function listActiveDepositAccounts(userId: string): Promise<UserBankAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts.filter((a) => a.status === "active");
}

export async function getUserBankDashboard(userId: string): Promise<UserBankDashboard> {
  const accounts = await listUserBankAccounts(userId);
  const activeAccounts = accounts.filter((a) => a.status === "active");

  const checkingBalance = activeAccounts
    .filter((a) => a.accountType === "checking" || a.accountType === "alta_access")
    .reduce((sum, a) => sum + a.balance, 0);
  const savingsBalance = activeAccounts
    .filter((a) => a.accountType === "savings")
    .reduce((sum, a) => sum + a.balance, 0);
  const reserveBalance = activeAccounts
    .filter((a) => a.accountType === "reserve" || a.accountType === "private")
    .reduce((sum, a) => sum + a.balance, 0);
  const businessBalance = activeAccounts
    .filter((a) => a.accountType === "business_operating")
    .reduce((sum, a) => sum + a.balance, 0);
  const totalRelationshipValue = activeAccounts.reduce((sum, a) => sum + a.balance, 0);

  const companyIds = await getUserCompanyIds(userId);
  const pendingDeposits = await prisma.bankTransaction.count({
    where: {
      type: "DEPOSIT",
      status: "PENDING",
      bankAccount: accessibleAccountWhere(userId, companyIds),
    },
  });
  const pendingWithdrawals = await prisma.bankTransaction.count({
    where: {
      type: "WITHDRAWAL",
      status: "PENDING",
      bankAccount: accessibleAccountWhere(userId, companyIds),
    },
  });

  const hasPrivate = accounts.some((a) => a.accountType === "private" && a.status === "active");

  return {
    totalRelationshipValue,
    checkingBalance,
    savingsBalance,
    reserveBalance,
    businessBalance,
    creditAvailable: 0,
    privateStatus: hasPrivate ? "Alta Private" : "Not enrolled",
    accountCount: accounts.length,
    pendingDeposits,
    pendingWithdrawals,
  };
}

export async function getUserBankSummary(userId: string): Promise<UserBankSummary> {
  const accounts = await listUserBankAccounts(userId);
  const companyIds = await getUserCompanyIds(userId);

  const [pendingDepositCount, pendingWithdrawalCount] = await Promise.all([
    prisma.bankTransaction.count({
      where: { type: "DEPOSIT", status: "PENDING", bankAccount: accessibleAccountWhere(userId, companyIds) },
    }),
    prisma.bankTransaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING", bankAccount: accessibleAccountWhere(userId, companyIds) },
    }),
  ]);

  return {
    totalBalance: accounts.filter((a) => a.status === "active").reduce((sum, a) => sum + a.balance, 0),
    activeAccountCount: accounts.filter((a) => a.status === "active").length,
    pendingAccountCount: accounts.filter((a) => a.status === "pending").length,
    pendingDepositCount,
    pendingWithdrawalCount,
  };
}

export async function listUserRecentTransactions(userId: string, limit = 10): Promise<UserBankTransaction[]> {
  const companyIds = await getUserCompanyIds(userId);
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      status: { not: "PENDING" },
      bankAccount: accessibleAccountWhere(userId, companyIds),
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
    if (membership.company.verificationStatus !== "VERIFIED") {
      badRequest("Company must be verified before opening a business operating account");
    }
    companyId = input.companyId;
    companyVerificationStatus = membership.company.verificationStatus;
  }

  const accountNumber = await generateUniqueAccountNumber(input.accountType);
  const status = initialAccountStatus(input.accountType, companyVerificationStatus);
  const instant = status === "ACTIVE";

  const account = await prisma.bankAccount.create({
    data: {
      userId,
      companyId,
      accountType: toDbBankAccountType(input.accountType),
      accountName,
      accountNumber,
      status,
      openingNotes: input.openingNotes?.trim() || null,
      currency: "FLR",
    },
  });

  const statusLabel =
    status === "ACTIVE" ? "Active" : "Pending Review";

  return {
    accountId: account.id,
    accountName,
    accountTypeLabel: formatBankAccountTypeLabel(input.accountType),
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
): Promise<{ transactionId: string; referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const account = await requireAccessibleAccount(input.bankAccountId, userId);
  if (account.status !== "ACTIVE") badRequest("Account must be active to accept deposits");

  if (!proof.proofImageUrl?.trim()) badRequest("Screenshot proof is required");

  const transaction = await prisma.bankTransaction.create({
    data: {
      bankAccountId: account.id,
      type: "DEPOSIT",
      amount: input.amount,
      status: "PENDING",
      description: "Deposit request",
      memo: input.memo?.trim() || null,
      referenceCode: generateReferenceCode("DEP"),
      ...proofData(proof),
    },
  });

  return { transactionId: transaction.id, referenceCode: transaction.referenceCode };
}

export async function submitWithdrawalRequest(
  userId: string,
  input: SubmitWithdrawalInput,
): Promise<{ transactionId: string; referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const account = await requireAccessibleAccount(input.bankAccountId, userId);
  if (account.status !== "ACTIVE") badRequest("Account must be active for withdrawals");

  const availableBalance = await getAvailableBalance(account.id);
  if (input.amount > availableBalance) {
    badRequest("Insufficient balance for this withdrawal");
  }

  const transaction = await prisma.bankTransaction.create({
    data: {
      bankAccountId: account.id,
      type: "WITHDRAWAL",
      amount: input.amount,
      status: "PENDING",
      description: "Withdrawal request",
      memo: input.memo?.trim() || null,
      referenceCode: generateReferenceCode("WDR"),
    },
  });

  return { transactionId: transaction.id, referenceCode: transaction.referenceCode };
}

export async function submitInternalTransfer(
  userId: string,
  input: SubmitInternalTransferInput,
): Promise<{ referenceCode: string }> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const hasToAccountId = !!input.toAccountId;
  const hasToAccountNumber = !!input.toAccountNumber?.trim();
  if (hasToAccountId === hasToAccountNumber) {
    badRequest("Choose a destination account or enter a recipient account number");
  }

  const fromAccount = await requireAccessibleAccount(input.fromAccountId, userId);
  if (fromAccount.status !== "ACTIVE") badRequest("Source account must be active");

  let toAccount: NonNullable<Awaited<ReturnType<typeof prisma.bankAccount.findUnique>>>;

  if (input.toAccountId) {
    if (input.fromAccountId === input.toAccountId) {
      badRequest("Choose two different accounts for a transfer");
    }
    toAccount = await requireAccessibleAccount(input.toAccountId, userId);
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

  if (toAccount.status !== "ACTIVE") badRequest("Destination account must be active");

  const availableBalance = await getAvailableBalance(fromAccount.id);
  if (input.amount > availableBalance) {
    badRequest("Insufficient balance for this transfer");
  }

  const referenceBase = generateReferenceCode("TRF");
  const outReference = `${referenceBase}-OUT`;
  const inReference = `${referenceBase}-IN`;
  const memo = input.memo?.trim() || null;
  const amount = input.amount;

  await prisma.$transaction(async (tx) => {
    await tx.bankAccount.update({
      where: { id: fromAccount.id },
      data: { balance: { decrement: amount } },
    });
    await tx.bankAccount.update({
      where: { id: toAccount.id },
      data: { balance: { increment: amount } },
    });

    await tx.bankTransaction.create({
      data: {
        bankAccountId: fromAccount.id,
        type: "WITHDRAWAL",
        amount,
        status: "APPROVED",
        description: `Intrabank transfer to ${toAccount.accountName} · ${toAccount.accountNumber}`,
        memo,
        referenceCode: outReference,
        proofImageUrl: null,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankAccountId: toAccount.id,
        type: "DEPOSIT",
        amount,
        status: "APPROVED",
        description: `Intrabank transfer from ${fromAccount.accountName} · ${fromAccount.accountNumber}`,
        memo,
        referenceCode: inReference,
        proofImageUrl: null,
      },
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
  const companyIds = await getUserCompanyIds(userId);
  const accountWhere = accessibleAccountWhere(userId, companyIds);

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
    altaPayVolume,
  ] = await Promise.all([
    prisma.bankAccount.count(),
    prisma.bankAccount.count({ where: { status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.bankTransaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.bankAccount.count({ where: { status: "FROZEN" } }),
    import("@/server/alta-pay.service").then((m) => m.getAltaPayVolumeSummary()),
  ]);

  return {
    totalAccounts,
    pendingAccountOpenings,
    pendingDeposits,
    pendingWithdrawals,
    frozenAccounts,
    lendingQueue: 0,
    transfersInReview: 0,
    privateInvitesPending: 0,
    altaPayCountThisMonth: altaPayVolume.countThisMonth,
    altaPayVolumeThisMonth: altaPayVolume.volumeThisMonth,
  };
}

export async function listInternalBankAccounts(): Promise<InternalBankAccountRow[]> {
  const accounts = await prisma.bankAccount.findMany({
    include: { user: true, company: true },
    orderBy: { createdAt: "desc" },
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

export async function approveDeposit(adminId: string, transactionId: string, reviewNote?: string) {
  await prisma.$transaction(async (tx) => {
    const record = await tx.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!record) notFound();
    if (record.type !== "DEPOSIT" || record.status !== "PENDING") badRequest("Invalid deposit request");

    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    await tx.bankAccount.update({
      where: { id: record.bankAccountId },
      data: { balance: { increment: record.amount } },
    });
  });
}

export async function denyDeposit(adminId: string, transactionId: string, reviewNote?: string) {
  const record = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!record) notFound();
  if (record.type !== "DEPOSIT" || record.status !== "PENDING") badRequest("Invalid deposit request");

  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      status: "DENIED",
      reviewedById: adminId,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
  });
}

export async function approveWithdrawal(adminId: string, transactionId: string, reviewNote?: string) {
  await prisma.$transaction(async (tx) => {
    const record = await tx.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!record) notFound();
    if (record.type !== "WITHDRAWAL" || record.status !== "PENDING") badRequest("Invalid withdrawal request");

    const balance = decimalToNumber(record.bankAccount.balance);
    const amount = decimalToNumber(record.amount);
    if (balance < amount) badRequest("Insufficient balance");

    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    await tx.bankAccount.update({
      where: { id: record.bankAccountId },
      data: { balance: { decrement: record.amount } },
    });
  });
}

export async function denyWithdrawal(adminId: string, transactionId: string, reviewNote?: string) {
  const record = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!record) notFound();
  if (record.type !== "WITHDRAWAL" || record.status !== "PENDING") badRequest("Invalid withdrawal request");

  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      status: "DENIED",
      reviewedById: adminId,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
  });
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

  void adminId;
}

export async function freezeBankAccount(adminId: string, accountId: string, reviewNote?: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status === "CLOSED") badRequest("Account is closed");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "FROZEN",
      openingNotes: reviewNote?.trim()
        ? [account.openingNotes, `Frozen: ${reviewNote.trim()}`].filter(Boolean).join("\n")
        : account.openingNotes,
    },
  });

  void adminId;
}

export async function unfreezeBankAccount(adminId: string, accountId: string, reviewNote?: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();
  if (account.status !== "FROZEN") badRequest("Account is not frozen");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      status: "ACTIVE",
      openingNotes: reviewNote?.trim()
        ? [account.openingNotes, `Unfrozen: ${reviewNote.trim()}`].filter(Boolean).join("\n")
        : account.openingNotes,
    },
  });

  void adminId;
}
