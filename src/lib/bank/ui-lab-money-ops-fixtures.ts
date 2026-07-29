/**
 * UI Lab fixtures for internal Money operations (transfers, Alta Pay, interest, statements).
 * In-memory only — never writes to Prisma.
 */
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import type { AltaPayAdminRow, PaginatedResult } from "@/lib/internal/ops-types";
import type { AccountInterestOpsSummary } from "@/lib/bank/account-interest-service";
import type { InternalStatementOpsSummary } from "@/lib/bank/statement-types";
import type { MerchantInvoiceDetail, MerchantInvoiceSummaryRow } from "@/lib/bank/merchant-invoice-types";
import type { PaymentLinkDetail, PaymentLinkSummaryRow } from "@/lib/bank/payment-link-types";
import {
  UI_LAB_CORE_ACCOUNT_ID,
  UI_LAB_CORE_COMPANY_ID,
  UI_LAB_PRO_ACCOUNT_ID,
  UI_LAB_PRO_COMPANY_ID,
  isUiLabCommercialAccount,
  getUiLabInvoiceDashboard,
  getUiLabInvoiceDetail,
  getUiLabPaymentLinkDashboard,
  getUiLabPaymentLinkDetail,
  getUiLabAccountStatements,
} from "@/lib/bank/ui-lab-commercial-fixtures";
import { getRoutingNumber } from "@/lib/bank/routing";
import type {
  InternalBankAccountDetail,
  InternalBankAccountRow,
  InternalBankTransactionRow,
  InternalBankOpsSummary,
} from "@/lib/bank/backend-types";
import type { TransactionDetail, TransactionExplorerRow } from "@/lib/internal/ops-types";

/**
 * Authoritative UI Lab internal-account catalog.
 * Drives Bank Home active count, Accounts directory, detail loaders,
 * related links, statements/interest lists, and search fixtures.
 */
