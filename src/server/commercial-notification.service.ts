import { formatFlorin } from "@/lib/bank/format";
import { toCustomerSafePaymentFailureReason } from "@/lib/bank/customer-payment-failure-reason";
import { sanitizeCustomerFacingReason } from "@/lib/bank/customer-operator-notification-copy";
import { prisma } from "@/server/db";
import { createUserNotification, createUserNotifications } from "@/server/notification.service";

const COMPANY_NOTIFY_ROLES = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] as const;
const MERCHANT_FINANCE_ROLES = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] as const;

async function listCompanyNotifyUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.companyMembership.findMany({
    where: { companyId, role: { in: [...COMPANY_NOTIFY_ROLES] } },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function notifyCompanyVerificationRejected(input: {
  companyId: string;
  companyName: string;
  reason?: string | null;
}): Promise<void> {
  const userIds = await listCompanyNotifyUserIds(input.companyId);
  if (userIds.length === 0) return;

  const reason = sanitizeCustomerFacingReason(input.reason);
  const reasonLine = reason ? ` Reason: ${reason}` : "";

  await createUserNotifications(userIds, {
    type: "COMPANY_VERIFICATION_REJECTED",
    title: "Company verification declined",
    body: `Verification for ${input.companyName} was not approved.${reasonLine}`,
    linkUrl: "/bank/business",
    metadata: { companyId: input.companyId, companyName: input.companyName },
  });
}

export async function notifyCompanyVerificationRevoked(input: {
  companyId: string;
  companyName: string;
  reason?: string | null;
}): Promise<void> {
  const userIds = await listCompanyNotifyUserIds(input.companyId);
  if (userIds.length === 0) return;

  const reason = sanitizeCustomerFacingReason(input.reason);
  const reasonLine = reason ? ` Reason: ${reason}` : "";

  await createUserNotifications(userIds, {
    type: "COMPANY_VERIFICATION_REVOKED",
    title: "Company verification revoked",
    body: `Verified status for ${input.companyName} was revoked.${reasonLine}`,
    linkUrl: "/bank/business",
    metadata: { companyId: input.companyId, companyName: input.companyName },
  });
}

export async function notifyCommercialProRenewalReminderBestEffort(input: {
  companyId: string;
  amount: number;
  billingAccountLabel: string;
  renewalDate: string;
  billingAccountId: string;
}): Promise<void> {
  try {
    const { listCommercialBillingNotifyUserIds } = await import("@/server/commercial-audit.service");
    const userIds = await listCommercialBillingNotifyUserIds(input.companyId);
    if (userIds.length === 0) return;

    const dateLabel = new Date(input.renewalDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    await createUserNotifications(userIds, {
      type: "COMMERCIAL_PRO_RENEWAL_REMINDER",
      title: "Commercial Pro renews soon",
      body: `Alta Commercial Pro renews in 3 days. We'll charge ${formatFlorin(input.amount)} from ${input.billingAccountLabel} on ${dateLabel}.`,
      linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
      metadata: input,
    });
  } catch (error) {
    console.error("[commercial-notification] renewal reminder failed", error);
  }
}

export async function notifyCommercialBillingLowBalanceWarningBestEffort(input: {
  companyId: string;
  billingAccountId: string;
  billingAccountLabel: string;
  requiredAmount: number;
  availableBalance: number;
  context: string;
}): Promise<void> {
  try {
    const { listCommercialBillingNotifyUserIds } = await import("@/server/commercial-audit.service");
    const userIds = await listCommercialBillingNotifyUserIds(input.companyId);
    if (userIds.length === 0) return;

    await createUserNotifications(userIds, {
      type: "COMMERCIAL_BILLING_LOW_BALANCE_WARNING",
      title: "Billing account balance low",
      body: `${input.billingAccountLabel} may not have enough funds for upcoming ${input.context} (${formatFlorin(input.requiredAmount)} needed, ${formatFlorin(input.availableBalance)} available).`,
      linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
      metadata: input,
    });
  } catch (error) {
    console.error("[commercial-notification] low balance warning failed", error);
  }
}

export async function notifyMerchantRecurringInvoiceFailedBestEffort(input: {
  companyId: string;
  scheduleId: string;
  templateName: string;
  recipientLabel: string | null;
  reason: string;
}): Promise<void> {
  try {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId: input.companyId, role: { in: [...MERCHANT_FINANCE_ROLES] } },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((row) => row.userId))];
    if (userIds.length === 0) return;

    const safeReason = toCustomerSafePaymentFailureReason(input.reason);
    const recipient = input.recipientLabel ? ` to ${input.recipientLabel}` : "";

    await createUserNotifications(userIds, {
      type: "MERCHANT_RECURRING_INVOICE_FAILED",
      title: "Recurring invoice failed",
      body: `Recurring invoice "${input.templateName}"${recipient} could not be generated. ${safeReason}`,
      linkUrl: `/bank/commercial/recurring-invoices?companyId=${input.companyId}`,
      metadata: { scheduleId: input.scheduleId, templateName: input.templateName },
    });
  } catch (error) {
    console.error("[commercial-notification] recurring invoice failed", error);
  }
}

