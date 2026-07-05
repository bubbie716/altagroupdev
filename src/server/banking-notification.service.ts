import { formatFlorin } from "@/lib/bank/format";
import { createUserNotification, createUserNotifications } from "@/server/notification.service";
import { prisma } from "@/server/db";

const COMPANY_INCOMING_PAYMENT_ROLES = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] as const;

async function listCompanyIncomingPaymentNotifyUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.companyMembership.findMany({
    where: {
      companyId,
      role: { in: [...COMPANY_INCOMING_PAYMENT_ROLES] },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function notifyDepositSubmitted(
  userId: string,
  amount: number,
  referenceCode: string,
  accountName: string,
  proofImageUrl?: string | null,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_SUBMITTED",
    title: "Deposit submitted",
    body: `Your deposit of ${formatFlorin(amount)} to ${accountName} (${referenceCode}) is pending Alta review.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, accountName },
    embedImageUrl: proofImageUrl,
  });
}

export async function notifyDepositApproved(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "DEPOSIT_APPROVED",
    title: "Deposit approved",
    body: `Your deposit of ${formatFlorin(amount)} (${referenceCode}) has been approved and credited to your account.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyWithdrawalSubmitted(
  userId: string,
  amount: number,
  referenceCode: string,
  accountName: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_SUBMITTED",
    title: "Withdrawal submitted",
    body: `Your withdrawal of ${formatFlorin(amount)} from ${accountName} (${referenceCode}) is pending Alta processing.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, accountName },
  });
}

export async function notifyWithdrawalApproved(
  userId: string,
  amount: number,
  referenceCode: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "WITHDRAWAL_APPROVED",
    title: "Withdrawal approved",
    body: `Your withdrawal of ${formatFlorin(amount)} (${referenceCode}) has been approved.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount },
  });
}

export async function notifyTransferCompleted(
  userId: string,
  amount: number,
  referenceCode: string,
  fromAccountName: string,
  toAccountName: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "TRANSFER_COMPLETED",
    title: "Transfer complete",
    body: `Moved ${formatFlorin(amount)} from ${fromAccountName} to ${toAccountName}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank/transfers/intrabank",
    metadata: { referenceCode, amount, fromAccountName, toAccountName },
  });
}

export async function notifyTransferReceived(
  recipientUserId: string,
  amount: number,
  referenceCode: string,
  senderName: string,
  toAccountName: string,
): Promise<void> {
  await createUserNotification({
    userId: recipientUserId,
    type: "TRANSFER_RECEIVED",
    title: "Transfer received",
    body: `Received ${formatFlorin(amount)} from ${senderName} into ${toAccountName}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, senderName, toAccountName },
  });
}

export async function notifyTransferReceivedToCompany(input: {
  companyId: string;
  companyName: string;
  amount: number;
  referenceCode: string;
  senderName: string;
  toAccountName: string;
}): Promise<void> {
  const userIds = await listCompanyIncomingPaymentNotifyUserIds(input.companyId);
  if (userIds.length === 0) return;

  await createUserNotifications(userIds, {
    type: "TRANSFER_RECEIVED",
    title: "Transfer received",
    body: `${input.companyName} received ${formatFlorin(input.amount)} from ${input.senderName} into ${input.toAccountName}. Reference \`${input.referenceCode}\`.`,
    linkUrl: "/bank/business",
    metadata: {
      referenceCode: input.referenceCode,
      amount: input.amount,
      senderName: input.senderName,
      toAccountName: input.toAccountName,
      companyId: input.companyId,
      companyName: input.companyName,
    },
  });
}