export const UI_LAB_INTERNAL_ACCOUNT_CATALOG = [
  {
    id: "BA-LAB-ACCESS",
    companyId: null as string | null,
    companyName: null as string | null,
    accountName: "Carter — Alta Access",
    accountNumber: "AB-1000-100001",
    balance: 12_450.75,
    holder: "Carter — Alta Access",
    product: "Alta Access",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-CHK",
    companyId: null,
    companyName: null,
    accountName: "Carter — Everyday Checking",
    accountNumber: "AB-2000-100002",
    balance: 38_214.2,
    holder: "Carter — Everyday Checking",
    product: "Checking",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-SAV",
    companyId: null,
    companyName: null,
    accountName: "Carter — High-Yield Savings",
    accountNumber: "AB-3000-100003",
    balance: 127_500,
    holder: "Carter — High-Yield Savings",
    product: "Savings",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-MM",
    companyId: null,
    companyName: null,
    accountName: "Carter — Money Market",
    accountNumber: "AB-6000-100004",
    balance: 5_000,
    holder: "Carter — Money Market",
    product: "Money Market",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-NPC-OP",
    companyId: UI_LAB_PRO_COMPANY_ID,
    companyName: "Newport Petroleum Corp.",
    accountName: "Newport Petroleum — Operating",
    accountNumber: "AB-5000-100010",
    balance: 2_480_300.55,
    holder: "Newport Petroleum — Operating · Newport Petroleum Corp.",
    product: "Operating",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-NPC-MM",
    companyId: UI_LAB_PRO_COMPANY_ID,
    companyName: "Newport Petroleum Corp.",
    accountName: "Newport Petroleum — Money Market",
    accountNumber: "AB-6000-100011",
    balance: 750_000,
    holder: "Newport Petroleum — Money Market · Newport Petroleum Corp.",
    product: "Money Market",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-ALTG-OP",
    companyId: UI_LAB_CORE_COMPANY_ID,
    companyName: "Alta Group N.V.",
    accountName: "Alta Group — Treasury",
    accountNumber: "AB-5000-100020",
    balance: 9_912_450,
    holder: "Alta Group — Treasury · Alta Group N.V.",
    product: "Operating",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: UI_LAB_CORE_ACCOUNT_ID,
    companyId: UI_LAB_CORE_COMPANY_ID,
    companyName: "Alta Group N.V.",
    accountName: "Alta Group Operating",
    accountNumber: "AB-5000-661204",
    balance: 2_390_115.84,
    holder: "Alta Group Operating · Alta Group N.V.",
    product: "Operating",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: UI_LAB_PRO_ACCOUNT_ID,
    companyId: UI_LAB_PRO_COMPANY_ID,
    companyName: "Newport Petroleum Corp.",
    accountName: "Newport Operating",
    accountNumber: "AB-5000-991204",
    balance: 1_845_220.5,
    holder: "Newport Operating · Newport Petroleum Corp.",
    product: "Operating",
    ownerUserId: "ui-lab-user",
    status: "Active",
  },
  {
    id: "BA-LAB-AVA",
    companyId: null,
    companyName: null,
    accountName: "Ava Chen — Personal",
    accountNumber: "AB-5000-100001",
    balance: 8_420.5,
    holder: "Ava Chen",
    product: "Personal",
    ownerUserId: "ui-lab-person-ava",
    status: "Active",
  },
  {
    id: "BA-LAB-NOAH",
    companyId: null,
    companyName: null,
    accountName: "Noah Patel — Personal",
    accountNumber: "AB-5000-100002",
    balance: 3_110.0,
    holder: "Noah Patel",
    product: "Personal",
    ownerUserId: "ui-lab-person-noah",
    status: "Active",
  },
  {
    id: "BA-LAB-HARBOR-P",
    companyId: null,
    companyName: null,
    accountName: "Harbor Line — Personal",
    accountNumber: "AB-5000-100089",
    balance: 12_880.25,
    holder: "Harbor Line",
    product: "Personal",
    ownerUserId: "ui-lab-person-harbor",
    status: "Active",
  },
  {
    id: "BA-LAB-HARBOR-B",
    companyId: "CO-HBR",
    companyName: "Harbor Logistics Ltd.",
    accountName: "Harbor Logistics — Operating",
    accountNumber: "AB-3500-200089",
    balance: 244_500,
    holder: "Harbor Logistics — Operating · Harbor Logistics Ltd.",
    product: "Operating",
    ownerUserId: "ui-lab-person-harbor",
    status: "Active",
  },
] as const;

/** Authoritative UI Lab internal account IDs — directory, search, and record loaders. */
export const UI_LAB_INTERNAL_ACCOUNT_IDS = UI_LAB_INTERNAL_ACCOUNT_CATALOG.map((a) => a.id);

const UI_LAB_ACCOUNT_META: Record<
  string,
  {
    companyId: string | null;
    companyName: string | null;
    accountName: string;
    accountNumber: string;
    balance: number;
    holder: string;
    product: string;
    ownerUserId: string;
    status: string;
  }
> = Object.fromEntries(
  UI_LAB_INTERNAL_ACCOUNT_CATALOG.map((a) => [
    a.id,
    {
      companyId: a.companyId,
      companyName: a.companyName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      balance: a.balance,
      holder: a.holder,
      product: a.product,
      ownerUserId: a.ownerUserId,
      status: a.status,
    },
  ]),
);

export function countUiLabActiveInternalAccounts(): number {
  return UI_LAB_INTERNAL_ACCOUNT_CATALOG.filter((a) => a.status === "Active").length;
}