export async function notifyMerchantFirstPaymentReceivedBestEffort(input: {
  companyId: string;
  merchantName: string;
  amount: number;
  source: "invoice" | "payment_link";
}): Promise<void> {
  try {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId: input.companyId, role: { in: [...MERCHANT_FINANCE_ROLES] } },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((row) => row.userId))];
    if (userIds.length === 0) return;

    const [invoicePayments, linkPayments] = await Promise.all([
      prisma.merchantInvoicePayment.count({
        where: { status: "COMPLETED", invoice: { merchantCompanyId: input.companyId } },
      }),
      prisma.paymentLinkPayment.count({
        where: { status: "COMPLETED", paymentLink: { merchantCompanyId: input.companyId } },
      }),
    ]);

    if (invoicePayments + linkPayments !== 1) return;

    await createUserNotifications(userIds, {
      type: "MERCHANT_FIRST_PAYMENT_RECEIVED",
      title: "First commercial payment received",
      body: `Your first Alta Commercial payment was received. ${input.merchantName} received ${formatFlorin(input.amount)}.`,
      linkUrl: `/bank/commercial?companyId=${input.companyId}`,
      metadata: { source: input.source, amount: input.amount },
    });
  } catch (error) {
    console.error("[commercial-notification] first payment failed", error);
  }
}

export async function notifyPayerPaymentFailedBestEffort(input: {
  payerUserId: string;
  merchantName: string;
  amount: number;
  referenceCode: string;
  reason: string;
  tryAgainUrl: string;
  source: "invoice" | "payment_link";
}): Promise<void> {
  try {
    const safeReason = toCustomerSafePaymentFailureReason(input.reason);
    await createUserNotification({
      userId: input.payerUserId,
      type: "CUSTOMER_PAYMENT_FAILED",
      title: "Payment could not be completed",
      body: `We couldn't pay ${formatFlorin(input.amount)} to ${input.merchantName}. Ref \`${input.referenceCode}\`. ${safeReason}`,
      linkUrl: input.tryAgainUrl,
      linkLabel: "Try again",
      metadata: { source: input.source, referenceCode: input.referenceCode },
    });
  } catch (error) {
    console.error("[commercial-notification] payer payment failed", error);
  }
}

export async function notifyLargeMoneyMovementBestEffort(input: {
  userIds: string[];
  amount: number;
  description: string;
  referenceCode: string;
  linkUrl: string;
}): Promise<void> {
  const unique = [...new Set(input.userIds.filter(Boolean))];
  if (unique.length === 0) return;

  try {
    await createUserNotifications(unique, {
      type: "LARGE_MONEY_MOVEMENT_ALERT",
      title: "Large money movement",
      body: `${input.description} ${formatFlorin(input.amount)}. Ref \`${input.referenceCode}\`.`,
      linkUrl: input.linkUrl,
      metadata: { amount: input.amount, referenceCode: input.referenceCode },
    });
  } catch (error) {
    console.error("[commercial-notification] large movement alert failed", error);
  }
}

export async function maybeNotifyLargeMoneyMovementBestEffort(input: {
  userIds: string[];
  amount: number;
  description: string;
  referenceCode: string;
  linkUrl: string;
}): Promise<void> {
  try {
    const { getBankingNotificationPlatformSettings } = await import(
      "@/server/banking-notification-settings.service"
    );
    const settings = await getBankingNotificationPlatformSettings();
    if (settings.largeMoneyMovementDmThreshold <= 0) return;
    if (input.amount < settings.largeMoneyMovementDmThreshold) return;
    await notifyLargeMoneyMovementBestEffort(input);
  } catch (error) {
    console.error("[commercial-notification] large movement threshold check failed", error);
  }
}