export async function notifyAltaPaySent(
  userId: string,
  amount: number,
  referenceCode: string,
  payeeName: string,
  fundingSourceLabel: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_PAY_SENT",
    title: "Alta Pay sent",
    body: `Paid ${formatFlorin(amount)} to ${payeeName} from ${fundingSourceLabel}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank/pay",
    metadata: { referenceCode, amount, payeeName, fundingSourceLabel },
  });
}

export async function notifyAltaPayReceived(
  recipientUserId: string,
  amount: number,
  referenceCode: string,
  payerName: string,
  toAccountName: string,
): Promise<void> {
  await createUserNotification({
    userId: recipientUserId,
    type: "ALTA_PAY_RECEIVED",
    title: "Alta Pay received",
    body: `Received ${formatFlorin(amount)} from ${payerName} into ${toAccountName}. Reference \`${referenceCode}\`.`,
    linkUrl: "/bank",
    metadata: { referenceCode, amount, payerName, toAccountName },
  });
}

export async function notifyAltaPayReceivedToCompany(input: {
  companyId: string;
  companyName: string;
  amount: number;
  referenceCode: string;
  payerName: string;
  toAccountName: string;
}): Promise<void> {
  const userIds = await listCompanyIncomingPaymentNotifyUserIds(input.companyId);
  if (userIds.length === 0) return;

  await createUserNotifications(userIds, {
    type: "ALTA_PAY_RECEIVED",
    title: "Alta Pay received",
    body: `${input.companyName} received ${formatFlorin(input.amount)} from ${input.payerName} into ${input.toAccountName}. Reference \`${input.referenceCode}\`.`,
    linkUrl: "/bank/business",
    metadata: {
      referenceCode: input.referenceCode,
      amount: input.amount,
      payerName: input.payerName,
      toAccountName: input.toAccountName,
      companyId: input.companyId,
      companyName: input.companyName,
    },
  });
}

export async function notifyLoanApplicationApproved(
  userId: string,
  applicationId: string,
  principalAmount: number,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_APPLICATION_APPROVED",
    title: "Loan application approved",
    body: `Your lending application was approved for ${formatFlorin(principalAmount)}.`,
    linkUrl: `/bank/lending/applications/${applicationId}`,
    metadata: { applicationId, principalAmount },
  });
}

export async function notifyLoanApplicationDenied(
  userId: string,
  applicationId: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_APPLICATION_DENIED",
    title: "Loan application declined",
    body: "Your lending application was declined.",
    linkUrl: `/bank/lending/applications/${applicationId}`,
    metadata: { applicationId },
  });
}

export async function notifyAltaCardApplicationApproved(
  userId: string,
  applicationId: string,
  tier: string,
  approvedLimit: number,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_APPLICATION_APPROVED",
    title: "Alta Card application approved",
    body: `Your Alta Card application was approved (${tier}, limit ${formatFlorin(approvedLimit)}).`,
    linkUrl: "/bank/alta-card",
    metadata: { applicationId, tier, approvedLimit },
  });
}

export async function notifyAltaCardApplicationDenied(
  userId: string,
  applicationId: string,
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_APPLICATION_DENIED",
    title: "Alta Card application declined",
    body: "Your Alta Card application was declined.",
    linkUrl: "/bank/alta-card",
    metadata: { applicationId },
  });
}

function friendlyFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^BAD_REQUEST:/, "").trim() || "The request could not be completed.";
}

export async function notifyTransferFailedBestEffort(
  userId: string,
  input: { amount: number; reason: string },
): Promise<void> {
  try {
    await createUserNotification({
      userId,
      type: "TRANSFER_FAILED",
      title: "Transfer could not be completed",
      body: `Your transfer of ${formatFlorin(input.amount)} did not go through. ${input.reason}`,
      linkUrl: "/bank/transfers/intrabank",
      metadata: { amount: input.amount, reason: input.reason },
    });
  } catch (error) {
    console.error("[banking-notification] transfer failed notification error", error);
  }
}

export async function notifyAltaPayFailedBestEffort(
  userId: string,
  input: { amount: number; reason: string; payeeLabel?: string },
): Promise<void> {
  try {
    const payee = input.payeeLabel?.trim();
    const payeePart = payee ? ` to ${payee}` : "";
    await createUserNotification({
      userId,
      type: "ALTA_PAY_FAILED",
      title: "Alta Pay could not be completed",
      body: `Your Alta Pay of ${formatFlorin(input.amount)}${payeePart} did not go through. ${input.reason}`,
      linkUrl: "/bank/pay",
      metadata: { amount: input.amount, reason: input.reason, payeeLabel: payee ?? null },
    });
  } catch (error) {
    console.error("[banking-notification] alta pay failed notification error", error);
  }
}