/** Bank Home ops summary derived from the authoritative catalog (UI Lab only). */
export function getUiLabInternalBankOpsSummary(): InternalBankOpsSummary {
  return {
    totalAccounts: countUiLabActiveInternalAccounts(),
    pendingAccountOpenings: 0,
    pendingDeposits: 2,
    pendingWithdrawals: 2,
    frozenAccounts: 0,
    lendingQueue: 1,
    transfersInReview: 1,
    failedTransfers: 1,
    pendingCardApplications: 1,
    pendingCardReviews: 1,
    altaPayCountThisMonth: 3,
    altaPayVolumeThisMonth: 24_800,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export type InternalScheduledTransferDetail = InternalScheduledTransferRow & {
  frequency: string;
  frequencyLabel: string;
  memo: string | null;
  destinationAccountId: string | null;
  ownerUserId: string | null;
  executions: Array<{
    id: string;
    scheduledRunAt: string;
    status: string;
    statusLabel: string;
    transferReferenceCode: string | null;
    bankTransactionId: string | null;
    failureReason: string | null;
    executedAt: string | null;
  }>;
};

export function getUiLabInternalScheduledTransfers(): InternalScheduledTransferRow[] {
  return [
    {
      id: "ui-lab-xfer-active",
      label: "Operating → reserve",
      amount: 2_500,
      currency: "FLD",
      status: "approved",
      statusLabel: "Active",
      paymentType: "recurring",
      transferScope: "INTRABANK",
      sourceAccountId: UI_LAB_CORE_ACCOUNT_ID,
      sourceAccountName: "Alta Group operating",
      sourceAccountNumber: "AB-1000-220011",
      destinationAccountNumber: "AB-1000-330022",
      destinationName: "Alta Group reserve",
      ownerLabel: "Alta Group",
      ownerType: "company",
      companyId: UI_LAB_CORE_COMPANY_ID,
      nextRunAt: daysFromNow(3),
      lastRunAt: daysFromNow(-27),
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: "executed",
      lastExecutionStatusLabel: "Executed",
      createdAt: daysFromNow(-90),
    },
    {
      id: "ui-lab-xfer-failed",
      label: "Payroll float",
      amount: 12_000,
      currency: "FLD",
      status: "failed",
      statusLabel: "Failed",
      paymentType: "one_time",
      transferScope: "INTRABANK",
      sourceAccountId: UI_LAB_CORE_ACCOUNT_ID,
      sourceAccountName: "Alta Group operating",
      sourceAccountNumber: "AB-1000-220011",
      destinationAccountNumber: "AB-1000-440033",
      destinationName: "Payroll float",
      ownerLabel: "Alta Group",
      ownerType: "company",
      companyId: UI_LAB_CORE_COMPANY_ID,
      nextRunAt: null,
      lastRunAt: daysFromNow(-1),
      consecutiveFailures: 2,
      lastFailureReason: "Insufficient available balance",
      lastExecutionStatus: "failed",
      lastExecutionStatusLabel: "Failed",
      createdAt: daysFromNow(-14),
    },
    {
      id: "ui-lab-xfer-paused",
      label: "Weekly savings",
      amount: 400,
      currency: "FLD",
      status: "paused",
      statusLabel: "Paused",
      paymentType: "recurring",
      transferScope: "INTRABANK",
      sourceAccountId: UI_LAB_CORE_ACCOUNT_ID,
      sourceAccountName: "Alta Group operating",
      sourceAccountNumber: "AB-1000-220011",
      destinationAccountNumber: "AB-1000-550044",
      destinationName: "Savings",
      ownerLabel: "carter.ops",
      ownerType: "personal",
      companyId: null,
      nextRunAt: daysFromNow(7),
      lastRunAt: daysFromNow(-7),
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: "executed",
      lastExecutionStatusLabel: "Executed",
      createdAt: daysFromNow(-45),
    },
    {
      id: "ui-lab-xfer-done",
      label: "One-time rebalance",
      amount: 8_750,
      currency: "FLD",
      status: "executed",
      statusLabel: "Completed",
      paymentType: "one_time",
      transferScope: "INTRABANK",
      sourceAccountId: UI_LAB_CORE_ACCOUNT_ID,
      sourceAccountName: "Alta Group operating",
      sourceAccountNumber: "AB-1000-220011",
      destinationAccountNumber: "AB-1000-330022",
      destinationName: "Alta Group reserve",
      ownerLabel: "Alta Group",
      ownerType: "company",
      companyId: UI_LAB_CORE_COMPANY_ID,
      nextRunAt: null,
      lastRunAt: daysFromNow(-10),
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: "executed",
      lastExecutionStatusLabel: "Executed",
      createdAt: daysFromNow(-12),
    },
    {
      id: "ui-lab-xfer-cancelled",
      label: "Cancelled move",
      amount: 1_000,
      currency: "FLD",
      status: "cancelled",
      statusLabel: "Cancelled",
      paymentType: "one_time",
      transferScope: "INTRABANK",
      sourceAccountId: UI_LAB_CORE_ACCOUNT_ID,
      sourceAccountName: "Alta Group operating",
      sourceAccountNumber: "AB-1000-220011",
      destinationAccountNumber: "AB-1000-330022",
      destinationName: "Alta Group reserve",
      ownerLabel: "Alta Group",
      ownerType: "company",
      companyId: UI_LAB_CORE_COMPANY_ID,
      nextRunAt: null,
      lastRunAt: null,
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: null,
      lastExecutionStatusLabel: null,
      createdAt: daysFromNow(-20),
    },
  ];
}

export function getUiLabInternalScheduledTransferDetail(
  transferId: string,
): InternalScheduledTransferDetail | null {
  const row = getUiLabInternalScheduledTransfers().find((t) => t.id === transferId);
  if (!row) return null;
  const executions =
    row.lastRunAt != null
      ? [
          {
            id: `${row.id}-exec-1`,
            scheduledRunAt: row.lastRunAt,
            status: row.lastExecutionStatus ?? "executed",
            statusLabel: row.lastExecutionStatusLabel ?? "Executed",
            transferReferenceCode: row.status === "executed" || row.lastExecutionStatus === "executed"
              ? `XFER-${row.id.slice(-6).toUpperCase()}`
              : null,
            bankTransactionId:
              row.lastExecutionStatus === "executed" ? `ui-lab-tx-${row.id}` : null,
            failureReason: row.lastFailureReason,
            executedAt: row.lastRunAt,
          },
        ]
      : [];
  return {
    ...row,
    frequency: row.paymentType === "recurring" ? "monthly" : "once",
    frequencyLabel: row.paymentType === "recurring" ? "Monthly" : "Once",
    memo: null,
    destinationAccountId: null,
    ownerUserId: row.ownerType === "personal" ? "ui-lab-user" : null,
    executions,
  };
}

export function getUiLabAltaPayPayments(
  q?: string,
  opts?: { limit?: number; offset?: number },
): PaginatedResult<AltaPayAdminRow> {
  const items: AltaPayAdminRow[] = [
    {
      referenceCode: "APAY-UILAB-001",
      amount: 1_250,
      payerLabel: "carter.ops",
      payerAccountNumber: "AB-2000-100001",
      merchantName: "Alta Group",
      merchantAccountNumber: "AB-1000-220011",
      status: "APPROVED",
      memo: "Consulting retainer",
      createdAt: daysFromNow(-2),
      outTransactionId: "ui-lab-apay-out-1",
      inTransactionId: "ui-lab-apay-in-1",
    },
    {
      referenceCode: "APAY-UILAB-002",
      amount: 480,
      payerLabel: "North Pier Co",
      payerAccountNumber: "AB-1000-990011",
      merchantName: "Alta Group",
      merchantAccountNumber: "AB-1000-220011",
      status: "PENDING",
      memo: "Invoice settlement",
      createdAt: daysFromNow(-1),
      outTransactionId: "ui-lab-apay-out-2",
      inTransactionId: "ui-lab-apay-in-2",
    },
    {
      referenceCode: "APAY-UILAB-003",
      amount: 90,
      payerLabel: "maya.chen",
      payerAccountNumber: "AB-2000-441200",
      merchantName: "North Pier Co",
      merchantAccountNumber: "AB-1000-880022",
      status: "DENIED",
      memo: "Cancelled payment",
      createdAt: daysFromNow(-5),
      outTransactionId: "ui-lab-apay-out-3",
      inTransactionId: "ui-lab-apay-in-3",
    },
  ];
  const needle = q?.trim().toLowerCase();
  const filtered = needle
    ? items.filter(
        (r) =>
          r.referenceCode.toLowerCase().includes(needle) ||
          r.payerLabel.toLowerCase().includes(needle) ||
          r.merchantName.toLowerCase().includes(needle) ||
          (r.memo ?? "").toLowerCase().includes(needle),
      )
    : items;
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const page = filtered.slice(offset, offset + limit);
  return {
    items: page,
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + page.length < filtered.length,
  };
}

export function getUiLabAltaPayPaymentDetail(referenceCode: string): AltaPayAdminRow | null {
  const base = referenceCode.replace(/-OUT$|-IN$/i, "");
  return getUiLabAltaPayPayments().items.find((r) => r.referenceCode === base) ?? null;
}

export function getUiLabInternalInterestOps(): AccountInterestOpsSummary {
  return {
    dueAccountCount: 2,
    interestBearingActiveCount: 8,
    estimatedTotalInterestDue: 186.42,
    lastInterestRunAt: daysFromNow(-12),
    totalInterestCreditedThisMonth: 1_240.15,
    dueAccounts: [
      {
        accountId: UI_LAB_CORE_ACCOUNT_ID,
        accountNumber: "AB-1000-220011",
        accountName: "Alta Group operating",
        holder: "Alta Group",
        balance: 84_200,
        interestRate: 0.025,
        rateLabel: "2.50% APY",
        nextInterestAccrualAt: daysFromNow(2),
        estimatedInterest: 142.1,
      },
      {
        accountId: "ui-lab-personal-savings",
        accountNumber: "AB-2000-550044",
        accountName: "Personal savings",
        holder: "carter.ops",
        balance: 12_400,
        interestRate: 0.03,
        rateLabel: "3.00% APY",
        nextInterestAccrualAt: daysFromNow(2),
        estimatedInterest: 44.32,
      },
    ],
  };
}

export function getUiLabInternalStatementOps(): InternalStatementOpsSummary {
  const recent = [
    ...getUiLabAccountStatements(UI_LAB_CORE_ACCOUNT_ID),
    ...getUiLabAccountStatements("ui-lab-biz-pro"),
  ].slice(0, 12);
  return {
    recentStatements: recent,
    voidedCount: 1,
    schedulerJob: {
      jobKey: "BANK_ACCOUNT_STATEMENTS",
      label: "Bank account statements",
      lastStatus: "success",
      lastSuccessAt: daysFromNow(-3),
      lastFailureAt: null,
      summary: {
        startedAt: daysFromNow(-3),
        completedAt: daysFromNow(-3),
        durationMs: 4_200,
        processedCount: 12,
        successCount: 11,
        skippedCount: 1,
        failureCount: 0,
        periodStart: daysFromNow(-33).slice(0, 10),
        periodEnd: daysFromNow(-3).slice(0, 10),
        errorSummary: null,
      },
    },
  };
}

export function getUiLabInternalInvoiceRows(): MerchantInvoiceSummaryRow[] {
  const rows = [
    ...getUiLabInvoiceDashboard(UI_LAB_CORE_COMPANY_ID).recent,
    ...getUiLabInvoiceDashboard(UI_LAB_PRO_COMPANY_ID).recent,
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function getUiLabInternalInvoiceDetail(invoiceId: string): MerchantInvoiceDetail | null {
  return (
    getUiLabInvoiceDetail(UI_LAB_CORE_COMPANY_ID, invoiceId) ??
    getUiLabInvoiceDetail(UI_LAB_PRO_COMPANY_ID, invoiceId)
  );
}

export function getUiLabInternalPaymentLinkRows(): PaymentLinkSummaryRow[] {
  const rows = [
    ...getUiLabPaymentLinkDashboard(UI_LAB_CORE_COMPANY_ID).recent,
    ...getUiLabPaymentLinkDashboard(UI_LAB_PRO_COMPANY_ID).recent,
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function getUiLabInternalPaymentLinkDetail(linkId: string): PaymentLinkDetail | null {
  return (
    getUiLabPaymentLinkDetail(UI_LAB_CORE_COMPANY_ID, linkId) ??
    getUiLabPaymentLinkDetail(UI_LAB_PRO_COMPANY_ID, linkId)
  );
}

function formatUiLabBalance(amount: number): string {
  return `ƒ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relatedTxRowsForAccount(accountId: string): InternalBankTransactionRow[] {
  const meta = UI_LAB_ACCOUNT_META[accountId];
  if (!meta) return [];
  return listUiLabTransactionExplorerRows()
    .filter((tx) => tx.accountNumber === meta.accountNumber)
    .slice(0, 8)
    .map((tx) => ({
      id: tx.id,
      referenceCode: tx.referenceCode,
      type: tx.type,
      account: tx.accountNumber,
      holder: tx.holder,
      amount: formatUiLabBalance(tx.amount),
      method: "Internal",
      status: tx.status,
      submitted: tx.createdAt,
      proofImageUrl: tx.status === "PENDING" && tx.type === "DEPOSIT" ? "/ui-lab/proof.png" : null,
      proofFileName: tx.status === "PENDING" && tx.type === "DEPOSIT" ? "proof.png" : null,
      proofUploadedAt: tx.status === "PENDING" && tx.type === "DEPOSIT" ? tx.createdAt : null,
      hasProof: tx.status === "PENDING" && tx.type === "DEPOSIT",
      description: tx.description,
      memo: null,
    }));
}

/** Authoritative internal account workspace fixtures (same IDs as the directory). */
export function getUiLabInternalBankAccountDetail(
  accountId: string,
): InternalBankAccountDetail | null {
  const meta = UI_LAB_ACCOUNT_META[accountId];
  if (!meta) {
    // Fall back to commercial-only accounts that may not yet be in the expanded catalog.
    if (isUiLabCommercialAccount(accountId)) {
      return null;
    }
    return null;
  }
  const related = relatedTxRowsForAccount(accountId);
  const now = "2025-06-01T00:00:00.000Z";
  return {
    id: accountId,
    accountNumber: meta.accountNumber,
    accountName: meta.accountName,
    holder: meta.holder,
    ownerUserId: meta.ownerUserId,
    product: meta.product,
    balance: meta.balance,
    currency: "FLD",
    status: meta.status,
    routingNumber: getRoutingNumber(),
    companyId: meta.companyId,
    companyName: meta.companyName,
    openingNotes: null,
    createdAt: now,
    updatedAt: now,
    pendingTransactions: related.filter((t) => t.status.toUpperCase() === "PENDING"),
    recentTransactions: related,
  };
}

/** Ops summary for UI Lab account workspaces — empty holds/schedules, no Prisma. */
export function getUiLabAccountOpsSummary(accountId: string) {
  if (!UI_LAB_ACCOUNT_META[accountId] && !isUiLabCommercialAccount(accountId)) return null;
  return {
    holds: [] as Array<{
      id: string;
      amount: number;
      reason: string;
      status: string;
      createdAt: string;
    }>,
    activeHoldTotal: 0,
    scheduled: [] as Array<{
      id: string;
      label: string;
      amount: number;
      nextRunDate: string | null;
      status: string;
    }>,
    statements: [] as Array<{
      id: string;
      statementNumber: string;
      periodEnd: string;
      status: string;
    }>,
    restrictions: {
      restrictDeposits: false,
      restrictWithdrawals: false,
      restrictTransfers: false,
    },
  };
}

/** Internal accounts directory rows for UI Lab. */
export function getUiLabInternalBankAccountRows(filters?: {
  q?: string;
  status?: string;
  accountType?: string;
}): InternalBankAccountRow[] {
  const rows = UI_LAB_INTERNAL_ACCOUNT_IDS.map((id) => {
    const detail = getUiLabInternalBankAccountDetail(id)!;
    return {
      id: detail.id,
      accountNumber: detail.accountNumber,
      accountName: detail.accountName,
      holder: detail.holder,
      product: detail.product,
      balance: formatUiLabBalance(detail.balance),
      status: detail.status,
      companyName: detail.companyName,
      createdAt: detail.createdAt.slice(0, 10),
      lastActivityAt: detail.updatedAt,
    };
  });
  const q = filters?.q?.trim().toLowerCase();
  let filtered = rows;
  if (q) {
    filtered = filtered.filter((r) =>
      [r.accountName, r.accountNumber, r.holder, r.companyName ?? "", r.product]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (filters?.status) {
    const s = filters.status.toLowerCase();
    filtered = filtered.filter((r) => r.status.toLowerCase() === s || r.status.toLowerCase().includes(s));
  }
  if (filters?.accountType) {
    const t = filters.accountType.toLowerCase();
    filtered = filtered.filter((r) => r.product.toLowerCase().includes(t));
  }
  return filtered;
}

/** Full transaction explorer catalog — shared by directory pagination and record detail. */
export function listUiLabTransactionExplorerRows(): TransactionExplorerRow[] {
  const base: TransactionExplorerRow[] = [];
  const types = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "INTEREST_CREDIT", "LOAN_PAYMENT"] as const;
  const statuses = ["PENDING", "APPROVED", "DENIED", "APPROVED", "APPROVED"] as const;
  for (let i = 0; i < 54; i++) {
    const type = types[i % types.length]!;
    const status = i < 3 ? "PENDING" : statuses[i % statuses.length]!;
    base.push({
      id: `ui-lab-tx-${i + 1}`,
      referenceCode: `TX-UILAB-${String(i + 1).padStart(4, "0")}`,
      type,
      status,
      amount: 100 + i * 17,
      accountNumber: i % 2 === 0 ? "AB-5000-661204" : "AB-5000-991204",
      holder: i % 2 === 0 ? "Alta Group" : "Newport Petroleum",
      description: type === "WITHDRAWAL" && i === 1 ? "Alta Pay settlement" : `${type} fixture`,
      createdAt: daysFromNow(-(i + 1)),
    });
  }
  return base;
}

export function getUiLabTransactionDetail(transactionId: string): TransactionDetail | null {
  const row = listUiLabTransactionExplorerRows().find((t) => t.id === transactionId);
  if (!row) return null;
  const accountId =
    row.accountNumber === "AB-5000-991204" ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID;
  const meta = UI_LAB_ACCOUNT_META[accountId];
  const isPending = row.status.toUpperCase() === "PENDING";
  const isApproved = row.status.toUpperCase() === "APPROVED";
  return {
    ...row,
    accountId,
    balanceBefore: null,
    balanceAfter: isApproved && meta ? meta.balance : null,
    memo: null,
    reviewNote: isPending ? null : row.status === "DENIED" ? "Denied in UI Lab fixture" : "Approved in UI Lab fixture",
    reviewedByLabel: isPending ? null : "ui-lab-operator",
    reviewedAt: isPending ? null : row.createdAt,
    proofImageUrl:
      isPending && (row.type === "DEPOSIT" || row.type === "WITHDRAWAL")
        ? "/ui-lab/proof.png"
        : null,
    linkedTransactions: [],
    relatedLoanId: row.type === "LOAN_PAYMENT" ? "LN-LAB-ACTIVE" : null,
    relatedAltaPayRef: row.description.includes("Alta Pay") ? "APAY-UILAB-001" : null,
    relatedStatementId: null,
    canReverseAdjustment: false,
  };
}

/** Transaction explorer fixtures — enough rows to exercise pagination. */
export function getUiLabTransactionExplorer(
  filters: {
    q?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
): PaginatedResult<TransactionExplorerRow> {
  let filtered = listUiLabTransactionExplorerRows();
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((r) =>
      [r.referenceCode, r.accountNumber, r.holder, r.description ?? "", r.type]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (filters.type) {
    filtered = filtered.filter((r) => r.type.toUpperCase() === filters.type!.toUpperCase());
  }
  if (filters.status) {
    filtered = filtered.filter((r) => r.status.toUpperCase() === filters.status!.toUpperCase());
  } else {
    const rank = (status: string) => {
      const s = status.toUpperCase();
      if (s === "PENDING") return 0;
      if (s === "DENIED") return 1;
      return 2;
    };
    filtered = [...filtered].sort((a, b) => {
      const sr = rank(a.status) - rank(b.status);
      if (sr !== 0) return sr;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  const items = filtered.slice(offset, offset + limit);
  return {
    items,
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + items.length < filtered.length,
  };
}

