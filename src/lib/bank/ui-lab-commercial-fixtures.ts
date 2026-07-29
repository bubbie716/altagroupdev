/**
 * UI LAB ONLY — deterministic Commercial Core / Pro fixtures.
 * Never create real charges, Discord messages, or Prisma mutations.
 */
import type { AltaUser } from "@/lib/auth/types";
import { isUiLabMode, UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import type { UserBankAccount, UserBankAccountDetail } from "@/lib/bank/backend-types";
import type {
  CommercialBankingContext,
  CommercialDashboard,
  CommercialPlan,
  MerchantAnalytics,
} from "@/lib/bank/commercial-banking-types";
import {
  DEFAULT_COMMERCIAL_FEATURES,
  DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
} from "@/lib/bank/commercial-banking-types";
import type {
  CommercialBillingPreview,
  CommercialDowngradePreview,
  CommercialDowngradeResult,
  CommercialPurchaseResult,
} from "@/lib/bank/commercial-billing-types";
import type {
  MerchantInvoiceDashboard,
  MerchantInvoiceDetail,
  MerchantInvoiceSummaryRow,
  UpdateMerchantInvoiceDraftInput,
  CreateMerchantInvoiceInput,
} from "@/lib/bank/merchant-invoice-types";
import { UNPAID_INVOICE_STATUSES } from "@/lib/bank/merchant-invoice-types";
import type { PaymentLinkDashboard, PaymentLinkDetail } from "@/lib/bank/payment-link-types";
import type {
  BusinessBankingOverview,
  BusinessRepresentativeRow,
  BusinessTreasuryCompany,
  PayrollEmployeeRow,
  PayrollRunRow,
  ScheduledPaymentRow,
} from "@/lib/bank/business-banking-types";
import { COMPANY_ROLE_LABELS } from "@/lib/bank/business-banking-types";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";
import type { PayableRecipient } from "@/lib/bank/alta-pay-types";
import type {
  BankStatementDetail,
  BankStatementSummary,
  GenerateStatementsBatchInput,
  GenerateStatementsBatchResult,
  StatementGeneratableAccount,
} from "@/lib/bank/statement-types";
import { getRoutingNumber } from "@/lib/bank/routing";
import type { BusinessAccountModule } from "@/lib/bank/business-account-access";
import { getBusinessModuleAccess } from "@/lib/bank/business-account-access";
import { paymentLinkCheckoutPath } from "@/lib/bank/payment-link-checkout-url";

export const UI_LAB_CORE_COMPANY_ID = "CO-ALTG";
export const UI_LAB_PRO_COMPANY_ID = "CO-NPC";
export const UI_LAB_CORE_ACCOUNT_ID = "ui-lab-biz-core";
export const UI_LAB_PRO_ACCOUNT_ID = "ui-lab-biz-pro";
/**
 * Verified third-party company used as an invoice recipient (not owned by the UI Lab user).
 * Canonical id matches UI Lab seed `CO-HBR` so company workspaces resolve.
 */
export const UI_LAB_HARBOR_COMPANY_ID = "CO-HBR";

const CORE_LIMITS = {
  coreInvoiceMonthlyLimit: 25,
  corePaymentLinkMonthlyLimit: 5,
  coreTeamMemberLimit: 5,
} as const;

type PlanOverlay = {
  commercialPlan: CommercialPlan;
  planStatus: "ACTIVE" | "SUSPENDED" | "PENDING";
  billingStatus: "NOT_BILLED" | "CURRENT" | "PAST_DUE";
  billingAccountId: string;
  nextBillingAt: string | null;
  downgradeScheduledAt: string | null;
  pastDueAt: string | null;
  proSubscribedAt: string | null;
  grantSource: "PURCHASED" | "ADMIN_GRANT" | null;
  monthlyFee: number | null;
  /** Forces insufficient-funds on the next UI Lab purchase attempt. */
  forceInsufficientFunds?: boolean;
};

const overlays = new Map<string, PlanOverlay>();
/** Session-scoped invoice creates/mutations (in-memory only; never Prisma). Keyed by companyId. */
const sessionInvoices = new Map<string, MerchantInvoiceDetail[]>();
/** Session-scoped statement creates (in-memory only). Keyed by accountId. */
const sessionStatements = new Map<string, BankStatementDetail[]>();

function isoDaysFromNow(days: number): string {
  const d = new Date("2026-07-26T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function defaultOverlay(companyId: string): PlanOverlay {
  if (companyId === UI_LAB_PRO_COMPANY_ID) {
    return {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "CURRENT",
      billingAccountId: UI_LAB_PRO_ACCOUNT_ID,
      nextBillingAt: isoDaysFromNow(18),
      downgradeScheduledAt: null,
      pastDueAt: null,
      proSubscribedAt: isoDaysFromNow(-42),
      grantSource: "PURCHASED",
      monthlyFee: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
    };
  }
  return {
    commercialPlan: "CORE",
    planStatus: "ACTIVE",
    billingStatus: "NOT_BILLED",
    billingAccountId: UI_LAB_CORE_ACCOUNT_ID,
    nextBillingAt: null,
    downgradeScheduledAt: null,
    pastDueAt: null,
    proSubscribedAt: null,
    grantSource: null,
    monthlyFee: null,
  };
}

function readOverlay(companyId: string): PlanOverlay {
  const existing = overlays.get(companyId);
  if (existing) return existing;
  const created = defaultOverlay(companyId);
  overlays.set(companyId, created);
  return created;
}

export function resetUiLabCommercialOverlays(): void {
  overlays.clear();
  sessionInvoices.clear();
  sessionStatements.clear();
}

export function isUiLabCommercialCompany(companyId: string): boolean {
  return companyId === UI_LAB_CORE_COMPANY_ID || companyId === UI_LAB_PRO_COMPANY_ID;
}

export function isUiLabCommercialAccount(accountId: string): boolean {
  return accountId === UI_LAB_CORE_ACCOUNT_ID || accountId === UI_LAB_PRO_ACCOUNT_ID;
}

function companyName(companyId: string): string {
  const membership = UI_LAB_MOCK_USER.companyMemberships.find((m) => m.companyId === companyId);
  return membership?.companyName ?? companyId;
}

function accountMeta(accountId: string): {
  companyId: string;
  companyName: string;
  accountName: string;
  accountNumber: string;
  balance: number;
} {
  if (accountId === UI_LAB_PRO_ACCOUNT_ID) {
    return {
      companyId: UI_LAB_PRO_COMPANY_ID,
      companyName: companyName(UI_LAB_PRO_COMPANY_ID),
      accountName: "Newport Operating",
      accountNumber: "AB-5000-991204",
      balance: 1_845_220.5,
    };
  }
  return {
    companyId: UI_LAB_CORE_COMPANY_ID,
    companyName: companyName(UI_LAB_CORE_COMPANY_ID),
    accountName: "Alta Group Operating",
    accountNumber: "AB-5000-661204",
    balance: 2_390_115.84,
  };
}

function goodStandingStatus(balance: number) {
  return {
    accountStatus: "active" as const,
    restrictDeposits: false,
    restrictWithdrawals: false,
    restrictTransfers: false,
    heldFunds: 0,
    pendingWithdrawals: 0,
    inGoodStanding: true,
    hasIssues: false,
    headline: "In good standing",
    notices: [] as string[],
  };
}

function toUserBankAccount(accountId: string): UserBankAccount {
  const meta = accountMeta(accountId);
  const routingNumber = getRoutingNumber();
  return {
    id: accountId,
    accountName: meta.accountName,
    accountType: "business_operating",
    accountTypeLabel: "Business Operating",
    accountNumber: meta.accountNumber,
    routingNumber,
    balance: meta.balance,
    availableBalance: meta.balance,
    status: "active",
    statusLabel: "Active",
    currency: "FLD",
    companyId: meta.companyId,
    companyName: meta.companyName,
    isCompanyAccount: true,
    openingNotes: null,
    restrictDeposits: false,
    restrictWithdrawals: false,
    restrictTransfers: false,
    createdAt: "2025-06-01T00:00:00.000Z",
    recentActivity: "Customer payment · Jul 22",
    name: meta.accountName,
    product: "Operating",
    type: "Business",
    interestAccrualEnabled: false,
    interestRateLabel: null,
    accountStatusInfo: goodStandingStatus(meta.balance),
  };
}

export function getUiLabBankAccounts(): UserBankAccount[] {
  if (!isUiLabMode()) return [];
  return [toUserBankAccount(UI_LAB_CORE_ACCOUNT_ID), toUserBankAccount(UI_LAB_PRO_ACCOUNT_ID)];
}

function toBusinessTreasuryCompany(accountId: string): BusinessTreasuryCompany {
  const meta = accountMeta(accountId);
  const membership = UI_LAB_MOCK_USER.companyMemberships.find((m) => m.companyId === meta.companyId);
  const role = membership?.role ?? "owner";
  return {
    companyId: meta.companyId,
    companyName: meta.companyName,
    operatingAccount: {
      id: accountId,
      accountName: meta.accountName,
      accountNumber: meta.accountNumber,
      balance: meta.balance,
      currency: "FLD",
    },
    permissions: {
      canView: true,
      canManage: true,
      viewOnly: false,
      role,
      roleLabel: COMPANY_ROLE_LABELS[role],
    },
  };
}

/** Authoritative Business hub overview — same account IDs as commercial routes. */
export function getUiLabBusinessBankingOverview(
  selectedCompanyId?: string,
): BusinessBankingOverview {
  const companies: BusinessTreasuryCompany[] = [
    toBusinessTreasuryCompany(UI_LAB_CORE_ACCOUNT_ID),
    toBusinessTreasuryCompany(UI_LAB_PRO_ACCOUNT_ID),
  ];
  const selected =
    selectedCompanyId && companies.some((c) => c.companyId === selectedCompanyId)
      ? selectedCompanyId
      : companies[0]?.companyId ?? null;
  return { companies, selectedCompanyId: selected };
}

export function resolveUiLabOperatingAccountId(companyId: string): string | null {
  if (companyId === UI_LAB_CORE_COMPANY_ID) return UI_LAB_CORE_ACCOUNT_ID;
  if (companyId === UI_LAB_PRO_COMPANY_ID) return UI_LAB_PRO_ACCOUNT_ID;
  return null;
}

/**
 * Canonical UI Lab payable / invoice recipient catalog.
 * Single source for Alta Pay and merchant invoice search.
 */
export const UI_LAB_PAYABLE_RECIPIENTS: PayableRecipient[] = [
  {
    kind: "person",
    id: "ui-lab-person-ava",
    name: "Ava Chen",
    subtitle: "@ava",
    destinationLabel: "Personal · AB-5000-100001",
    canReceive: true,
  },
  {
    kind: "person",
    id: "ui-lab-person-noah",
    name: "Noah Patel",
    subtitle: "@noah",
    destinationLabel: "Personal · AB-5000-100002",
    canReceive: true,
  },
  {
    kind: "person",
    id: "ui-lab-person-harbor",
    name: "Harbor Line",
    subtitle: "@HarborLine",
    destinationLabel: "Personal · AB-5000-100089",
    canReceive: true,
  },
  {
    kind: "company",
    id: UI_LAB_HARBOR_COMPANY_ID,
    name: "Harbor Logistics Ltd.",
    subtitle: "Verified company · HBR",
    destinationLabel: "Business Operating · AB-3500-200089",
    canReceive: true,
  },
  {
    kind: "company",
    id: UI_LAB_CORE_COMPANY_ID,
    name: "Alta Group N.V.",
    subtitle: "Verified company · ALTG",
    destinationLabel: "Business Operating · AB-5000-661204",
    canReceive: true,
  },
  {
    kind: "company",
    id: UI_LAB_PRO_COMPANY_ID,
    name: "Newport Petroleum Corp.",
    subtitle: "Verified company · NPC",
    destinationLabel: "Business Operating · AB-5000-991204",
    canReceive: true,
  },
  {
    kind: "person",
    id: "ui-lab-person-riley",
    name: "Riley Quinn",
    subtitle: "@riley",
    destinationLabel: "No active personal Alta Bank account",
    canReceive: false,
  },
];

export function searchUiLabPayableRecipients(query: string): PayableRecipient[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q === "zzz" || q === "no-match") return [];
  return UI_LAB_PAYABLE_RECIPIENTS.filter(
    (recipient) =>
      recipient.name.toLowerCase().includes(q) ||
      recipient.subtitle?.toLowerCase().includes(q) ||
      recipient.id.toLowerCase().includes(q) ||
      recipient.destinationLabel?.toLowerCase().includes(q),
  );
}

export function searchUiLabInvoiceRecipients(query: string): MerchantInvoiceRecipientOption[] {
  return searchUiLabPayableRecipients(query).map((recipient) => ({
    kind: recipient.kind,
    id: recipient.id,
    displayName: recipient.name,
    subtitle: recipient.subtitle,
    canReceive: recipient.canReceive,
    destinationLabel: recipient.destinationLabel ?? "Alta Bank account",
  }));
}

export function getUiLabBankAccountDetail(accountId: string): UserBankAccountDetail | null {
  if (!isUiLabMode() || !isUiLabCommercialAccount(accountId)) return null;
  const base = toUserBankAccount(accountId);
  return {
    ...base,
    ownerLabel: base.companyName ?? "Company",
    depositsThisMonth: 128_440,
    withdrawalsThisMonth: 42_100,
    netChangeThisMonth: 86_340,
    recentTransactions: [
      {
        id: `${accountId}-txn-1`,
        referenceCode: "TXN-UILAB-001",
        bankAccountId: accountId,
        accountName: base.accountName,
        accountNumber: base.accountNumber,
        type: "deposit",
        typeLabel: "Deposit",
        amount: 12_500,
        status: "approved",
        statusLabel: "Approved",
        description: "Payment link · Harbor Logistics",
        memo: null,
        proofImageUrl: null,
        proofFileName: null,
        proofUploadedAt: null,
        hasProof: false,
        createdAt: "2026-07-22T14:20:00.000Z",
        reviewedAt: "2026-07-22T14:20:00.000Z",
        reviewNote: null,
      },
    ],
    interestInfo: { applicable: false },
  };
}

export function getUiLabBusinessAccountContext(
  accountId: string,
  requiredModule?: BusinessAccountModule,
) {
  if (!isUiLabMode() || !isUiLabCommercialAccount(accountId)) return null;
  const meta = accountMeta(accountId);
  const membership = UI_LAB_MOCK_USER.companyMemberships.find((m) => m.companyId === meta.companyId);
  const role = membership?.role ?? "owner";
  const moduleAccess = {
    overview: getBusinessModuleAccess(role, "overview"),
    activity: getBusinessModuleAccess(role, "activity"),
    payments: getBusinessModuleAccess(role, "payments"),
    payroll: getBusinessModuleAccess(role, "payroll"),
    statements: getBusinessModuleAccess(role, "statements"),
    representatives: getBusinessModuleAccess(role, "representatives"),
    settings: getBusinessModuleAccess(role, "settings"),
  };
  if (requiredModule && moduleAccess[requiredModule] === "none") {
    throw new Error("FORBIDDEN");
  }
  return {
    accountId,
    companyId: meta.companyId,
    companyName: meta.companyName,
    role,
    treasury: toBusinessTreasuryCompany(accountId),
    moduleAccess,
  };
}

export function getUiLabCommercialContext(
  user: AltaUser,
  companyId: string,
): CommercialBankingContext | null {
  if (!isUiLabMode() || !isUiLabCommercialCompany(companyId)) return null;
  if (!user.companyMemberships.some((m) => m.companyId === companyId)) return null;
  const plan = readOverlay(companyId);
  const accountId =
    companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID;
  return {
    companyId,
    companyName: companyName(companyId),
    accountId,
    verificationStatus: "verified",
    isVerified: true,
    canManage: true,
    canViewAnalytics: true,
    plan: {
      commercialPlan: plan.commercialPlan,
      planStatus: plan.planStatus,
      billingStatus: plan.billingStatus,
      monthlyFee: plan.monthlyFee,
      enabledFeatures: DEFAULT_COMMERCIAL_FEATURES[plan.commercialPlan],
    },
  };
}

export function getUiLabReceivableCreationLimits(companyId: string) {
  const plan = readOverlay(companyId);
  const isPro = plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE";
  const paymentLinksThisMonth = isPro ? 8 : CORE_LIMITS.corePaymentLinkMonthlyLimit;
  const invoicesThisMonth = isPro ? 14 : 6;
  return {
    canCreatePaymentLink: isPro || paymentLinksThisMonth < CORE_LIMITS.corePaymentLinkMonthlyLimit,
    canCreateInvoice: isPro || invoicesThisMonth < CORE_LIMITS.coreInvoiceMonthlyLimit,
    paymentLinksThisMonth,
    paymentLinkMonthlyLimit: CORE_LIMITS.corePaymentLinkMonthlyLimit,
    invoicesThisMonth,
    invoiceMonthlyLimit: CORE_LIMITS.coreInvoiceMonthlyLimit,
    isPro,
    paymentLinkLimitMessage: `Alta Commercial Core allows up to ${CORE_LIMITS.corePaymentLinkMonthlyLimit} payment links created per month. Upgrade to Pro in Commercial settings for unlimited payment links.`,
    invoiceLimitMessage: `Alta Commercial Core allows up to ${CORE_LIMITS.coreInvoiceMonthlyLimit} invoices per month. Upgrade to Pro in Commercial settings for unlimited invoices.`,
  };
}

export function getUiLabCommercialSettings(companyId: string) {
  const plan = readOverlay(companyId);
  const isPro = plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE";
  const usage = getUiLabReceivableCreationLimits(companyId);
  return {
    companyId,
    companyName: companyName(companyId),
    canManagePlan: true,
    canPurchasePro: !isPro,
    canDowngradePro: isPro,
    canManageBillingAccount: isPro,
    planFeatures: DEFAULT_COMMERCIAL_FEATURES[plan.commercialPlan],
    billingAccountId: plan.billingAccountId,
    nextBillingAt: plan.nextBillingAt,
    pastDueAt: plan.pastDueAt,
    proSubscribedAt: plan.proSubscribedAt,
    downgradeScheduledAt: plan.downgradeScheduledAt,
    grantSource: plan.grantSource,
    expiresAt: null as string | null,
    usage: {
      invoicesThisMonth: usage.invoicesThisMonth,
      paymentLinksThisMonth: usage.paymentLinksThisMonth,
      teamMembers: isPro ? 4 : 3,
      limits: { ...CORE_LIMITS },
      isPro,
    },
    commercialPlan: plan.commercialPlan,
    planStatus: plan.planStatus,
    billingStatus: plan.billingStatus,
    monthlyFee: plan.monthlyFee,
    enabledFeatures: DEFAULT_COMMERCIAL_FEATURES[plan.commercialPlan],
  };
}

export function getUiLabBillingPreview(companyId: string): CommercialBillingPreview {
  const plan = readOverlay(companyId);
  const account = toUserBankAccount(
    companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID,
  );
  const billingAccounts = [
    {
      id: account.id,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      availableBalance: plan.forceInsufficientFunds ? 25 : account.availableBalance,
    },
  ];
  return {
    companyId,
    companyName: companyName(companyId),
    currentPlan: plan.commercialPlan,
    targetPlan: "PRO",
    monthlyFee: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
    billingAccount: billingAccounts[0] ?? null,
    billingAccounts,
    nextBillingDate: isoDaysFromNow(30),
    canPurchase: plan.commercialPlan !== "PRO",
  };
}

export function purchaseUiLabCommercialPro(input: {
  companyId: string;
  billingAccountId: string;
}): CommercialPurchaseResult {
  const plan = readOverlay(input.companyId);
  if (plan.forceInsufficientFunds || plan.commercialPlan === "PRO") {
    if (plan.forceInsufficientFunds) {
      throw new Error("BAD_REQUEST:Insufficient funds in the selected billing account.");
    }
  }
  const nextBillingAt = isoDaysFromNow(30);
  overlays.set(input.companyId, {
    ...plan,
    commercialPlan: "PRO",
    planStatus: "ACTIVE",
    billingStatus: "CURRENT",
    billingAccountId: input.billingAccountId,
    nextBillingAt,
    downgradeScheduledAt: null,
    proSubscribedAt: new Date().toISOString(),
    grantSource: "PURCHASED",
    monthlyFee: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
    forceInsufficientFunds: false,
  });
  return {
    commercialPlan: "PRO",
    billingStatus: "CURRENT",
    monthlyFee: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
    billingAccountId: input.billingAccountId,
    nextBillingAt,
    transactionId: `ui-lab-txn-${input.companyId}`,
    referenceCode: "SUB-UILAB-001",
  };
}

export function getUiLabDowngradePreview(companyId: string): CommercialDowngradePreview {
  const plan = readOverlay(companyId);
  return {
    companyId,
    companyName: companyName(companyId),
    currentPlan: "PRO",
    targetPlan: "CORE",
    grantSource: plan.grantSource,
    monthlyFee: plan.monthlyFee,
    canDowngrade: plan.commercialPlan === "PRO",
    periodEndAt: plan.nextBillingAt,
    downgradeAlreadyScheduled: Boolean(plan.downgradeScheduledAt),
    scheduledDowngradeAt: plan.downgradeScheduledAt,
    cleanup: {
      payrollRunsCancelled: 1,
      paymentLinksCancelled: 3,
      invoicesCancelled: 0,
      payrollRuns: [
        {
          id: "ui-lab-payroll-run-1",
          label: "Biweekly payroll",
          payDate: isoDaysFromNow(4),
          status: "pending_review",
          totalAmount: 48_200,
          sourceAccountName: accountMeta(
            companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID,
          ).accountName,
          sourceAccountNumber: accountMeta(
            companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID,
          ).accountNumber,
          payouts: [
            {
              displayName: "Maya Chen",
              accountNumber: "****4412",
              amount: 24_100,
            },
          ],
        },
      ],
      activePayrollEmployees: [
        {
          id: "ui-lab-emp-1",
          displayName: "Maya Chen",
          accountNumber: "****4412",
          payAmount: 24_100,
          nextPayDate: isoDaysFromNow(4),
        },
      ],
    },
    coreLimits: { ...CORE_LIMITS },
  };
}

export function downgradeUiLabCommercialPro(input: {
  companyId: string;
  mode?: "period_end" | "immediate";
}): CommercialDowngradeResult {
  const plan = readOverlay(input.companyId);
  const mode = input.mode ?? "period_end";
  const preview = getUiLabDowngradePreview(input.companyId);
  if (mode === "immediate") {
    overlays.set(input.companyId, {
      ...defaultOverlay(input.companyId),
      commercialPlan: "CORE",
      planStatus: "ACTIVE",
      billingStatus: "NOT_BILLED",
      nextBillingAt: null,
      downgradeScheduledAt: null,
      monthlyFee: null,
      grantSource: null,
      proSubscribedAt: null,
    });
    return {
      companyId: input.companyId,
      companyName: companyName(input.companyId),
      commercialPlan: "CORE",
      mode,
      effectiveAt: new Date().toISOString(),
      cleanup: preview.cleanup,
    };
  }
  const effectiveAt = plan.nextBillingAt ?? isoDaysFromNow(18);
  overlays.set(input.companyId, {
    ...plan,
    downgradeScheduledAt: effectiveAt,
  });
  return {
    companyId: input.companyId,
    companyName: companyName(input.companyId),
    commercialPlan: "PRO",
    mode,
    effectiveAt,
    cleanup: preview.cleanup,
  };
}

export function cancelUiLabScheduledDowngrade(companyId: string): { ok: true } {
  const plan = readOverlay(companyId);
  overlays.set(companyId, { ...plan, downgradeScheduledAt: null });
  return { ok: true };
}

export function updateUiLabBillingAccount(input: {
  companyId: string;
  billingAccountId: string;
}): { ok: true; billingAccountId: string } {
  const plan = readOverlay(input.companyId);
  overlays.set(input.companyId, { ...plan, billingAccountId: input.billingAccountId });
  return { ok: true, billingAccountId: input.billingAccountId };
}

export function setUiLabCommercialInsufficientFunds(companyId: string, enabled: boolean): void {
  const plan = readOverlay(companyId);
  overlays.set(companyId, { ...plan, forceInsufficientFunds: enabled });
}

export function getUiLabCommercialDashboard(companyId: string): CommercialDashboard {
  const isPro = readOverlay(companyId).commercialPlan === "PRO";
  return {
    cashBalance: accountMeta(
      companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID,
    ).balance,
    outstandingInvoices: isPro ? 84_250 : 22_400,
    paidThisMonth: isPro ? 196_880 : 41_200,
    netReceiptsThisMonth: isPro ? 188_400 : 39_100,
    paymentLinkVolume: isPro ? 72_450 : 12_800,
    altaPayVolumeThisMonth: isPro ? 18_200 : 4_500,
    altaPayPaymentCountThisMonth: isPro ? 11 : 3,
    overdueInvoiceTotal: isPro ? 9_800 : 3_200,
    recentActivity: [
      {
        id: "ui-lab-act-1",
        kind: "invoice_payment",
        label: "Invoice paid · Harbor Logistics",
        amount: 12_500,
        status: "PAID",
        referenceCode: "INV-UILAB-104",
        createdAt: "2026-07-22T14:20:00.000Z",
      },
      {
        id: "ui-lab-act-2",
        kind: "link_payment",
        label: "Payment link · Site deposit",
        amount: 4_800,
        status: "COMPLETED",
        referenceCode: "PLINK-UILAB-012",
        createdAt: "2026-07-21T09:10:00.000Z",
      },
    ],
    invoiceDashboard: {
      outstandingTotal: isPro ? 84_250 : 22_400,
      paidThisMonth: isPro ? 196_880 : 41_200,
      overdueCount: isPro ? 2 : 1,
    },
    paymentLinkDashboard: {
      activeCount: isPro ? 8 : 5,
      totalCollected: isPro ? 72_450 : 12_800,
      paymentCount: isPro ? 26 : 9,
    },
  };
}

export function getUiLabPaymentLinkDashboard(companyId: string): PaymentLinkDashboard {
  const isPro = readOverlay(companyId).commercialPlan === "PRO";
  const count = isPro ? 8 : 5;
  const recent = Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const slug = `uilab${companyId.slice(-3).toLowerCase()}${String(n).padStart(2, "0")}`;
    return {
      id: `ui-lab-plink-${companyId}-${n}`,
      slug,
      referenceCode: `PLINK-UILAB-${String(n).padStart(3, "0")}`,
      merchantCompanyId: companyId,
      merchantName: companyName(companyId),
      title: n % 2 === 0 ? `Project deposit ${n}` : null,
      description: `UI Lab payment link ${n}`,
      amountType: "FIXED" as const,
      usageType: "REUSABLE" as const,
      amount: 1_000 * n,
      minAmount: null,
      maxAmount: null,
      currency: "FLD",
      status: "ACTIVE" as const,
      expiresAt: null,
      paymentCount: n,
      totalCollected: 1_000 * n * n,
      createdAt: isoDaysFromNow(-n),
      checkoutUrl: paymentLinkCheckoutPath(slug),
    };
  });
  return {
    activeCount: count,
    totalCollected: recent.reduce((sum, row) => sum + row.totalCollected, 0),
    paymentCount: recent.reduce((sum, row) => sum + row.paymentCount, 0),
    recent,
  };
}