export async function notifyScheduledTransferExecuted(
  userId: string,
  input: {
    label: string;
    amount: number;
    referenceCode?: string;
    paymentType?: "ONE_TIME" | "SCHEDULED" | "RECURRING";
    bankAccountId?: string;
    companyId?: string | null;
  },
): Promise<void> {
  const kind =
    input.paymentType === "RECURRING"
      ? "Recurring transfer"
      : input.paymentType === "SCHEDULED"
        ? "Scheduled transfer"
        : "Scheduled transfer";
  const linkUrl = input.companyId && input.bankAccountId
    ? `/bank/transfers/intrabank?accountId=${input.bankAccountId}`
    : "/bank/transfers/intrabank";

  await createUserNotification({
    userId,
    type: "SCHEDULED_TRANSFER_EXECUTED",
    title: `${kind} completed`,
    body: `Your ${kind.toLowerCase()} "${input.label}" for ${formatFlorin(input.amount)} was sent successfully.${
      input.referenceCode ? ` Reference \`${input.referenceCode}\`.` : ""
    }`,
    linkUrl,
    metadata: {
      label: input.label,
      amount: input.amount,
      referenceCode: input.referenceCode ?? null,
      paymentType: input.paymentType ?? null,
      bankAccountId: input.bankAccountId ?? null,
      companyId: input.companyId ?? null,
    },
  });
}

export async function notifyScheduledTransferFailed(
  userId: string,
  input: {
    label: string;
    amount: number;
    reason: string;
    paused?: boolean;
    paymentType?: "ONE_TIME" | "SCHEDULED" | "RECURRING";
    bankAccountId?: string;
    companyId?: string | null;
  },
): Promise<void> {
  const kind =
    input.paymentType === "RECURRING"
      ? "Recurring transfer"
      : input.paymentType === "SCHEDULED"
        ? "Scheduled transfer"
        : "Scheduled transfer";
  const pausedNote = input.paused
    ? " The schedule has been paused after repeated failures."
    : "";
  const linkUrl = input.companyId && input.bankAccountId
    ? `/bank/transfers/intrabank?accountId=${input.bankAccountId}`
    : "/bank/transfers/intrabank";

  await createUserNotification({
    userId,
    type: "SCHEDULED_TRANSFER_FAILED",
    title: `${kind} failed`,
    body: `Your ${kind.toLowerCase()} "${input.label}" for ${formatFlorin(input.amount)} could not be sent. ${input.reason}${pausedNote}`,
    linkUrl,
    metadata: {
      label: input.label,
      amount: input.amount,
      reason: input.reason,
      paused: input.paused ?? false,
      paymentType: input.paymentType ?? null,
      bankAccountId: input.bankAccountId ?? null,
      companyId: input.companyId ?? null,
    },
  });
}

export async function notifyPayrollRunExecuted(
  userId: string,
  input: {
    label: string;
    totalAmount: number;
    employeeCount: number;
    bankAccountId: string;
    companyId: string;
    payrollRunId: string;
  },
): Promise<void> {
  const employeeLabel = input.employeeCount === 1 ? "employee" : "employees";
  await createUserNotification({
    userId,
    type: "PAYROLL_RUN_EXECUTED",
    title: "Payroll completed",
    body: `Payroll batch "${input.label}" for ${formatFlorin(input.totalAmount)} was sent to ${input.employeeCount} ${employeeLabel}.`,
    linkUrl: `/bank/account/${input.bankAccountId}/commercial/payroll`,
    metadata: {
      label: input.label,
      totalAmount: input.totalAmount,
      employeeCount: input.employeeCount,
      bankAccountId: input.bankAccountId,
      companyId: input.companyId,
      payrollRunId: input.payrollRunId,
    },
  });
}

export async function notifyPayrollRunFailed(
  userId: string,
  input: {
    label: string;
    totalAmount: number;
    reason: string;
    bankAccountId: string;
    companyId: string;
    payrollRunId: string;
    failedPermanently?: boolean;
  },
): Promise<void> {
  const failedNote = input.failedPermanently
    ? " The payroll batch has been marked failed after repeated errors."
    : "";
  await createUserNotification({
    userId,
    type: "PAYROLL_RUN_FAILED",
    title: "Payroll failed",
    body: `Payroll batch "${input.label}" for ${formatFlorin(input.totalAmount)} could not be completed. ${input.reason}${failedNote}`,
    linkUrl: `/bank/account/${input.bankAccountId}/commercial/payroll`,
    metadata: {
      label: input.label,
      totalAmount: input.totalAmount,
      reason: input.reason,
      failedPermanently: input.failedPermanently ?? false,
      bankAccountId: input.bankAccountId,
      companyId: input.companyId,
      payrollRunId: input.payrollRunId,
    },
  });
}

export async function notifyLoanPaymentMade(
  userId: string,
  input: { loanId: string; amount: number; referenceCode: string },
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_PAYMENT_MADE",
    title: "Loan payment received",
    body: `We received your loan payment of ${formatFlorin(input.amount)}. Reference \`${input.referenceCode}\`.`,
    linkUrl: `/bank/lending/loans/${input.loanId}`,
    metadata: { loanId: input.loanId, amount: input.amount, referenceCode: input.referenceCode },
  });
}

