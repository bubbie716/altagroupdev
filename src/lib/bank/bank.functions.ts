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
  const { getUserBankDashboardBundle } = await import("@/server/bank.service");
  const userId = await actorId();
  return getUserBankDashboardBundle(userId);
});

export const fetchAccountPageBundle = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
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
    let commercialPayrollEnabled = false;
    if (isBusinessOperating) {
      try {
        businessContext = await resolveBusinessAccountContext(user, accountId);
        const { loadCommercialPlanSettings, canAccessCommercialPayroll } = await import(
          "@/server/commercial-plan.service"
        );
        const plan = await loadCommercialPlanSettings(businessContext.companyId);
        commercialPayrollEnabled = canAccessCommercialPayroll(plan);
      } catch {
        businessContext = null;
        commercialPayrollEnabled = false;
      }
    }
    return { account, accounts, businessContext, isBusinessOperating, commercialPayrollEnabled };
  });

export const fetchUserBankAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserBankAccounts } = await import("@/server/bank.service");
  const userId = await actorId();
  return listUserBankAccounts(userId);
});

export const fetchUserBankAccountDetail = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
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
  .inputValidator((limit: number | undefined) => limit ?? 10)
  .handler(async ({ data: limit }) => {
    const { listUserRecentTransactions } = await import("@/server/bank.service");
    const userId = await actorId();
    return listUserRecentTransactions(userId, limit);
  });

export const fetchUserBankRequestsInProgress = createServerFn({ method: "GET" })
  .inputValidator((type: "deposit" | "withdrawal") => type)
  .handler(async ({ data: type }) => {
    const { listUserBankRequestsInProgress } = await import("@/server/bank.service");
    const userId = await actorId();
    return listUserBankRequestsInProgress(userId, type);
  });

export const openBankAccountRecord = createServerFn({ method: "POST" })
  .inputValidator((input: OpenBankAccountInput) => input)
  .handler(async ({ data }) => {
    const { openBankAccount } = await import("@/server/bank.service");
    const userId = await actorId();
    return openBankAccount(userId, data);
  });


export const submitBankInternalTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitInternalTransferInput) => input)
  .handler(async ({ data }) => {
    const { submitInternalTransfer } = await import("@/server/bank.service");
    const userId = await actorId();
    try {
      return await submitInternalTransfer(userId, data);
    } catch (error) {
      const { notifyTransferFailedBestEffort, friendlyFailureReason } = await import(
        "@/server/banking-notification.service"
      );
      await notifyTransferFailedBestEffort(userId, {
        amount: data.amount,
        reason: friendlyFailureReason(error),
      });
      throw error;
    }
  });

export const fetchUserInternalTransfers = createServerFn({ method: "GET" })
  .inputValidator((limit: number | undefined) => limit ?? 20)
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
  .inputValidator((scope: "intrabank" | "interbank") => scope)
  .handler(async ({ data: scope }) => {
    const { listTransferContacts } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return listTransferContacts(userId, scope);
  });

export const createIntrabankContactRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/backend-types").CreateIntrabankTransferContactInput) => input)
  .handler(async ({ data }) => {
    const { createIntrabankTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return createIntrabankTransferContact(userId, data);
  });

export const createInterbankContactRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/backend-types").CreateInterbankTransferContactInput) => input)
  .handler(async ({ data }) => {
    const { createInterbankTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    return createInterbankTransferContact(userId, data);
  });

export const deleteTransferContactRecord = createServerFn({ method: "POST" })
  .inputValidator((contactId: string) => contactId)
  .handler(async ({ data: contactId }) => {
    const { deleteTransferContact } = await import("@/server/transfer-contact.service");
    const userId = await actorId();
    await deleteTransferContact(userId, contactId);
    return { ok: true as const };
  });

export const fetchInternalBankOpsSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { getInternalBankOpsSummary } = await import("@/server/bank.service");
  await requireOperator();
  return getInternalBankOpsSummary();
});

export const fetchPendingDepositsQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { listPendingBankTransactions } = await import("@/server/bank.service");
  await requireOperator();
  return listPendingBankTransactions("DEPOSIT");
});

export const fetchPendingWithdrawalsQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { listPendingBankTransactions } = await import("@/server/bank.service");
  await requireOperator();
  return listPendingBankTransactions("WITHDRAWAL");
});

export const fetchPendingAccountOpeningsQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { listPendingAccountOpenings } = await import("@/server/bank.service");
  await requireOperator();
  return listPendingAccountOpenings();
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
  .inputValidator((input: { transactionId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveDeposit } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveDeposit(admin.id, data.transactionId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const denyBankDeposit = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyDeposit } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await denyDeposit(admin.id, data.transactionId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const approveBankWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveWithdrawal } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveWithdrawal(admin.id, data.transactionId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const denyBankWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyWithdrawal } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await denyWithdrawal(admin.id, data.transactionId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const approveBankAccountOpening = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await approveBankAccount(admin.id, data.accountId, data.reviewNote);
    return { ok: true as const };
  });

export const freezeBankAccountRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { freezeBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await freezeBankAccount(admin.id, data.accountId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const unfreezeBankAccountRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { unfreezeBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await unfreezeBankAccount(admin.id, data.accountId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const closeBankAccountRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string; reviewNote?: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { closeBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    await closeBankAccount(admin.id, data.accountId, data.reviewNote, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const fetchInternalBankAccountDetail = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { getInternalBankAccountDetail } = await import("@/server/bank.service");
    await import("@/server/permissions.service").then((m) => m.requireOperator());
    return getInternalBankAccountDetail(accountId);
  });

export const adminAdjustBankAccountRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accountId: string;
      direction: "credit" | "debit";
      amount: number;
      reason: string;
      referenceCode?: string;
      allowOverdraft?: boolean;
      customerFacingReason?: string | null;
      silentNotification?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { adminAdjustBankAccount } = await import("@/server/bank.service");
    const admin = await requireOperator();
    return adminAdjustBankAccount(admin.id, data);
  });

export const fetchInternalBankAccountsFiltered = createServerFn({ method: "GET" })
  .inputValidator(
    (filters: { q?: string; accountType?: string; status?: string; companyId?: string }) => filters,
  )
  .handler(async ({ data: filters }) => {
    const { listInternalBankAccounts } = await import("@/server/bank.service");
    await import("@/server/permissions.service").then((m) => m.requireOperator());
    return listInternalBankAccounts(filters);
  });
