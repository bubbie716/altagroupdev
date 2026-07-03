import { createServerFn } from "@tanstack/react-start";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const globalOpsSearch = createServerFn({ method: "GET" })
  .inputValidator((q: string) => q)
  .handler(async ({ data: q }) => {
    const { globalOpsSearch: search } = await import("@/server/ops-global-search.service");
    return search(q);
  });

export const fetchOpsHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { getOpsHealth } = await import("@/server/ops-platform.service");
  return getOpsHealth();
});

export const fetchExceptionCenter = createServerFn({ method: "GET" }).handler(async () => {
  const { getExceptionCenterItems } = await import("@/server/ops-platform.service");
  return getExceptionCenterItems();
});

export const fetchOpsActivityFeed = createServerFn({ method: "GET" })
  .inputValidator((limit?: number) => limit ?? 30)
  .handler(async ({ data: limit }) => {
    const { getOpsActivityFeed } = await import("@/server/ops-platform.service");
    return getOpsActivityFeed(limit);
  });

export const fetchOpsDailyReports = createServerFn({ method: "GET" }).handler(async () => {
  const { getOpsDailyReports } = await import("@/server/ops-platform.service");
  return getOpsDailyReports();
});

export const fetchActivityTimeline = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { entityType: "USER" | "BANK_ACCOUNT" | "COMPANY" | "LOAN"; entityId: string }) => input,
  )
  .handler(async ({ data }) => {
    const { buildActivityTimeline } = await import("@/server/ops-platform.service");
    return buildActivityTimeline(data.entityType, data.entityId);
  });

export const searchTransactionsExplorer = createServerFn({ method: "GET" })
  .inputValidator((filters: import("@/server/ops-transaction-explorer.service").TransactionSearchFilters) => filters)
  .handler(async ({ data }) => {
    const { searchTransactions } = await import("@/server/ops-transaction-explorer.service");
    return searchTransactions(data);
  });

export const fetchTransactionDetail = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getTransactionDetail } = await import("@/server/ops-transaction-explorer.service");
    return getTransactionDetail(id);
  });

export const searchAltaPayAdmin = createServerFn({ method: "GET" })
  .inputValidator((filters: import("@/server/ops-alta-pay-admin.service").AltaPaySearchFilters) => filters)
  .handler(async ({ data }) => {
    const { searchAltaPayPayments } = await import("@/server/ops-alta-pay-admin.service");
    return searchAltaPayPayments(data);
  });

export const reverseAltaPayAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { referenceCode: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { reverseAltaPayPayment } = await import("@/server/ops-alta-pay-admin.service");
    const id = await actorId();
    return reverseAltaPayPayment(id, data.referenceCode, data.reason, {
      silentNotification: data.silentNotification,
    });
  });

export const fetchCustomer360 = createServerFn({ method: "GET" })
  .inputValidator((payload: string | { userId: string; includeTimeline?: boolean }) => payload)
  .handler(async ({ data }) => {
    const { getInternalCustomer360 } = await import("@/server/ops-customer-360.service");
    const userId = typeof data === "string" ? data : data.userId;
    const includeTimeline = typeof data === "string" ? true : data.includeTimeline ?? true;
    return getInternalCustomer360(userId, { includeTimeline });
  });

export const fetchCompany360 = createServerFn({ method: "GET" })
  .inputValidator((payload: string | { companyId: string; includeTimeline?: boolean }) => payload)
  .handler(async ({ data }) => {
    const { getInternalCompany360 } = await import("@/server/ops-company-360.service");
    const companyId = typeof data === "string" ? data : data.companyId;
    const includeTimeline = typeof data === "string" ? true : data.includeTimeline ?? true;
    return getInternalCompany360(companyId, { includeTimeline });
  });

export const fetchAccountOpsSummary = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { getAccountOpsSummary } = await import("@/server/ops-account-ops.service");
    return getAccountOpsSummary(accountId);
  });

