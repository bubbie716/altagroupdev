import type { PaymentLinkEventType } from "@prisma/client";
import { formatFlorin } from "@/lib/bank/format";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { prisma } from "@/server/db";

export type PaymentLinkAuditAction =
  | "PAYMENT_LINK_CREATED"
  | "PAYMENT_LINK_UPDATED"
  | "PAYMENT_LINK_PAUSED"
  | "PAYMENT_LINK_ACTIVATED"
  | "PAYMENT_LINK_CANCELLED"
  | "PAYMENT_LINK_PAID"
  | "PAYMENT_LINK_PAYMENT_FAILED";

export async function appendPaymentLinkEvent(input: {
  paymentLinkId: string;
  eventType: PaymentLinkEventType;
  actorUserId?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.paymentLinkEvent.create({
    data: {
      paymentLinkId: input.paymentLinkId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      source: input.source,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function writePaymentLinkAudit(input: {
  actorUserId: string;
  action: PaymentLinkAuditAction;
  paymentLinkId: string;
  merchantCompanyId: string;
  slug: string;
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
    entityType: "PAYMENT_LINK",
    entityId: input.paymentLinkId,
    targetCompanyId: input.merchantCompanyId,
    targetTransactionId: input.targetTransactionId,
    description:
      input.description ?? `${input.action.replace(/_/g, " ")} · ${input.referenceCode}`,
    metadata: auditSourceMetadata(input.source, {
      paymentLinkId: input.paymentLinkId,
      merchantCompanyId: input.merchantCompanyId,
      slug: input.slug,
      referenceCode: input.referenceCode,
      ...input.metadata,
    }),
  });
}

export async function recordPaymentLinkPaidAudit(input: {
  actorUserId: string;
  paymentLinkId: string;
  merchantCompanyId: string;
  merchantName: string;
  slug: string;
  referenceCode: string;
  payerLabel: string;
  amount: number;
  paymentReferenceCode: string;
  targetTransactionId: string;
  source: string;
  paidAt: Date;
  feeAmount?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const amountLabel = formatFlorin(input.amount);

  await writePaymentLinkAudit({
    actorUserId: input.actorUserId,
    action: "PAYMENT_LINK_PAID",
    paymentLinkId: input.paymentLinkId,
    merchantCompanyId: input.merchantCompanyId,
    slug: input.slug,
    referenceCode: input.referenceCode,
    source: input.source,
    targetTransactionId: input.targetTransactionId,
    description: `Payment link ${input.referenceCode} paid by ${input.payerLabel} · ${amountLabel}`,
    metadata: {
      paymentReferenceCode: input.paymentReferenceCode,
      payerLabel: input.payerLabel,
      merchantName: input.merchantName,
      paidAt: input.paidAt.toISOString(),
      feeAmount: input.feeAmount,
      ...input.metadata,
    },
  });

  await appendPaymentLinkEvent({
    paymentLinkId: input.paymentLinkId,
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
}

export function mapAuditActionToPaymentLinkEventType(
  action: PaymentLinkAuditAction,
): PaymentLinkEventType {
  switch (action) {
    case "PAYMENT_LINK_CREATED":
      return "CREATED";
    case "PAYMENT_LINK_UPDATED":
      return "UPDATED";
    case "PAYMENT_LINK_PAUSED":
      return "PAUSED";
    case "PAYMENT_LINK_ACTIVATED":
      return "ACTIVATED";
    case "PAYMENT_LINK_CANCELLED":
      return "CANCELLED";
    case "PAYMENT_LINK_PAID":
      return "PAYMENT_COMPLETED";
    case "PAYMENT_LINK_PAYMENT_FAILED":
      return "PAYMENT_FAILED";
    default:
      return "UPDATED";
  }
}
