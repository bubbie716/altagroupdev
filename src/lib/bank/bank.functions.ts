import { createServerFn } from "@tanstack/react-start";
import type {
  OpenBankAccountInput,
  SubmitInternalTransferInput,
} from "@/lib/bank/backend-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchBankDashboardBundle = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserBankDashboard, listUserBankAccounts, listUserRecentTransactions } = await import(
    "@/server/bank.service"
  );
  const userId = await actorId();
  const [dashboard, accounts, transactions] = await Promise.all([
    getUserBankDashboard(userId),
    listUserBankAccounts(userId),
    listUserRecentTransactions(userId, 10),
  ]);
  return { dashboard, accounts, transactions };
});

export const fetchAccountPageBundle = createServerFn({ method: "GET" })
  .validator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { getUserBankAccountDetail, listUserBankAccounts } = await import("@/server/bank.service");
    const { resolveBusinessAccountContext } = await import(
      "@/server/business-account-context.service"
    );
    const user = await actor();
    const [account, accounts] = await Promise.all([
      getUserBankAccountDetail(user.id, accountId),
      listUserBankAccounts(user.id),
    ]);
    const isBusinessOperating = account.accountType === "business_operating";
    let businessContext = null;
    if (isBusinessOperating) {
      try {
        businessContext = await resolveBusinessAccountContext(user, accountId);
      } catch {
        businessContext = null;
      }
    }
    return { account, accounts, businessContext, isBusinessOperating };
  });

export const fetchUserBankAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserBankAccounts } = await import("@/server/bank.service");
  const userId = await actorId();
  return listUserBankAccounts(userId);
});

export const fetchUserBankAccountDetail = createServerFn({ method: "GET" })
  .validator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { getUserBankAccountDetail } = await import("@/server/bank.service");
    const userId = await actorId();
    return getUserBankAccountDetail(userId, accountId);
  });

export const fetchActiveBankAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { listActiveDepositAccounts } = await import("@/server/bank.service");
  const userId = await actorId();
  return listActiveDepositAccounts(userId);
});

export const fetchUserBankDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserBankDashboard } = await import("@/server/bank.service");
  const userId = await actorId();
  return getUserBankDashboard(userId);
});

export const fetchUserBankSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserBankSummary } = await import("@/server/bank.service");
  const userId = await actorId();
  return getUserBankSummary(userId);
});

export const fetchUserBankTransactions = createServerFn({ method: "GET" })
  .validator((limit: number | undefined) => limit ?? 10)
  .handler(async ({ data: limit }) => {
    const { listUserRecentTransactions } = await import("@/server/bank.service");
    const userId = await actorId();
    return listUserRecentTransactions(userId, limit);
  });

export const openBankAccountRecord = createServerFn({ method: "POST" })
  .validator((input: OpenBankAccountInput) => input)
  .handler(async ({ data }) => {
    const { openBankAccount } = await import("@/server/bank.service");
    const userId = await actorId();
    return openBankAccount(userId, data);
  });


export const submitBankInternalTransfer = createServerFn({ method: "POST" })
  .validator((input: SubmitInternalTransferInput) => input)
  .handler(async ({ data }) => {
    const { submitInternalTransfer } = await import("@/server/bank.service");
    const userId = await actorId();
    return submitInternalTransfer(userId, data);
  });

export const fetchUserInternalTransfers = createServerFn({ method: "GET" })
  .validator((limit: number | undefined) => limit ?? 20)
  .handler(async ({ data: limit }) => {
    const { listUserInternalTransfers } = await import("@/server/bank.service");
    const userId = await actorId();
    return listUserInternalTransfers(userId, limit);
  });

export const fetchAllTransferContacts = createServerFn({ method: "GET" }).handler(async () => {
  const { listTransferContacts } = await import("@/server/transfer-contact.service");
  const userId = await actorId();
  return listTransferContacts(userId);
});

export const fetchTransferContacts = createServerFn({ method: "GET" })
  .validator((scope: "intrabank" | "interbank") => scope)
  .handler(async ({ data: scope }) => {
    const { listTransferContacts } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return listTransferContacts(userId, scope);
  });

export const createIntrabankContactRecord = createServerFn({ method: "POST" })
  .validator((input: import("@/lib/bank/backend-types").CreateIntrabankTransferContactInput) => input)
  .handler(async ({ data }) => {
    const { createIntrabankTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return createIntrabankTransferContact(userId, data);
  });

export const createInterbankContactRecord = createServerFn({ method: "POST" })
  .validator((input: import("@/lib/bank/backend-types").CreateInterbankTransferContactInput) => input)
  .handler(async ({ data }) => {
    const { createInterbankTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return createInterbankTransferContact(userId, data);
  });

export const deleteTransferContactRecord = createServerFn({ method: "POST" })
  .validator((contactId: string) => contactId)
  .handler(async ({ data: contactId }) => {
    const { deleteTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    await deleteTransferContact(userId, contactId);
    return { ok: true as const };
  });

export const fetchInternalBankOps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const {
    getInternalBankOpsSummary,
    listInternalBankAccounts,
    listPendingAccountOpenings,
    listPendingBankTransactions,
  } = await import("@/server/bank.service");
  await requireOperator();
  const [summary, accounts, pendingAccounts, pendingDeposits, pendingWithdrawals] = await Promise.all([
    getInternalBankOpsSummary(),
    listInternalBankAccounts(),
    listPendingAccountOpenings(),
    listPendingBankTransactions("DEPOSIT"),
    listPendingBankTransactions("WITHDRAWAL"),
  ]);
  return { summary, accounts, pendingAccounts, pendingDeposits, pendingWithdrawals };
});

export const approveBankDeposit = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveDeposit } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveDeposit(admin.id, data.transactionId, data.reviewNote);
    return { ok: true as const };
  });

export const denyBankDeposit = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyDeposit } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await denyDeposit(admin.id, data.transactionId, data.reviewNote);
    return { ok: true as const };
  });

export const approveBankWithdrawal = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveWithdrawal } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveWithdrawal(admin.id, data.transactionId, data.reviewNote);
    return { ok: true as const };
  });

export const denyBankWithdrawal = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyWithdrawal } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await denyWithdrawal(admin.id, data.transactionId, data.reviewNote);
    return { ok: true as const };
  });

export const approveBankAccountOpening = createServerFn({ method: "POST" })
  .validator((input: { accountId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveBankAccount(admin.id, data.accountId, data.reviewNote);
    return { ok: true as const };
  });

export const freezeBankAccountRecord = createServerFn({ method: "POST" })
  .validator((input: { accountId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { freezeBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await freezeBankAccount(admin.id, data.accountId, data.reviewNote);
    return { ok: true as const };
  });

export const unfreezeBankAccountRecord = createServerFn({ method: "POST" })
  .validator((input: { accountId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { unfreezeBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await unfreezeBankAccount(admin.id, data.accountId, data.reviewNote);
    return { ok: true as const };
  });