export async function notifyLoanPaidOff(
  userId: string,
  input: { loanId: string; referenceCode: string },
): Promise<void> {
  await createUserNotification({
    userId,
    type: "LOAN_PAID_OFF",
    title: "Loan paid off",
    body: `Congratulations — your loan is paid in full. Reference \`${input.referenceCode}\`.`,
    linkUrl: `/bank/lending/loans/${input.loanId}`,
    metadata: { loanId: input.loanId, referenceCode: input.referenceCode },
  });
}

export async function notifyLoanAutopayFailedBestEffort(
  userId: string,
  input: { loanId: string; amount: number; reason: string },
): Promise<void> {
  try {
    await createUserNotification({
      userId,
      type: "LOAN_AUTOPAY_FAILED",
      title: "Loan autopay failed",
      body: `Automatic loan payment of ${formatFlorin(input.amount)} could not be processed. ${input.reason}`,
      linkUrl: `/bank/lending/loans/${input.loanId}`,
      metadata: { loanId: input.loanId, amount: input.amount, reason: input.reason },
    });
  } catch (error) {
    console.error("[banking-notification] loan autopay failed notification error", error);
  }
}

export async function notifyAltaCardPaymentMade(
  userId: string,
  input: { cardId: string; amount: number; referenceCode: string; cardLastFour: string },
): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_PAYMENT_MADE",
    title: "Alta Card payment received",
    body: `We received your payment of ${formatFlorin(input.amount)} on card ending ${input.cardLastFour}. Reference \`${input.referenceCode}\`.`,
    linkUrl: "/bank/alta-card",
    metadata: {
      cardId: input.cardId,
      amount: input.amount,
      referenceCode: input.referenceCode,
      cardLastFour: input.cardLastFour,
    },
  });
}