export function getUiLabPaymentLinkDetail(
  companyId: string,
  linkId: string,
): PaymentLinkDetail | null {
  const dashboard = getUiLabPaymentLinkDashboard(companyId);
  const row = dashboard.recent.find((link) => link.id === linkId);
  if (!row) return null;
  return {
    ...row,
    internalMemo: "UI Lab fixture — not a live receivable",
    pausedAt: null,
    cancelledAt: null,
    completedAt: null,
    recentPayments: [
      {
        id: `${linkId}-pay-1`,
        amount: row.amount ?? 1_000,
        feeAmount: 0,
        payerLabel: "Harbor Logistics",
        paymentReferenceCode: "PL-PAY-UILAB-001",
        status: "COMPLETED",
        completedAt: isoDaysFromNow(-2),
        createdAt: isoDaysFromNow(-2),
      },
    ],
    events: [
      {
        id: `${linkId}-evt-1`,
        eventType: "CREATED",
        actorUserId: UI_LAB_MOCK_USER.id,
        source: "ui-lab",
        metadata: null,
        createdAt: row.createdAt,
      },
    ],
  };
}

function fixtureInvoiceRows(companyId: string) {
  return [
    {
      id: `ui-lab-inv-${companyId}-1`,
      referenceCode: "INV-UILAB-104",
      merchantCompanyId: companyId,
      merchantName: companyName(companyId),
      recipientKind: "person" as const,
      recipientUserId: "ui-lab-person-harbor",
      recipientCompanyId: null,
      recipientName: "Harbor Line",
      amount: 12_500,
      amountPaid: 0,
      currency: "FLD",
      description: "July site services",
      memo: "UI Lab fixture invoice",
      dueDate: isoDaysFromNow(7),
      status: "SENT" as const,
      sentAt: isoDaysFromNow(-3),
      viewedAt: null,
      paidAt: null,
      cancelledAt: null,
      createdAt: isoDaysFromNow(-3),
    },
    {
      id: `ui-lab-inv-${companyId}-2`,
      referenceCode: "INV-UILAB-098",
      merchantCompanyId: companyId,
      merchantName: companyName(companyId),
      recipientKind: "company" as const,
      recipientUserId: null,
      recipientCompanyId: UI_LAB_HARBOR_COMPANY_ID,
      recipientName: "Harbor Logistics Ltd.",
      amount: 8_200,
      amountPaid: 8_200,
      currency: "FLD",
      description: "Materials retainer",
      memo: null,
      dueDate: isoDaysFromNow(-5),
      status: "PAID" as const,
      sentAt: isoDaysFromNow(-12),
      viewedAt: isoDaysFromNow(-10),
      paidAt: isoDaysFromNow(-1),
      cancelledAt: null,
      createdAt: isoDaysFromNow(-12),
    },
  ];
}