export const reopenBankAccountOps = createServerFn({ method: "POST" })
  .inputValidator((input: { accountId: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { reopenBankAccount } = await import("@/server/ops-account-ops.service");
    await reopenBankAccount(await actorId(), data.accountId, data.reason, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const setAccountRestrictionsOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accountId: string;
      reason: string;
      restrictDeposits?: boolean;
      restrictWithdrawals?: boolean;
      restrictTransfers?: boolean;
      silentNotification?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { setAccountRestrictions } = await import("@/server/ops-account-ops.service");
    await setAccountRestrictions(await actorId(), data.accountId, data);
    return { ok: true as const };
  });

export const applyAccountHoldOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accountId: string; amount: number; reason: string; silentNotification?: boolean }) => input,
  )
  .handler(async ({ data }) => {
    const { applyAccountHold } = await import("@/server/ops-account-ops.service");
    return applyAccountHold(await actorId(), data.accountId, data.amount, data.reason, {
      silentNotification: data.silentNotification,
    });
  });

export const releaseAccountHoldOps = createServerFn({ method: "POST" })
  .inputValidator((input: { holdId: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { releaseAccountHold } = await import("@/server/ops-account-ops.service");
    await releaseAccountHold(await actorId(), data.holdId, data.reason, {
      silentNotification: data.silentNotification,
    });
    return { ok: true as const };
  });

export const adminManualTransferOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      fromAccountId: string;
      toAccountNumber: string;
      amount: number;
      memo: string;
      reason: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { adminManualTransfer } = await import("@/server/ops-account-ops.service");
    return adminManualTransfer(await actorId(), data);
  });

export const reverseAdjustmentOps = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { reverseAdjustment } = await import("@/server/ops-account-ops.service");
    return reverseAdjustment(await actorId(), data.transactionId, data.reason, {
      silentNotification: data.silentNotification,
    });
  });

export const bulkApproveDepositsOps = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionIds: string[]; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { bulkApproveDeposits } = await import("@/server/ops-bulk.service");
    return bulkApproveDeposits(await actorId(), data.transactionIds, data.reviewNote);
  });

export const bulkApproveWithdrawalsOps = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionIds: string[]; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { bulkApproveWithdrawals } = await import("@/server/ops-bulk.service");
    return bulkApproveWithdrawals(await actorId(), data.transactionIds, data.reviewNote);
  });

export const exportAuditLogsOps = createServerFn({ method: "GET" })
  .inputValidator((filters: import("@/lib/internal/audit.types").AuditLogFilters) => filters)
  .handler(async ({ data }) => {
    const { exportAuditLogsCsv } = await import("@/server/ops-bulk.service");
    return exportAuditLogsCsv(data);
  });

export const fetchInternalLoanDetailOps = createServerFn({ method: "GET" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { getInternalLoanDetail } = await import("@/server/loan.service");
    return getInternalLoanDetail(loanId);
  });

export const adminRecordLoanPaymentOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      loanId: string;
      sourceBankAccountId: string;
      amount: number;
      memo?: string;
      reason: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { adminRecordLoanPayment } = await import("@/server/loan.service");
    await adminRecordLoanPayment(await actorId(), data);
    return { ok: true as const };
  });

export const fetchEnhancedDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getInternalDashboardMetrics } = await import("@/server/internal-dashboard.service");
  const { buildOpsHealthFromMetrics, getOpsActivityFeed } = await import("@/server/ops-platform.service");
  const { getMaintenanceMode } = await import("@/server/platform-settings.service");
  await import("@/server/permissions.service").then((m) => m.requireOperator());

  const [metrics, maintenance, activity, queueAging] = await Promise.all([
    getInternalDashboardMetrics(),
    getMaintenanceMode(),
    getOpsActivityFeed(25),
    import("@/server/ops-queue-aging.service").then((m) => m.getQueueAgingMetrics()),
  ]);
  const health = await buildOpsHealthFromMetrics(metrics, maintenance);

  return {
    metrics,
    health,
    activity,
    negativeBalances: metrics.negativeBalances,
    largeAdjustments: metrics.largeAdjustmentsLast30Days,
    maintenance,
    queueAging,
  };
});