export async function notifyAltaCardAutopaySucceededBestEffort(
  userId: string,
  input: { cardId: string; amount: number; referenceCode?: string | null },
): Promise<void> {
  try {
    await createUserNotification({
      userId,
      type: "ALTA_CARD_AUTOPAY_SUCCEEDED",
      title: "Alta Card autopay completed",
      body: `Your Alta Card autopay of ${formatFlorin(input.amount)} was processed successfully.${
        input.referenceCode ? ` Reference \`${input.referenceCode}\`.` : ""
      }`,
      linkUrl: "/bank/alta-card",
      metadata: { cardId: input.cardId, amount: input.amount, referenceCode: input.referenceCode ?? null },
    });
  } catch (error) {
    console.error("[banking-notification] card autopay success notification error", error);
  }
}

export async function notifyAltaCardAutopayFailedBestEffort(
  userId: string,
  input: { cardId: string; amount: number; reason: string },
): Promise<void> {
  try {
    await createUserNotification({
      userId,
      type: "ALTA_CARD_AUTOPAY_FAILED",
      title: "Alta Card autopay failed",
      body: `Automatic Alta Card payment of ${formatFlorin(input.amount)} could not be processed. ${input.reason}`,
      linkUrl: "/bank/alta-card",
      metadata: { cardId: input.cardId, amount: input.amount, reason: input.reason },
    });
  } catch (error) {
    console.error("[banking-notification] card autopay failed notification error", error);
  }
}

export async function notifyAltaCardReviewDecided(
  userId: string,
  input: { cardId: string; status: "APPROVED" | "PARTIALLY_APPROVED" | "DENIED"; reason?: string },
): Promise<void> {
  const approved = input.status === "APPROVED" || input.status === "PARTIALLY_APPROVED";
  await createUserNotification({
    userId,
    type: "ALTA_CARD_REVIEW_DECIDED",
    title: approved ? "Alta Card review approved" : "Alta Card review declined",
    body: approved
      ? "Your Alta Card account review was approved. Open Alta Bank to see your updated terms."
      : `Your Alta Card account review was declined.${input.reason?.trim() ? ` ${input.reason.trim()}` : ""}`,
    linkUrl: "/bank/alta-card",
    metadata: { cardId: input.cardId, status: input.status, reason: input.reason ?? null },
  });
}

export async function notifyAltaCardActivated(userId: string, cardId: string, cardLastFour: string): Promise<void> {
  await createUserNotification({
    userId,
    type: "ALTA_CARD_ACTIVATED",
    title: "Alta Card activated",
    body: `Your Alta Card ending ${cardLastFour} is now active.`,
    linkUrl: "/bank/alta-card",
    metadata: { cardId, cardLastFour },
  });
}

export async function notifyCompanyVerified(
  userIds: string[],
  input: { companyId: string; companyName: string },
): Promise<void> {
  if (userIds.length === 0) return;
  await createUserNotifications(userIds, {
    type: "COMPANY_VERIFIED",
    title: "Company verified",
    body: `${input.companyName} is now verified on Alta Bank. Business banking features are fully available.`,
    linkUrl: "/bank/business",
    metadata: { companyId: input.companyId, companyName: input.companyName },
  });
}

export async function notifyCompanyRoleChanged(
  userId: string,
  input: { companyId: string; companyName: string; newRole: string },
): Promise<void> {
  await createUserNotification({
    userId,
    type: "COMPANY_ROLE_CHANGED",
    title: "Company role updated",
    body: `Your role at ${input.companyName} is now ${input.newRole.replaceAll("_", " ")}.`,
    linkUrl: "/bank/business",
    metadata: { companyId: input.companyId, companyName: input.companyName, newRole: input.newRole },
  });
}

async function notifyCommercialBillingUsers(
  companyId: string,
  input: {
    type:
      | "COMMERCIAL_PRO_ACTIVATED"
      | "COMMERCIAL_PRO_BILLING_SUCCEEDED"
      | "COMMERCIAL_PRO_BILLING_FAILED"
      | "COMMERCIAL_PRO_PAST_DUE"
      | "COMMERCIAL_PRO_DOWNGRADED"
      | "COMMERCIAL_BILLING_ACCOUNT_CHANGED";
    title: string;
    body: string;
    linkUrl: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { listCommercialBillingNotifyUserIds } = await import("@/server/commercial-audit.service");
  const userIds = await listCommercialBillingNotifyUserIds(companyId);
  if (userIds.length === 0) return;
  await createUserNotifications(userIds, {
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    metadata: input.metadata,
  });
}

export async function notifyCommercialProActivated(input: {
  companyId: string;
  monthlyFee: number;
  nextBillingAt: string;
  billingAccountId: string;
}): Promise<void> {
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_PRO_ACTIVATED",
    title: "Alta Commercial Pro activated",
    body: `Your company is now on Alta Commercial Pro at ${formatFlorin(input.monthlyFee)} per month. Next billing date: ${new Date(input.nextBillingAt).toLocaleDateString()}.`,
    linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
    metadata: input,
  });
}

export async function notifyCommercialProBillingSucceeded(input: {
  companyId: string;
  amount: number;
  nextBillingAt: string;
  billingAccountId: string;
}): Promise<void> {
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_PRO_BILLING_SUCCEEDED",
    title: "Commercial Pro billing succeeded",
    body: `Alta Commercial Pro was billed ${formatFlorin(input.amount)}. Next billing date: ${new Date(input.nextBillingAt).toLocaleDateString()}.`,
    linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
    metadata: input,
  });
}

export async function notifyCommercialProBillingFailed(input: {
  companyId: string;
  amount: number;
  reason: string;
  billingAccountId: string;
}): Promise<void> {
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_PRO_BILLING_FAILED",
    title: "Commercial Pro billing failed",
    body: `We could not bill ${formatFlorin(input.amount)} for Alta Commercial Pro. ${input.reason}`,
    linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
    metadata: input,
  });
}

export async function notifyCommercialProPastDue(input: {
  companyId: string;
  amount: number;
  billingAccountId: string;
}): Promise<void> {
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_PRO_PAST_DUE",
    title: "Commercial Pro billing past due",
    body: `Alta Commercial Pro billing of ${formatFlorin(input.amount)} is past due. Add funds to your billing account to keep Pro features active.`,
    linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
    metadata: input,
  });
}

export async function notifyCommercialProDowngraded(input: {
  companyId: string;
  reason: string;
}): Promise<void> {
  const account = await prisma.bankAccount.findFirst({
    where: { companyId: input.companyId, accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
    select: { id: true },
  });
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_PRO_DOWNGRADED",
    title: "Downgraded to Alta Commercial Core",
    body: `Your company was downgraded to Alta Commercial Core. ${input.reason}`,
    linkUrl: account
      ? `/bank/account/${account.id}/commercial/settings`
      : "/bank/business",
    metadata: input,
  });
}

export async function notifyCommercialBillingAccountChanged(input: {
  companyId: string;
  billingAccountId: string;
}): Promise<void> {
  await notifyCommercialBillingUsers(input.companyId, {
    type: "COMMERCIAL_BILLING_ACCOUNT_CHANGED",
    title: "Commercial Pro billing account updated",
    body: "Your Alta Commercial Pro billing account was changed.",
    linkUrl: `/bank/account/${input.billingAccountId}/commercial/settings`,
    metadata: input,
  });
}

export async function notifyCommercialProAdminGranted(input: {
  companyId: string;
  companyName: string;
  months: number;
  expiresAt: string;
  linkUrl: string;
}): Promise<void> {
  const { listCompanyMemberUserIds } = await import("@/server/commercial-audit.service");
  const userIds = await listCompanyMemberUserIds(input.companyId);
  if (userIds.length === 0) return;

  const expiryLabel = new Date(input.expiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const monthLabel = input.months === 1 ? "1 month" : `${input.months} months`;

  await createUserNotifications(userIds, {
    type: "COMMERCIAL_PRO_ADMIN_GRANTED",
    title: "Alta Commercial Pro granted",
    body: `${input.companyName} received Alta Commercial Pro for ${monthLabel}, active through ${expiryLabel}.`,
    linkUrl: input.linkUrl,
    metadata: {
      companyId: input.companyId,
      companyName: input.companyName,
      months: input.months,
      expiresAt: input.expiresAt,
    },
  });
}

export { friendlyFailureReason };
