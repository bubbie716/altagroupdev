import type { ScheduledPayment } from "@prisma/client";
import { prisma } from "@/server/db";

async function write(action: string, entityType: "SCHEDULED_PAYMENT" | "MERCHANT_AUTOPAY_APPROVAL" | "MERCHANT_RECURRING_INVOICE", entityId: string, actorUserId: string, description: string, metadata?: Record<string, unknown>) {
  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId,
    action,
    entityType,
    entityId,
    description,
    metadata: auditSourceMetadata("system", metadata ?? {}),
  });
}

export async function recordPaymentScheduleCreatedAudit(actorUserId: string, row: ScheduledPayment) {
  const action = row.paymentType === "RECURRING" ? "PAYMENT_RECURRING_CREATED" : "PAYMENT_SCHEDULED_CREATED";
  await write(action, "SCHEDULED_PAYMENT", row.id, actorUserId, `Created ${row.paymentType.toLowerCase()} Alta Pay to ${row.recipientName}`, {
    amount: Number(row.amount.toString()),
    paymentType: row.paymentType,
  });
}

export async function recordPaymentScheduleExecutedAudit(actorUserId: string, row: ScheduledPayment, referenceCode: string) {
  const action = row.paymentType === "RECURRING" ? "PAYMENT_RECURRING_EXECUTED" : "PAYMENT_SCHEDULED_EXECUTED";
  await write(action, "SCHEDULED_PAYMENT", row.id, actorUserId, `Executed Alta Pay to ${row.recipientName}`, { referenceCode });
}

export async function recordPaymentScheduleFailedAudit(actorUserId: string, row: ScheduledPayment, reason: string) {
  const action = row.paymentType === "RECURRING" ? "PAYMENT_RECURRING_FAILED" : "PAYMENT_SCHEDULED_FAILED";
  await write(action, "SCHEDULED_PAYMENT", row.id, actorUserId, `Alta Pay to ${row.recipientName} failed`, { reason });
}

export async function recordPaymentScheduleCancelledAudit(actorUserId: string, row: ScheduledPayment) {
  const action = row.paymentType === "RECURRING" ? "PAYMENT_RECURRING_CANCELLED" : "PAYMENT_SCHEDULED_CANCELLED";
  await write(action, "SCHEDULED_PAYMENT", row.id, actorUserId, `Cancelled Alta Pay to ${row.recipientName}`, {});
}

export async function recordPaymentRecurringPausedAudit(actorUserId: string, row: ScheduledPayment) {
  await write("PAYMENT_RECURRING_PAUSED", "SCHEDULED_PAYMENT", row.id, actorUserId, `Paused recurring Alta Pay to ${row.recipientName}`, {});
}

export async function recordPaymentRecurringResumedAudit(actorUserId: string, row: ScheduledPayment) {
  await write("PAYMENT_RECURRING_RESUMED", "SCHEDULED_PAYMENT", row.id, actorUserId, `Resumed recurring Alta Pay to ${row.recipientName}`, {});
}

export async function recordMerchantAutopayApprovalCreatedAudit(actorUserId: string, approvalId: string, merchantName: string) {
  await write("MERCHANT_AUTOPAY_APPROVAL_CREATED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `Approved AutoPay for ${merchantName}`, {});
}

export async function recordMerchantAutopayApprovalUpdatedAudit(actorUserId: string, approvalId: string, merchantName: string) {
  await write("MERCHANT_AUTOPAY_APPROVAL_UPDATED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `Updated AutoPay for ${merchantName}`, {});
}

export async function recordMerchantAutopayApprovalPausedAudit(actorUserId: string, approvalId: string, merchantName: string) {
  await write("MERCHANT_AUTOPAY_APPROVAL_PAUSED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `Paused AutoPay for ${merchantName}`, {});
}

export async function recordMerchantAutopayApprovalCancelledAudit(actorUserId: string, approvalId: string, merchantName: string) {
  await write("MERCHANT_AUTOPAY_APPROVAL_CANCELLED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `Cancelled AutoPay for ${merchantName}`, {});
}

export async function recordMerchantAutopayExecutedAudit(actorUserId: string, approvalId: string, invoiceId: string, referenceCode: string) {
  await write("MERCHANT_AUTOPAY_EXECUTED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `Auto-paid invoice ${referenceCode}`, { invoiceId, referenceCode });
}

export async function recordMerchantAutopayFailedAudit(actorUserId: string, approvalId: string, invoiceId: string, reason: string) {
  await write("MERCHANT_AUTOPAY_FAILED", "MERCHANT_AUTOPAY_APPROVAL", approvalId, actorUserId, `AutoPay failed for invoice`, { invoiceId, reason });
}

export async function recordMerchantRecurringInvoiceCreatedAudit(actorUserId: string, scheduleId: string, templateName: string) {
  await write("MERCHANT_RECURRING_INVOICE_CREATED", "MERCHANT_RECURRING_INVOICE", scheduleId, actorUserId, `Created recurring invoice schedule "${templateName}"`, {});
}

export async function recordMerchantRecurringInvoiceGeneratedAudit(actorUserId: string, scheduleId: string, invoiceId: string) {
  await write("MERCHANT_RECURRING_INVOICE_GENERATED", "MERCHANT_RECURRING_INVOICE", scheduleId, actorUserId, `Generated invoice from recurring schedule`, { invoiceId });
}

export async function recordMerchantRecurringInvoicePausedAudit(actorUserId: string, scheduleId: string, templateName: string) {
  await write("MERCHANT_RECURRING_INVOICE_PAUSED", "MERCHANT_RECURRING_INVOICE", scheduleId, actorUserId, `Paused recurring invoice "${templateName}"`, {});
}

export async function recordMerchantRecurringInvoiceCancelledAudit(actorUserId: string, scheduleId: string, templateName: string) {
  await write("MERCHANT_RECURRING_INVOICE_CANCELLED", "MERCHANT_RECURRING_INVOICE", scheduleId, actorUserId, `Cancelled recurring invoice "${templateName}"`, {});
}

export async function recordMerchantRecurringInvoiceFailedAudit(actorUserId: string, scheduleId: string, reason: string) {
  await write("MERCHANT_RECURRING_INVOICE_FAILED", "MERCHANT_RECURRING_INVOICE", scheduleId, actorUserId, `Recurring invoice schedule failed`, { reason });
}

export async function countAutopayExecutionsThisMonth(approvalId: string, userId: string, merchantCompanyId: string): Promise<number> {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  return prisma.merchantInvoicePayment.count({
    where: {
      isAutopay: true,
      autopayApprovalId: approvalId,
      status: "COMPLETED",
      completedAt: { gte: monthStart },
      invoice: { merchantCompanyId, recipientUserId: userId },
    },
  });
}