function fixtureInvoiceDetail(
  companyId: string,
  invoiceId: string,
): MerchantInvoiceDetail | null {
  const row = fixtureInvoiceRows(companyId).find((invoice) => invoice.id === invoiceId);
  if (!row) return null;
  return {
    ...row,
    paymentReferenceCode: row.status === "PAID" ? "INV-PAY-UILAB-001" : null,
    lineItems: [
      {
        id: `${invoiceId}-line-1`,
        description: row.description,
        quantity: 1,
        unitAmount: row.amount,
        lineTotal: row.amount,
        sortOrder: 0,
      },
    ],
    events: [
      {
        id: `${invoiceId}-evt-1`,
        eventType: "CREATED",
        actorUserId: UI_LAB_MOCK_USER.id,
        source: "ui-lab",
        metadata: null,
        createdAt: row.createdAt,
      },
    ],
  };
}

function toInvoiceSummary(detail: MerchantInvoiceDetail): MerchantInvoiceSummaryRow {
  const {
    lineItems: _lineItems,
    events: _events,
    paymentReferenceCode: _paymentReferenceCode,
    branding: _branding,
    ...summary
  } = detail;
  return summary;
}

function writeSessionInvoice(detail: MerchantInvoiceDetail): MerchantInvoiceDetail {
  const companyId = detail.merchantCompanyId;
  const existing = sessionInvoices.get(companyId) ?? [];
  sessionInvoices.set(companyId, [detail, ...existing.filter((row) => row.id !== detail.id)]);
  return detail;
}

