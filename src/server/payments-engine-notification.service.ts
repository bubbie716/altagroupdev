import type { ScheduledPayment } from "@prisma/client";
import { formatFlorin } from "@/lib/bank/format";
import { toCustomerSafePaymentFailureReason } from "@/lib/bank/customer-payment-failure-reason";
import type { CreateNotificationInput } from "@/server/notification.service";
import { scheduleCreateUserNotification } from "@/server/notification.service";

async function notify(
  userId: string,
  type: CreateNotificationInput["type"],
  title: string,
  body: string,
  linkUrl = "/bank/pay",
  options?: { customDmPayload?: CreateNotificationInput["customDmPayload"] },
): Promise<void> {
  try {
    scheduleCreateUserNotification({
      userId,
      type,
      title,
      body,
      linkUrl,
      customDmPayload: options?.customDmPayload,
    });
  } catch (error) {
    console.error("[payments-engine-notification]", type, error);
  }
}

export async function notifyPaymentScheduleCreatedBestEffort(
  userId: string,
  schedule: { payeeLabel: string; amount: number; paymentTypeLabel: string; scheduledDate: string | null },
): Promise<void> {
  await notify(
    userId,
    schedule.paymentTypeLabel === "Recurring" ? "PAYMENT_RECURRING_CREATED" : "PAYMENT_SCHEDULED_CREATED",
    `${schedule.paymentTypeLabel} payment created`,
    `${schedule.paymentTypeLabel} payment of ${formatFlorin(schedule.amount)} to ${schedule.payeeLabel} was created.`,
  );
}

export async function notifyPaymentScheduleExecutedBestEffort(
  userId: string,
  payment: ScheduledPayment,
  amount: number,
): Promise<void> {
  await notify(
    userId,
    payment.paymentType === "RECURRING" ? "PAYMENT_RECURRING_EXECUTED" : "PAYMENT_SCHEDULED_EXECUTED",
    "Payment complete",
    `Your payment of ${formatFlorin(amount)} to ${payment.recipientName} was sent.`,
  );
}

export async function notifyPaymentScheduleFailedBestEffort(
  userId: string,
  payment: ScheduledPayment,
  reason: string,
  finalFailure: boolean,
): Promise<void> {
  const safeReason = toCustomerSafePaymentFailureReason(reason);
  await notify(
    userId,
    finalFailure ? "PAYMENT_RETRY_FINAL_FAILED" : payment.paymentType === "RECURRING" ? "PAYMENT_RECURRING_FAILED" : "PAYMENT_SCHEDULED_FAILED",
    finalFailure ? "Payment could not be completed" : "Payment could not be completed",
    `We couldn't send ${formatFlorin(Number(payment.amount.toString()))} to ${payment.recipientName}. ${safeReason}`,
  );
}

export async function notifyMerchantAutopayApprovalCreatedBestEffort(userId: string, merchantName: string): Promise<void> {
  await notify(userId, "MERCHANT_AUTOPAY_APPROVAL_CREATED", "AutoPay merchant approved", `You approved AutoPay for ${merchantName}.`);
}

export async function notifyMerchantAutopayApprovalUpdatedBestEffort(userId: string, merchantName: string): Promise<void> {
  await notify(userId, "MERCHANT_AUTOPAY_APPROVAL_UPDATED", "AutoPay rules updated", `Your AutoPay rules for ${merchantName} were updated.`);
}

export async function notifyMerchantAutopayApprovalPausedBestEffort(userId: string, merchantName: string): Promise<void> {
  await notify(userId, "MERCHANT_AUTOPAY_APPROVAL_PAUSED", "AutoPay paused", `AutoPay for ${merchantName} is paused.`);
}

export async function notifyMerchantAutopayApprovalCancelledBestEffort(userId: string, merchantName: string): Promise<void> {
  await notify(userId, "MERCHANT_AUTOPAY_APPROVAL_CANCELLED", "AutoPay cancelled", `AutoPay for ${merchantName} was cancelled.`);
}

export async function notifyMerchantInvoiceAutopaidBestEffort(
  userId: string,
  merchantName: string,
  amount: number,
  referenceCode: string,
  fundingLabel?: string,
  invoiceId?: string,
): Promise<void> {
  const funding = fundingLabel ? ` from ${fundingLabel}` : "";
  await notify(
    userId,
    "MERCHANT_INVOICE_AUTOPAID",
    "Invoice paid automatically",
    `${merchantName} invoice \`${referenceCode}\` for ${formatFlorin(amount)} was paid via AutoPay${funding}.`,
    invoiceId ? `/bank/pay/invoices/${invoiceId}` : "/bank/pay",
  );
}

export async function notifyMerchantAutopayFailedBestEffort(userId: string, merchantName: string, reason: string): Promise<void> {
  const safeReason = toCustomerSafePaymentFailureReason(reason);
  await notify(
    userId,
    "MERCHANT_AUTOPAY_FAILED",
    "AutoPay failed",
    `We couldn't auto-pay ${merchantName}'s invoice. ${safeReason}`,
  );
}

export async function notifyMerchantAutopayConfirmationRequiredBestEffort(input: {
  userId: string;
  invoiceId: string;
  merchantName: string;
  amount: number;
  referenceCode: string;
  customDmPayload?: CreateNotificationInput["customDmPayload"];
}): Promise<void> {
  await notify(
    input.userId,
    "MERCHANT_AUTOPAY_CONFIRMATION_REQUIRED",
    "AutoPay confirmation required",
    `${input.merchantName} invoice \`${input.referenceCode}\` for ${formatFlorin(input.amount)} requires your confirmation before AutoPay can run.`,
    `/bank/pay/invoices/${input.invoiceId}`,
    { customDmPayload: input.customDmPayload },
  );
}

/** @deprecated Duplicate of invoice received DM — do not call for auto-sent recurring invoices. */
export async function notifyRecurringInvoiceReceivedBestEffort(
  userId: string,
  merchantName: string,
  templateName: string,
  amount: number,
): Promise<void> {
  await notify(
    userId,
    "MERCHANT_RECURRING_INVOICE_RECEIVED",
    "Recurring invoice received",
    `${merchantName} sent "${templateName}" for ${formatFlorin(amount)}.`,
  );
}

export async function notifyMerchantRecurringInvoiceGeneratedBestEffort(
  userIds: string[],
  templateName: string,
  referenceCode: string,
): Promise<void> {
  for (const userId of userIds) {
    await notify(
      userId,
      "MERCHANT_INVOICE_SENT",
      "Recurring invoice generated",
      `Recurring invoice "${templateName}" (${referenceCode}) was generated and sent.`,
    );
  }
}
