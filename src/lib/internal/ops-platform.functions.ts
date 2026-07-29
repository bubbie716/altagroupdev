import { createServerFn } from "@tanstack/react-start";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const globalOpsSearch = createServerFn({ method: "GET" })
  .inputValidator((input: string | { q: string; site?: string }) => {
    if (typeof input === "string") return { q: input, site: undefined as string | undefined };
    const q = typeof input?.q === "string" ? input.q : "";
    const site = typeof input?.site === "string" && input.site.trim() ? input.site.trim() : undefined;
    return { q, site };
  })
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode() && (data.site === "terminal" || data.site === "exchange")) {
      const { searchUiLabTerminalOps } = await import("@/lib/terminal/ui-lab-terminal-ops-fixtures");
      return searchUiLabTerminalOps(data.q, 30);
    }
    const { globalOpsSearch: search } = await import("@/server/ops-global-search.service");
    return search(data.q, 30, data.site);
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
    (input: {
      entityType: "USER" | "BANK_ACCOUNT" | "COMPANY" | "LOAN" | "ALTA_CARD";
      entityId: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { buildActivityTimeline } = await import("@/server/ops-platform.service");
    return buildActivityTimeline(data.entityType, data.entityId);
  });

export const searchTransactionsExplorer = createServerFn({ method: "GET" })
  .inputValidator((filters: import("@/server/ops-transaction-explorer.service").TransactionSearchFilters) => filters)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTransactionExplorer } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      return getUiLabTransactionExplorer(data);
    }
    const { searchTransactions } = await import("@/server/ops-transaction-explorer.service");
    return searchTransactions(data);
  });

export const fetchTransactionDetail = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTransactionDetail } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      const fixture = getUiLabTransactionDetail(id);
      if (fixture) return fixture;
    }
    const { getTransactionDetail } = await import("@/server/ops-transaction-explorer.service");
    return getTransactionDetail(id);
  });

export const searchAltaPayAdmin = createServerFn({ method: "GET" })
  .inputValidator((filters: import("@/server/ops-alta-pay-admin.service").AltaPaySearchFilters) => filters)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabAltaPayPayments } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      return getUiLabAltaPayPayments(data.q, { limit: data.limit, offset: data.offset });
    }
    const { searchAltaPayPayments } = await import("@/server/ops-alta-pay-admin.service");
    return searchAltaPayPayments(data);
  });

export const fetchAltaPayAdminDetail = createServerFn({ method: "GET" })
  .inputValidator((referenceCode: string) => referenceCode)
  .handler(async ({ data: referenceCode }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabAltaPayPaymentDetail } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      const row = getUiLabAltaPayPaymentDetail(referenceCode);
      if (!row) throw new Error("NOT_FOUND");
      return row;
    }
    const { getAltaPayPaymentDetail } = await import("@/server/ops-alta-pay-admin.service");
    return getAltaPayPaymentDetail(referenceCode);
  });

export const searchAltaPayInvoicesAdmin = createServerFn({ method: "GET" })
  .inputValidator((filters: { q?: string; limit?: number; offset?: number } = {}) => filters)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalInvoiceRows } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      let rows = getUiLabInternalInvoiceRows();
      const q = data.q?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (r) =>
            r.referenceCode.toLowerCase().includes(q) ||
            r.merchantName.toLowerCase().includes(q) ||
            r.recipientName.toLowerCase().includes(q),
        );
      }
      const limit = data.limit ?? 25;
      const offset = data.offset ?? 0;
      return {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
        hasMore: offset + limit < rows.length,
      };
    }
    const { searchMerchantInvoicesAdmin } = await import("@/server/ops-alta-pay-commercial-admin.service");
    return searchMerchantInvoicesAdmin(data);
  });