function appendInvoiceEvent(
  detail: MerchantInvoiceDetail,
  eventType: string,
): MerchantInvoiceDetail {
  const createdAt = new Date().toISOString();
  return {
    ...detail,
    events: [
      ...detail.events,
      {
        id: `${detail.id}-evt-${detail.events.length + 1}`,
        eventType,
        actorUserId: UI_LAB_MOCK_USER.id,
        source: "ui-lab",
        metadata: null,
        createdAt,
      },
    ],
  };
}

function resolveRecipientName(input: {
  recipientUserId?: string | null;
  recipientCompanyId?: string | null;
}): { kind: "person" | "company"; name: string; canReceive: boolean } | null {
  const company = input.recipientCompanyId
    ? UI_LAB_PAYABLE_RECIPIENTS.find(
        (recipient) => recipient.kind === "company" && recipient.id === input.recipientCompanyId,
      )
    : undefined;
  const person = input.recipientUserId
    ? UI_LAB_PAYABLE_RECIPIENTS.find(
        (recipient) => recipient.kind === "person" && recipient.id === input.recipientUserId,
      )
    : undefined;
  const selected = company ?? person;
  if (!selected) return null;
  return {
    kind: selected.kind,
    name: selected.name,
    canReceive: selected.canReceive,
  };
}

