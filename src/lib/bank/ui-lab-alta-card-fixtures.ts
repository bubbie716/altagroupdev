/** UI Lab-only public Alta Card fixtures. These never read or write Prisma. */
import type { AltaCardDetail, AltaCardRow, AltaCardTransactionRow } from "@/lib/bank/alta-card-types";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";

export const UI_LAB_PERSONAL_CARD_ID = "AC-LAB-GOLD";

const transaction: AltaCardTransactionRow = {
  id: "ACT-LAB-1",
  altaCardId: UI_LAB_PERSONAL_CARD_ID,
  altaEmployeeCardId: null,
  type: "purchase",
  status: "completed",
  amount: 128.4,
  description: "District Market",
  merchantCompanyId: null,
  merchantCompanyName: null,
  relatedBankAccountId: null,
  relatedBankTransactionId: null,
  relatedAltaPayPaymentId: null,
  referenceCode: "AC-TX-LAB-1",
  createdByUserId: "ui-lab-user",
  createdByUsername: "carter",
  spenderUserId: "ui-lab-user",
  spenderUsername: "carter",
  employeeCardLastFour: null,
  createdAt: "2026-07-29T15:00:00.000Z",
  settledAt: "2026-07-29T15:00:00.000Z",
  reversedAt: null,
  reversesTransactionId: null,
  metadata: null,
};

export function getUiLabPersonalAltaCard(): AltaCardRow {
  return {
    id: UI_LAB_PERSONAL_CARD_ID,
    ownerUserId: "ui-lab-user",
    ownerUsername: "carter",
    companyId: null,
    companyName: null,
    applicationId: null,
    tier: "gold",
    cardType: "personal",
    status: "active",
    creditLimit: 25_000,
    availableCredit: 18_742.35,
    currentBalance: 6_257.65,
    statementBalance: 2_140.25,
    minimumPaymentDue: 214.03,
    interestRate: 12.5,
    dueDate: "2026-08-15T00:00:00.000Z",
    currentBillingCycleStart: "2026-07-01T00:00:00.000Z",
    currentBillingCycleEnd: "2026-07-31T00:00:00.000Z",
    currentStatementId: null,
    lastStatementDate: "2026-07-31T00:00:00.000Z",
    nextStatementDate: "2026-08-31T00:00:00.000Z",
    paymentDueDate: "2026-08-15T00:00:00.000Z",
    cardLastFour: "8842",
    openedAt: "2026-06-01T00:00:00.000Z",
    closedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-07-29T15:00:00.000Z",
  };
}

export function getUiLabPersonalAltaCardDetail(): AltaCardDetail {
  return { ...getUiLabPersonalAltaCard(), employeeCards: [], recentTransactions: [transaction] };
}

export function getUiLabAltaCardBillingSummary() {
  const card = getUiLabPersonalAltaCard();
  return {
    currentBalance: card.currentBalance,
    statementBalance: card.statementBalance,
    minimumPayment: card.minimumPaymentDue,
    paymentDueDate: card.paymentDueDate,
    billingPeriodStart: card.currentBillingCycleStart,
    billingPeriodEnd: card.currentBillingCycleEnd,
    nextStatementDate: card.nextStatementDate,
    interestRate: card.interestRate,
    activeFeesTotal: 0,
    hasOverdueStatement: false,
  };
}

export function getUiLabAltaCardApplyContext() {
  return {
    personalCard: getUiLabPersonalAltaCard(),
    pendingPersonalApplication: null,
    businessCompanies: [
      {
        id: UI_LAB_CORE_COMPANY_ID,
        name: "Alta Group N.V.",
        hasCard: false,
        hasPendingApplication: false,
      },
    ],
    paymentSourceAccounts: [
      { id: "BA-LAB-CHK", accountName: "Carter — Everyday Checking", accountNumber: "AB-2000-100002" },
    ],
    defaultLimits: { white: 5_000, navy: 15_000, black: 50_000, gold: null },
    defaultRates: { white: 24.99, navy: 19.99, black: 15.99, gold: null },
  };
}

export function getUiLabAltaCardAutopayContext() {
  return {
    settings: {
      enabled: false,
      sourceAccountId: null,
      sourceAccountLabel: null,
      type: null,
      fixedAmount: null,
      lastRunAt: null,
      lastStatus: "not_run" as const,
      failureReason: null,
      canManage: true,
    },
    sourceAccounts: [
      { id: "BA-LAB-CHK", accountName: "Carter — Everyday Checking", accountNumber: "AB-2000-100002", availableBalance: 38_214.2 },
    ],
  };
}

export function getUiLabAltaCardReviewEligibility() {
  return {
    canRequestReview: true,
    hasActiveReview: false,
    activeReviewId: null,
    inCooldown: false,
    cooldownEndsAt: null,
    cooldownRemainingLabel: null,
    blockMessage: null,
  };
}

export function getUiLabBusinessAltaCardHub() {
  return { companies: [], employeeCards: [] };
}
