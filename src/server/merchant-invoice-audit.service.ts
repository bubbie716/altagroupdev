import type { MerchantInvoiceEventType } from "@prisma/client";
import { formatFlorin } from "@/lib/bank/format";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { prisma } from "@/server/db";

export type MerchantInvoiceAuditAction =
  | "MERCHANT_INVOICE_CREATED"
  | "MERCHANT_INVOICE_SENT"
  | "MERCHANT_INVOICE_VIEWED"
  | "MERCHANT_INVOICE_PAID"
  | "MERCHANT_INVOICE_CANCELLED"
  | "MERCHANT_INVOICE_VOIDED"
  | "MERCHANT_INVOICE_OVERDUE"
  | "MERCHANT_INVOICE_REMINDER_SENT"
  | "MERCHANT_INVOICE_PAYMENT_FAILED";

export async function appendMerchantInvoiceEvent(input: {
  invoiceId: string;
  eventType: MerchantInvoiceEventType;
  actorUserId?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.merchantInvoiceEvent.create({
    data: {
      invoiceId: input.invoiceId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      source: input.source,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function writeMerchantInvoiceAudit(input: {
  actorUserId: string;
  action: MerchantInvoiceAuditAction;
  invoiceId: string;
  merchantCompanyId: string;
  recipientUserId?: string | null;
  recipientCompanyId?: string | null;
  amount: number;
  status: string;
  referenceCode: string;
  source: string;
  description?: string;
  targetTransactionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "MERCHANT_INVOICE",
    entityId: input.invoiceId,
    targetCompanyId: input.merchantCompanyId,
    targetUserId: input.recipientUserId ?? undefined,
    targetTransactionId: input.targetTransactionId,
    description:
      input.description ?? `${input.action.replace(/_/g, " ")} · ${input.referenceCode}`,
    metadata: auditSourceMetadata(input.source, {
      invoiceId: input.invoiceId,
      merchantCompanyId: input.merchantCompanyId,
      recipientUserId: input.recipientUserId ?? null,
      recipientCompanyId: input.recipientCompanyId ?? null,
      amount: input.amount,
      status: input.status,
      referenceCode: input.referenceCode,
      ...input.metadata,
    }),
  });
}

export async function recordMerchantInvoiceSentAudit(input: {
  actorUserId: string;
  invoiceId: string;
  merchantCompanyId: string;
  merchantName: string;
  recipientUserId?: string | null;
  recipientCompanyId?: string | null;
  recipientName: string;
  amount: number;
  referenceCode: string;
  source: string;
  sentAt: Date;
}): Promise<void> {
  const amountLabel = formatFlorin(input.amount);

  await writeMerchantInvoiceAudit({
    actorUserId: input.actorUserId,
    action: "MERCHANT_INVOICE_SENT",
    invoiceId: input.invoiceId,
    merchantCompanyId: input.merchantCompanyId,
    recipientUserId: input.recipientUserId,
    recipientCompanyId: input.recipientCompanyId,
    amount: input.amount,
    status: "SENT",
    referenceCode: input.referenceCode,
    source: input.source,
    description: `Invoice ${input.referenceCode} sent to ${input.recipientName} · ${amountLabel}`,
    metadata: {
      merchantName: input.merchantName,
      recipientName: input.recipientName,
      sentAt: input.sentAt.toISOString(),
    },
  });

  await appendMerchantInvoiceEvent({
    invoiceId: input.invoiceId,
    eventType: "SENT",
    actorUserId: input.actorUserId,
    source: input.source,
    metadata: {
      sentAt: input.sentAt.toISOString(),
      recipientName: input.recipientName,
      amount: input.amount,
    },
  });

  try {
    const { recordCompanyRelationshipTimelineEvent } = await import(
      "@/server/company-relationship-timeline.service"
    );
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.merchantCompanyId,
      eventType: "MERCHANT_INVOICE_SENT",
      title: `Invoice ${input.referenceCode} sent`,
      description: `${amountLabel} to ${input.recipientName}`,
      occurredAt: input.sentAt,
      relatedEntityType: "MERCHANT_INVOICE",
      relatedEntityId: input.invoiceId,
      dedupeKey: `merchant-invoice-sent:${input.invoiceId}`,
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  } catch (error) {
    console.error("[merchant-invoice] sent timeline event failed", error);
  }
}

export async function recordMerchantInvoicePaidAudit(input: {
  actorUserId: string;
  invoiceId: string;
  merchantCompanyId: string;
  merchantName: string;
  recipientUserId?: string | null;
  recipientCompanyId?: string | null;
  payerLabel: string;
  amount: number;
  referenceCode: string;
  paymentReferenceCode: string;
  targetTransactionId: string;
  source: string;
  paidAt: Date;
  feeAmount?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const amountLabel = formatFlorin(input.amount);

  await writeMerchantInvoiceAudit({
    actorUserId: input.actorUserId,
    action: "MERCHANT_INVOICE_PAID",
    invoiceId: input.invoiceId,
    merchantCompanyId: input.merchantCompanyId,
    recipientUserId: input.recipientUserId,
    recipientCompanyId: input.recipientCompanyId,
    amount: input.amount,
    status: "PAID",
    referenceCode: input.referenceCode,
    source: input.source,
    targetTransactionId: input.targetTransactionId,
    description: `Invoice ${input.referenceCode} paid by ${input.payerLabel} · ${amountLabel}`,
    metadata: {
      paymentReferenceCode: input.paymentReferenceCode,
      payerLabel: input.payerLabel,
      merchantName: input.merchantName,
      paidAt: input.paidAt.toISOString(),
      feeAmount: input.feeAmount,
      ...input.metadata,
    },
  });

  await appendMerchantInvoiceEvent({
    invoiceId: input.invoiceId,
    eventType: "PAYMENT_COMPLETED",
    actorUserId: input.actorUserId,
    source: input.source,
    metadata: {
      paymentReferenceCode: input.paymentReferenceCode,
      amount: input.amount,
      payerLabel: input.payerLabel,
      paidAt: input.paidAt.toISOString(),
    },
  });

  try {
    const { recordCompanyRelationshipTimelineEvent } = await import(
      "@/server/company-relationship-timeline.service"
    );
    await recordCompanyRelationshipTimelineEvent({
      companyId: input.merchantCompanyId,
      eventType: "MERCHANT_INVOICE_PAID",
      title: `Invoice ${input.referenceCode} paid`,
      description: `${amountLabel} from ${input.payerLabel}`,
      occurredAt: input.paidAt,
      relatedEntityType: "MERCHANT_INVOICE",
      relatedEntityId: input.invoiceId,
      dedupeKey: `merchant-invoice-paid:${input.invoiceId}`,
      actorUserId: input.actorUserId,
      skipAudit: true,
    });
  } catch (error) {
    console.error("[merchant-invoice] paid timeline event failed", error);
  }
}

export function mapAuditActionToEventType(
  action: MerchantInvoiceAuditAction,
): MerchantInvoiceEventType {
  switch (action) {
    case "MERCHANT_INVOICE_CREATED":
      return "CREATED";
    case "MERCHANT_INVOICE_SENT":
      return "SENT";
    case "MERCHANT_INVOICE_VIEWED":
      return "VIEWED";
    case "MERCHANT_INVOICE_PAID":
      return "PAYMENT_COMPLETED";
    case "MERCHANT_INVOICE_CANCELLED":
      return "CANCELLED";
    case "MERCHANT_INVOICE_VOIDED":
      return "VOIDED";
    case "MERCHANT_INVOICE_OVERDUE":
      return "OVERDUE_MARKED";
    case "MERCHANT_INVOICE_REMINDER_SENT":
      return "REMINDER_SENT";
    case "MERCHANT_INVOICE_PAYMENT_FAILED":
      return "PAYMENT_FAILED";
    default:
      return "UPDATED";
  }
}