export function getUiLabInvoiceDashboard(companyId: string): MerchantInvoiceDashboard {
  const isPro = readOverlay(companyId).commercialPlan === "PRO";
  const created = sessionInvoices.get(companyId) ?? [];
  const createdIds = new Set(created.map((invoice) => invoice.id));
  const recent = [
    ...created.map(toInvoiceSummary),
    ...fixtureInvoiceRows(companyId).filter((row) => !createdIds.has(row.id)),
  ];
  return {
    outstandingTotal: isPro ? 84_250 : 22_400,
    paidThisMonth: isPro ? 196_880 : 41_200,
    overdueCount: isPro ? 2 : 1,
    recent,
  };
}

export function listUiLabInvoices(
  companyId: string,
  status?: MerchantInvoiceDetail["status"],
): MerchantInvoiceSummaryRow[] {
  const rows = getUiLabInvoiceDashboard(companyId).recent;
  return status ? rows.filter((row) => row.status === status) : rows;
}

export function getUiLabInvoiceDetail(
  companyId: string,
  invoiceId: string,
): MerchantInvoiceDetail | null {
  const created = (sessionInvoices.get(companyId) ?? []).find((invoice) => invoice.id === invoiceId);
  if (created) return created;
  return fixtureInvoiceDetail(companyId, invoiceId);
}

function requireUiLabInvoice(companyId: string, invoiceId: string): MerchantInvoiceDetail {
  const detail = getUiLabInvoiceDetail(companyId, invoiceId);
  if (!detail || detail.merchantCompanyId !== companyId) {
    throw new Error("Invoice not found.");
  }
  return detail;
}

