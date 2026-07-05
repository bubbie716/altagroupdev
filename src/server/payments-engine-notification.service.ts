import type { ScheduledPayment } from "@prisma/client";
import { createUserNotification } from "@/server/notification.service";

async function notify(userId: string, type: Parameters<typeof createUserNotification>[0]["type"], title: string, body: string) {
  try {
    await createUserNotification({ userId, type, title, body, linkUrl: "/bank/pay" });
  } catch (error) {
    console.error("[payments-engine-notification]", type, error);
  }
}

export async function notifyPaymentScheduleCreatedBestEffort(userId: string, schedule: { payeeLabel: string; amount: number; paymentTypeLabel: string; scheduledDate: string | null }) {
  await notify(
    userId,
    schedule.paymentTypeLabel === "Recurring" ? "PAYMENT_RECURRING_CREATED" : "PAYMENT_SCHEDULED_CREATED",
    `${schedule.paymentTypeLabel} payment created`,
    `${schedule.paymentTypeLabel} payment of ƒ${schedule.amount.toLocaleString()} to ${schedule.payeeLabel} was created.`,
  );
}

export async function notifyPaymentScheduleExecutedBestEffort(userId: string, payment: ScheduledPayment, amount: number) {
  await notify(
    userId,
    payment.paymentType === "RECURRING" ? "PAYMENT_RECURRING_EXECUTED" : "PAYMENT_SCHEDULED_EXECUTED",
    "Payment completed",
    `Your payment of ƒ${amount.toLocaleString()} to ${payment.recipientName} was sent.`,
  );
}

export async function notifyPaymentScheduleFailedBestEffort(userId: string, payment: ScheduledPayment, reason: string, finalFailure: boolean) {
  await notify(
    userId,
    finalFailure ? "PAYMENT_RETRY_FINAL_FAILED" : payment.paymentType === "RECURRING" ? "PAYMENT_RECURRING_FAILED" : "PAYMENT_SCHEDULED_FAILED",
    finalFailure ? "Payment failed permanently" : "Payment failed",
    `Payment to ${payment.recipientName} failed: ${reason}`,
  );
}

export async function notifyMerchantAutopayApprovalCreatedBestEffort(userId: string, merchantName: string) {
  await notify(userId, "MERCHANT_AUTOPAY_APPROVAL_CREATED", "AutoPay merchant approved", `You approved AutoPay for ${merchantName}.`);
}

export async function notifyMerchantInvoiceAutopaidBestEffort(userId: string, merchantName: string, amount: number, referenceCode: string) {
  await notify(userId, "MERCHANT_INVOICE_AUTOPAID", "Invoice paid automatically", `Invoice ${referenceCode} from ${merchantName} for ƒ${amount.toLocaleString()} was paid via AutoPay.`);
}

export async function notifyMerchantAutopayFailedBestEffort(userId: string, merchantName: string, reason: string) {
  await notify(userId, "MERCHANT_AUTOPAY_FAILED", "AutoPay failed", `AutoPay for ${merchantName} failed: ${reason}`);
}

export async function notifyRecurringInvoiceReceivedBestEffort(userId: string, merchantName: string, templateName: string, amount: number) {
  await notify(userId, "MERCHANT_RECURRING_INVOICE_RECEIVED", "Recurring invoice received", `${merchantName} sent "${templateName}" for ƒ${amount.toLocaleString()}.`);
}

export async function notifyMerchantRecurringInvoiceGeneratedBestEffort(userIds: string[], templateName: string, referenceCode: string) {
  for (const userId of userIds) {
    await notify(userId, "MERCHANT_INVOICE_SENT", "Recurring invoice generated", `Recurring invoice "${templateName}" (${referenceCode}) was generated and sent.`);
  }
}