export const fetchAltaPayInvoiceAdminDetail = createServerFn({ method: "GET" })
  .inputValidator((invoiceId: string) => invoiceId)
  .handler(async ({ data: invoiceId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalInvoiceDetail } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      const detail = getUiLabInternalInvoiceDetail(invoiceId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { getMerchantInvoiceAdminDetail } = await import("@/server/ops-alta-pay-commercial-admin.service");
    return getMerchantInvoiceAdminDetail(invoiceId);
  });

export const searchAltaPayPaymentLinksAdmin = createServerFn({ method: "GET" })
  .inputValidator((filters: { q?: string; limit?: number; offset?: number } = {}) => filters)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalPaymentLinkRows } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      let rows = getUiLabInternalPaymentLinkRows();
      const q = data.q?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (r) =>
            r.referenceCode.toLowerCase().includes(q) ||
            r.merchantName.toLowerCase().includes(q) ||
            (r.title ?? "").toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q),
        );
      }
      const limit = data.limit ?? 25;
      const offset = data.offset ?? 0;
      return {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
        hasMore: offset + limit < rows.length,
      };
    }
    const { searchPaymentLinksAdmin } = await import("@/server/ops-alta-pay-commercial-admin.service");
    return searchPaymentLinksAdmin(data);
  });

export const fetchAltaPayPaymentLinkAdminDetail = createServerFn({ method: "GET" })
  .inputValidator((linkId: string) => linkId)
  .handler(async ({ data: linkId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalPaymentLinkDetail } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      const detail = getUiLabInternalPaymentLinkDetail(linkId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { getPaymentLinkAdminDetail } = await import("@/server/ops-alta-pay-commercial-admin.service");
    return getPaymentLinkAdminDetail(linkId);
  });

export const reverseAltaPayAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { referenceCode: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Alta Pay mutations are disabled in UI Lab.");
    }
    const { reverseAltaPayPayment } = await import("@/server/ops-alta-pay-admin.service");
    const id = await actorId();
    return reverseAltaPayPayment(id, data.referenceCode, data.reason, {
      silentNotification: data.silentNotification,
    });
  });

export const fetchCustomer360 = createServerFn({ method: "GET" })
  .inputValidator((payload: string | { userId: string; includeTimeline?: boolean }) => payload)
  .handler(async ({ data }) => {
    const userId = typeof data === "string" ? data : data.userId;
    const includeTimeline = typeof data === "string" ? true : data.includeTimeline ?? true;
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCustomer360 } = await import("@/lib/bank/ui-lab-party-catalog");
      const fixture = getUiLabCustomer360(userId);
      if (fixture) return fixture;
    }
    const { getInternalCustomer360 } = await import("@/server/ops-customer-360.service");
    return getInternalCustomer360(userId, { includeTimeline });
  });

export const fetchCompany360 = createServerFn({ method: "GET" })
  .inputValidator((payload: string | { companyId: string; includeTimeline?: boolean }) => payload)
  .handler(async ({ data }) => {
    const companyId = typeof data === "string" ? data : data.companyId;
    const includeTimeline = typeof data === "string" ? true : data.includeTimeline ?? true;
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { canonicalizeUiLabPartyId, getUiLabParty } = await import(
        "@/lib/bank/ui-lab-party-catalog"
      );
      const canonical = canonicalizeUiLabPartyId(companyId);
      const party = getUiLabParty(canonical);
      if (party?.kind === "company" && party.hasInternalRecord && canonical !== companyId) {
        // Resolve Harbor alias → seed company id before Prisma.
        const { getInternalCompany360 } = await import("@/server/ops-company-360.service");
        try {
          return await getInternalCompany360(canonical, { includeTimeline });
        } catch {
          /* fall through */
        }
      }
    }
    const { getInternalCompany360 } = await import("@/server/ops-company-360.service");
    return getInternalCompany360(companyId, { includeTimeline });
  });

export const fetchAccountOpsSummary = createServerFn({ method: "GET" })
  .inputValidator((accountId: string) => accountId)
  .handler(async ({ data: accountId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabAccountOpsSummary } = await import("@/lib/bank/ui-lab-money-ops-fixtures");
      const fixture = getUiLabAccountOpsSummary(accountId);
      if (fixture) return fixture;
    }
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
    getOpsActivityFeed(12),
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