/** In-memory create — never writes to Prisma. Persists in-process for the UI Lab session. */
export function createUiLabInvoiceDraft(input: CreateMerchantInvoiceInput): MerchantInvoiceDetail {
  const limits = getUiLabReceivableCreationLimits(input.companyId);
  if (!limits.canCreateInvoice) {
    throw new Error(limits.invoiceLimitMessage);
  }

  const hasUser = Boolean(input.recipientUserId?.trim());
  const hasCompany = Boolean(input.recipientCompanyId?.trim());
  if (hasUser === hasCompany) {
    throw new Error("Select a person or company to invoice.");
  }

  const selected = resolveRecipientName({
    recipientUserId: input.recipientUserId,
    recipientCompanyId: input.recipientCompanyId,
  });
  if (!selected) throw new Error("Selected recipient was not found.");
  if (!selected.canReceive) throw new Error("Selected recipient cannot receive invoices.");

  const id = `ui-lab-inv-created-${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const draft: MerchantInvoiceDetail = {
    id,
    referenceCode: `INV-UILAB-${id.slice(-6).toUpperCase()}`,
    merchantCompanyId: input.companyId,
    merchantName: companyName(input.companyId),
    recipientKind: selected.kind,
    recipientUserId: input.recipientUserId ?? null,
    recipientCompanyId: input.recipientCompanyId ?? null,
    recipientName: selected.name,
    amount: input.amount,
    amountPaid: 0,
    currency: "FLD",
    description: input.description,
    memo: input.memo ?? null,
    dueDate: input.dueDate ?? null,
    status: "DRAFT",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    createdAt,
    paymentReferenceCode: null,
    lineItems: [
      {
        id: `${id}-line-1`,
        description: input.description,
        quantity: 1,
        unitAmount: input.amount,
        lineTotal: input.amount,
        sortOrder: 0,
      },
    ],
    events: [
      {
        id: `${id}-evt-1`,
        eventType: "CREATED",
        actorUserId: UI_LAB_MOCK_USER.id,
        source: "ui-lab",
        metadata: null,
        createdAt,
      },
    ],
  };

  return writeSessionInvoice(draft);
}

export function updateUiLabInvoiceDraft(
  input: UpdateMerchantInvoiceDraftInput,
): MerchantInvoiceDetail {
  const existing = requireUiLabInvoice(input.companyId, input.invoiceId);
  if (existing.status !== "DRAFT") {
    throw new Error("Only draft invoices can be edited.");
  }

  let recipientKind = existing.recipientKind;
  let recipientUserId = existing.recipientUserId;
  let recipientCompanyId = existing.recipientCompanyId;
  let recipientName = existing.recipientName;

  if (input.recipientUserId !== undefined || input.recipientCompanyId !== undefined) {
    const hasUser = Boolean(input.recipientUserId?.trim());
    const hasCompany = Boolean(input.recipientCompanyId?.trim());
    if (hasUser === hasCompany) {
      throw new Error("Select a person or company to invoice.");
    }
    const selected = resolveRecipientName({
      recipientUserId: input.recipientUserId,
      recipientCompanyId: input.recipientCompanyId,
    });
    if (!selected) throw new Error("Selected recipient was not found.");
    if (!selected.canReceive) throw new Error("Selected recipient cannot receive invoices.");
    recipientKind = selected.kind;
    recipientUserId = input.recipientUserId?.trim() || null;
    recipientCompanyId = input.recipientCompanyId?.trim() || null;
    recipientName = selected.name;
  }

  const amount = input.amount ?? existing.amount;
  const description = input.description?.trim() ?? existing.description;
  const next: MerchantInvoiceDetail = {
    ...existing,
    recipientKind,
    recipientUserId,
    recipientCompanyId,
    recipientName,
    amount,
    description,
    memo: input.memo === undefined ? existing.memo : input.memo?.trim() || null,
    dueDate: input.dueDate === undefined ? existing.dueDate : input.dueDate,
    lineItems: [
      {
        id: `${existing.id}-line-1`,
        description,
        quantity: 1,
        unitAmount: amount,
        lineTotal: amount,
        sortOrder: 0,
      },
    ],
  };

  return writeSessionInvoice(appendInvoiceEvent(next, "UPDATED"));
}

export function sendUiLabInvoice(companyId: string, invoiceId: string): MerchantInvoiceDetail {
  const existing = requireUiLabInvoice(companyId, invoiceId);
  if (existing.status !== "DRAFT") {
    throw new Error("Only draft invoices can be sent.");
  }
  const sentAt = new Date().toISOString();
  return writeSessionInvoice(
    appendInvoiceEvent(
      {
        ...existing,
        status: "SENT",
        sentAt,
      },
      "SENT",
    ),
  );
}

export function cancelUiLabInvoice(companyId: string, invoiceId: string): MerchantInvoiceDetail {
  const existing = requireUiLabInvoice(companyId, invoiceId);
  if (
    !UNPAID_INVOICE_STATUSES.includes(existing.status) &&
    existing.status !== "DRAFT"
  ) {
    throw new Error("This invoice cannot be cancelled.");
  }
  const cancelledAt = new Date().toISOString();
  return writeSessionInvoice(
    appendInvoiceEvent(
      {
        ...existing,
        status: "CANCELLED",
        cancelledAt,
      },
      "CANCELLED",
    ),
  );
}

export function remindUiLabInvoice(companyId: string, invoiceId: string): MerchantInvoiceDetail {
  const existing = requireUiLabInvoice(companyId, invoiceId);
  if (!UNPAID_INVOICE_STATUSES.includes(existing.status)) {
    throw new Error("Reminders can only be sent for unpaid invoices.");
  }
  return writeSessionInvoice(appendInvoiceEvent(existing, "REMINDER_SENT"));
}

function fixtureStatementsForAccount(accountId: string): BankStatementDetail[] {
  if (!isUiLabCommercialAccount(accountId)) return [];
  const meta = accountMeta(accountId);
  const routingNumber = getRoutingNumber();
  const isPro = accountId === UI_LAB_PRO_ACCOUNT_ID;
  const baseClosing = meta.balance;
  const opening = baseClosing - (isPro ? 86_340 : 42_100);

  const makeTxn = (
    suffix: string,
    type: "deposit" | "withdrawal",
    amount: number,
    description: string,
    daysAgo: number,
  ) => ({
    id: `${accountId}-stmt-txn-${suffix}`,
    referenceCode: `TXN-UILAB-S${suffix}`,
    bankAccountId: accountId,
    accountName: meta.accountName,
    accountNumber: meta.accountNumber,
    type,
    typeLabel: type === "deposit" ? "Deposit" : "Withdrawal",
    amount,
    status: "approved" as const,
    statusLabel: "Approved",
    description,
    memo: null as string | null,
    proofImageUrl: null as string | null,
    proofFileName: null as string | null,
    proofUploadedAt: null as string | null,
    hasProof: false,
    createdAt: isoDaysFromNow(-daysAgo),
    reviewedAt: isoDaysFromNow(-daysAgo),
    reviewNote: null as string | null,
  });

  const juneTxns = [
    makeTxn("1", "deposit", isPro ? 42_100 : 18_400, "Payment link · Harbor Logistics", 40),
    makeTxn("2", "withdrawal", isPro ? 12_500 : 6_200, "Payroll batch · June", 35),
    makeTxn("3", "deposit", isPro ? 24_300 : 9_800, "Invoice INV-UILAB-098", 28),
  ];
  const mayTxns = [
    makeTxn("4", "deposit", isPro ? 31_000 : 12_000, "Customer payment · Alta Pay", 60),
    makeTxn("5", "withdrawal", isPro ? 8_400 : 4_100, "Operating expense", 55),
  ];

  const juneDeposits = juneTxns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const juneWithdrawals = juneTxns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const mayDeposits = mayTxns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const mayWithdrawals = mayTxns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);

  const juneOpening = opening;
  const juneClosing = juneOpening + juneDeposits - juneWithdrawals;
  const mayClosing = juneOpening;
  const mayOpening = mayClosing - mayDeposits + mayWithdrawals;

  const june: BankStatementDetail = {
    id: `ui-lab-stmt-${accountId}-2026-06`,
    statementNumber: `STMT-UILAB-${isPro ? "NPC" : "ALTG"}-202606`,
    bankAccountId: accountId,
    accountName: meta.accountName,
    accountNumber: meta.accountNumber,
    ownerLabel: meta.companyName,
    isCompanyAccount: true,
    companyName: meta.companyName,
    companyId: meta.companyId,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    openingBalance: juneOpening,
    closingBalance: juneClosing,
    totalDeposits: juneDeposits,
    totalWithdrawals: juneWithdrawals,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    transactionCount: juneTxns.length,
    status: "generated",
    statusLabel: "Generated",
    generatedAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-07-01T12:00:00.000Z",
    routingNumber,
    currency: "FLD",
    netChange: juneClosing - juneOpening,
    transactions: juneTxns,
    openingBalanceEstimated: false,
  };

  const may: BankStatementDetail = {
    id: `ui-lab-stmt-${accountId}-2026-05`,
    statementNumber: `STMT-UILAB-${isPro ? "NPC" : "ALTG"}-202605`,
    bankAccountId: accountId,
    accountName: meta.accountName,
    accountNumber: meta.accountNumber,
    ownerLabel: meta.companyName,
    isCompanyAccount: true,
    companyName: meta.companyName,
    companyId: meta.companyId,
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    openingBalance: mayOpening,
    closingBalance: mayClosing,
    totalDeposits: mayDeposits,
    totalWithdrawals: mayWithdrawals,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    transactionCount: mayTxns.length,
    status: "generated",
    statusLabel: "Generated",
    generatedAt: "2026-06-01T12:00:00.000Z",
    createdAt: "2026-06-01T12:00:00.000Z",
    routingNumber,
    currency: "FLD",
    netChange: mayClosing - mayOpening,
    transactions: mayTxns,
    openingBalanceEstimated: false,
  };

  return [june, may];
}

function toStatementSummary(detail: BankStatementDetail): BankStatementSummary {
  const {
    routingNumber: _routingNumber,
    currency: _currency,
    netChange: _netChange,
    transactions: _transactions,
    openingBalanceEstimated: _openingBalanceEstimated,
    ...summary
  } = detail;
  return summary;
}

/** Deterministic, JSON-serializable statement history for UI Lab commercial accounts. */
export function getUiLabAccountStatements(accountId: string): BankStatementSummary[] {
  if (!isUiLabCommercialAccount(accountId)) return [];
  const session = sessionStatements.get(accountId) ?? [];
  const sessionIds = new Set(session.map((row) => row.id));
  return [
    ...session.map(toStatementSummary),
    ...fixtureStatementsForAccount(accountId)
      .filter((row) => !sessionIds.has(row.id))
      .map(toStatementSummary),
  ];
}

export function getUiLabStatementDetail(statementId: string): BankStatementDetail | null {
  for (const rows of sessionStatements.values()) {
    const hit = rows.find((row) => row.id === statementId);
    if (hit) return hit;
  }
  for (const accountId of [UI_LAB_CORE_ACCOUNT_ID, UI_LAB_PRO_ACCOUNT_ID]) {
    const hit = fixtureStatementsForAccount(accountId).find((row) => row.id === statementId);
    if (hit) return hit;
  }
  return null;
}

/** In-memory statement generate for UI Lab — never writes to Prisma. */
export function generateUiLabAccountStatement(input: {
  accountId: string;
  periodStart: string;
  periodEnd: string;
}): BankStatementDetail {
  if (!isUiLabCommercialAccount(input.accountId)) {
    throw new Error("Statement account not found.");
  }
  const meta = accountMeta(input.accountId);
  const existing = getUiLabAccountStatements(input.accountId);
  const id = `ui-lab-stmt-created-${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const detail: BankStatementDetail = {
    id,
    statementNumber: `STMT-UILAB-${id.slice(-6).toUpperCase()}`,
    bankAccountId: input.accountId,
    accountName: meta.accountName,
    accountNumber: meta.accountNumber,
    ownerLabel: meta.companyName,
    isCompanyAccount: true,
    companyName: meta.companyName,
    companyId: meta.companyId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    openingBalance: existing[0]?.closingBalance ?? meta.balance,
    closingBalance: meta.balance,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    transactionCount: 0,
    status: "generated",
    statusLabel: "Generated",
    generatedAt: createdAt,
    createdAt,
    routingNumber: getRoutingNumber(),
    currency: "FLD",
    netChange: 0,
    transactions: [],
    openingBalanceEstimated: true,
  };
  const rows = sessionStatements.get(input.accountId) ?? [];
  sessionStatements.set(input.accountId, [detail, ...rows]);
  return detail;
}

export function getUiLabStatementCenterStatements(): BankStatementSummary[] {
  return [
    ...getUiLabAccountStatements(UI_LAB_CORE_ACCOUNT_ID),
    ...getUiLabAccountStatements(UI_LAB_PRO_ACCOUNT_ID),
  ];
}

export function getUiLabStatementGeneratableAccounts(): StatementGeneratableAccount[] {
  return [UI_LAB_CORE_ACCOUNT_ID, UI_LAB_PRO_ACCOUNT_ID].map((accountId) => {
    const meta = accountMeta(accountId);
    return {
      id: accountId,
      accountName: meta.accountName,
      accountNumber: meta.accountNumber,
      isCompanyAccount: true,
      companyName: meta.companyName,
    };
  });
}

export function generateUiLabAccountStatementsBatch(
  input: GenerateStatementsBatchInput,
): GenerateStatementsBatchResult {
  const generatable = getUiLabStatementGeneratableAccounts();
  const generatableIds = new Set(generatable.map((account) => account.id));

  let targetIds: string[];
  if (input.allAccounts) {
    targetIds = generatable.map((account) => account.id);
  } else if (input.accountIds?.length) {
    const invalid = input.accountIds.filter((id) => !generatableIds.has(id));
    if (invalid.length > 0) throw new Error("FORBIDDEN");
    targetIds = input.accountIds;
  } else {
    throw new Error("Select at least one account or choose all accounts.");
  }

  if (targetIds.length === 0) {
    throw new Error("No eligible accounts available for statement generation.");
  }

  let created = 0;
  let skipped = 0;
  const errors: GenerateStatementsBatchResult["errors"] = [];
  const statements: GenerateStatementsBatchResult["statements"] = [];

  for (const accountId of targetIds) {
    const account = generatable.find((row) => row.id === accountId);
    const label = account?.accountNumber ?? accountId;
    try {
      const existing = getUiLabAccountStatements(accountId).some(
        (row) => row.periodStart === input.periodStart && row.periodEnd === input.periodEnd,
      );
      if (existing) {
        skipped += 1;
        continue;
      }
      const detail = generateUiLabAccountStatement({
        accountId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
      created += 1;
      statements.push({ id: detail.id, accountId });
    } catch (error) {
      errors.push({
        accountId,
        label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { created, skipped, errors, statements };
}

export function getUiLabRepresentatives(companyId: string): BusinessRepresentativeRow[] {
  return [
    {
      membershipId: `ui-lab-mem-${companyId}-owner`,
      userId: UI_LAB_MOCK_USER.id,
      discordUsername: UI_LAB_MOCK_USER.discordUsername,
      role: "owner",
      roleLabel: COMPANY_ROLE_LABELS.owner,
      joinedAt: "2025-01-01T00:00:00.000Z",
    },
    {
      membershipId: `ui-lab-mem-${companyId}-finance`,
      userId: "ui-lab-finance",
      discordUsername: "maya.finance",
      role: "finance_manager",
      roleLabel: COMPANY_ROLE_LABELS.finance_manager,
      joinedAt: "2025-03-12T00:00:00.000Z",
    },
    {
      membershipId: `ui-lab-mem-${companyId}-exec`,
      userId: "ui-lab-exec",
      discordUsername: "noah.exec",
      role: "executive",
      roleLabel: COMPANY_ROLE_LABELS.executive,
      joinedAt: "2025-04-02T00:00:00.000Z",
    },
  ];
}

export function getUiLabScheduledPayments(companyId: string): ScheduledPaymentRow[] {
  return [
    {
      id: `ui-lab-sched-${companyId}-1`,
      transferScope: "intrabank",
      transferScopeLabel: "Alta Bank",
      paymentType: "recurring",
      paymentTypeLabel: "Recurring",
      label: "Vendor retainer",
      recipientName: "North Pier Supply",
      recipientAccountNumber: "AB-2000-118877",
      recipientInstitution: null,
      routingNumber: null,
      wireAccountNumber: null,
      amount: 6_500,
      currency: "FLD",
      frequency: "monthly",
      frequencyLabel: "Monthly",
      scheduledDate: null,
      nextRunDate: isoDaysFromNow(5),
      lastRunAt: isoDaysFromNow(-25),
      lastExecutionStatus: "executed",
      lastExecutionStatusLabel: "Executed",
      lastFailureReason: null,
      consecutiveFailures: 0,
      status: "approved",
      statusLabel: "Approved",
      memo: "Monthly materials retainer",
      bankAccountId:
        companyId === UI_LAB_PRO_COMPANY_ID ? UI_LAB_PRO_ACCOUNT_ID : UI_LAB_CORE_ACCOUNT_ID,
      createdAt: isoDaysFromNow(-60),
    },
  ];
}

export function getUiLabPayrollEmployees(companyId: string): PayrollEmployeeRow[] {
  if (readOverlay(companyId).commercialPlan !== "PRO") return [];
  return [
    {
      id: "ui-lab-emp-1",
      displayName: "Maya Chen",
      title: "Controller",
      accountNumber: "AB-2000-4412",
      payAmount: 24_100,
      payFrequency: "biweekly",
      payFrequencyLabel: "Biweekly",
      payDay: "friday",
      payDayLabel: "Friday",
      nextPayDate: isoDaysFromNow(4),
      status: "active",
      statusLabel: "Active",
      createdAt: isoDaysFromNow(-90),
    },
  ];
}

export function getUiLabPayrollRuns(companyId: string): PayrollRunRow[] {
  if (readOverlay(companyId).commercialPlan !== "PRO") return [];
  return [
    {
      id: "ui-lab-payroll-run-1",
      label: "Biweekly payroll",
      totalAmount: 48_200,
      status: "pending_review",
      statusLabel: "Pending review",
      payDate: isoDaysFromNow(4),
      lineItems: [
        {
          employeeId: "ui-lab-emp-1",
          displayName: "Maya Chen",
          amount: 24_100,
          accountNumber: "AB-2000-4412",
        },
      ],
      memo: null,
      lastFailureReason: null,
      createdAt: isoDaysFromNow(-1),
    },
  ];
}

export function getUiLabMerchantAnalytics(_companyId: string): MerchantAnalytics {
  return {
    range: "30D",
    grossVolume: 196_880,
    netVolume: 188_400,
    totalFees: 8_480,
    invoiceRevenue: 124_430,
    paymentLinkRevenue: 72_450,
    altaPayRevenue: 18_200,
    outstandingInvoiceTotal: 84_250,
    overdueInvoiceTotal: 9_800,
    paidInvoicesCount: 18,
    averagePaymentSize: 3_076,
    paymentSuccessRate: 97,
    paymentFailureRate: 3,
    successfulPayments: 64,
    failedPayments: 2,
    topCustomers: [
      {
        customerLabel: "Harbor Logistics",
        paymentCount: 8,
        grossVolume: 42_100,
      },
    ],
    recentPayments: [
      {
        id: "ui-lab-pay-1",
        source: "invoice",
        customerLabel: "Harbor Logistics",
        grossAmount: 12_500,
        netAmount: 12_500,
        feeAmount: 0,
        referenceCode: "INV-PAY-UILAB-001",
        createdAt: isoDaysFromNow(-2),
      },
    ],
    monthlyTrend: [
      {
        month: "2026-05",
        grossVolume: 140_000,
        netVolume: 134_000,
        invoiceRevenue: 90_000,
        paymentLinkRevenue: 40_000,
        altaPayRevenue: 10_000,
      },
      {
        month: "2026-06",
        grossVolume: 170_000,
        netVolume: 162_000,
        invoiceRevenue: 110_000,
        paymentLinkRevenue: 48_000,
        altaPayRevenue: 12_000,
      },
      {
        month: "2026-07",
        grossVolume: 196_880,
        netVolume: 188_400,
        invoiceRevenue: 124_430,
        paymentLinkRevenue: 72_450,
        altaPayRevenue: 18_200,
      },
    ],
  };
}

export function getUiLabSubscriptionChargeHistory(companyId: string) {
  const plan = readOverlay(companyId);
  if (plan.commercialPlan !== "PRO") return [];

  const accountId =
    plan.billingAccountId === UI_LAB_PRO_ACCOUNT_ID || companyId === UI_LAB_PRO_COMPANY_ID
      ? UI_LAB_PRO_ACCOUNT_ID
      : UI_LAB_CORE_ACCOUNT_ID;
  const billingAccount = accountMeta(accountId);

  return [
    {
      id: `ui-lab-charge-${companyId}-2`,
      chargeType: "MONTHLY_RENEWAL" as const,
      chargeTypeLabel: "Monthly renewal",
      billingPeriod: "2026-07-14",
      billingPeriodLabel: "Jul 14 – Aug 14, 2026",
      amount: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
      status: "SUCCEEDED" as const,
      statusLabel: "Paid",
      createdAt: isoDaysFromNow(-12),
      referenceCode: "SUB-UILAB-014",
      billingAccountId: accountId,
      billingAccountName: billingAccount.accountName,
      billingAccountNumber: billingAccount.accountNumber,
      failureReason: null as string | null,
    },
    {
      id: `ui-lab-charge-${companyId}-3`,
      chargeType: "MONTHLY_RENEWAL" as const,
      chargeTypeLabel: "Monthly renewal",
      billingPeriod: "2026-07-14",
      billingPeriodLabel: "Jul 14 – Aug 14, 2026",
      amount: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
      status: "FAILED" as const,
      statusLabel: "Failed",
      createdAt: isoDaysFromNow(-14),
      referenceCode: "SUB-UILAB-013",
      billingAccountId: accountId,
      billingAccountName: billingAccount.accountName,
      billingAccountNumber: billingAccount.accountNumber,
      failureReason: "Insufficient funds in the billing account.",
    },
    {
      id: `ui-lab-charge-${companyId}-1`,
      chargeType: "INITIAL_PURCHASE" as const,
      chargeTypeLabel: "Initial purchase",
      billingPeriod: "initial",
      billingPeriodLabel: "Initial purchase",
      amount: DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
      status: "SUCCEEDED" as const,
      statusLabel: "Paid",
      createdAt: plan.proSubscribedAt ?? isoDaysFromNow(-42),
      referenceCode: "SUB-UILAB-001",
      billingAccountId: accountId,
      billingAccountName: billingAccount.accountName,
      billingAccountNumber: billingAccount.accountNumber,
      failureReason: null as string | null,
    },
  ];
}

/** In-memory create — never writes to Prisma. */
export function createUiLabPaymentLink(input: {
  companyId: string;
  title?: string;
  description: string;
  internalMemo?: string;
  amountType: "FIXED" | "OPEN";
  usageType: "ONE_TIME" | "REUSABLE";
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
  expiresAt?: string | null;
}): PaymentLinkDetail {
  const limits = getUiLabReceivableCreationLimits(input.companyId);
  if (!limits.canCreatePaymentLink) {
    throw new Error(limits.paymentLinkLimitMessage);
  }
  const slug = `uilab${Math.random().toString(36).slice(2, 10)}`;
  const id = `ui-lab-plink-created-${slug}`;
  return {
    id,
    slug,
    referenceCode: `PLINK-UILAB-${slug.slice(0, 6).toUpperCase()}`,
    merchantCompanyId: input.companyId,
    merchantName: companyName(input.companyId),
    title: input.title?.trim() || null,
    description: input.description,
    amountType: input.amountType,
    usageType: input.usageType,
    amount: input.amountType === "FIXED" ? (input.amount ?? null) : null,
    minAmount: input.amountType === "OPEN" ? (input.minAmount ?? null) : null,
    maxAmount: input.amountType === "OPEN" ? (input.maxAmount ?? null) : null,
    currency: "FLD",
    status: "ACTIVE",
    expiresAt: input.expiresAt ?? null,
    paymentCount: 0,
    totalCollected: 0,
    createdAt: new Date().toISOString(),
    checkoutUrl: paymentLinkCheckoutPath(slug),
    internalMemo: input.internalMemo?.trim() || null,
    pausedAt: null,
    cancelledAt: null,
    completedAt: null,
    recentPayments: [],
    events: [
      {
        id: `${id}-evt-1`,
        eventType: "CREATED",
        actorUserId: UI_LAB_MOCK_USER.id,
        source: "ui-lab",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
