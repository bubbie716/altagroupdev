import type {
  MerchantInvoiceDetail,
  MerchantInvoiceSummaryRow,
} from "@/lib/bank/merchant-invoice-types";
import type { PaymentLinkDetail, PaymentLinkSummaryRow } from "@/lib/bank/payment-link-types";
import { paymentLinkCheckoutPath } from "@/lib/bank/payment-link-checkout-url";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
import { requireOperator } from "@/server/permissions.service";
import { prisma } from "@/server/db";

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function mapInvoiceSummary(invoice: {
  id: string;
  referenceCode: string;
  merchantCompanyId: string;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  amount: { toString(): string };
  amountPaid: { toString(): string };
  currency: string;
  description: string;
  memo: string | null;
  dueDate: Date | null;
  status: MerchantInvoiceSummaryRow["status"];
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  merchantCompany: { name: string };
  recipient: { discordUsername: string; minecraftUsername?: string | null } | null;
  recipientCompany: { name: string } | null;
}): MerchantInvoiceSummaryRow {
  const recipientKind = invoice.recipientCompanyId ? "company" : "person";
  return {
    id: invoice.id,
    referenceCode: invoice.referenceCode,
    merchantCompanyId: invoice.merchantCompanyId,
    merchantName: invoice.merchantCompany.name,
    recipientKind,
    recipientUserId: invoice.recipientUserId,
    recipientCompanyId: invoice.recipientCompanyId,
    recipientName:
      invoice.recipientCompany?.name ??
      (invoice.recipient ? formatAltaUserHandle(invoice.recipient) : null) ??
      "Recipient",
    amount: decimalToNumber(invoice.amount),
    amountPaid: decimalToNumber(invoice.amountPaid),
    currency: invoice.currency,
    description: invoice.description,
    memo: invoice.memo,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    viewedAt: invoice.viewedAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export async function searchMerchantInvoicesAdmin(filters: {
  q?: string;
  limit?: number;
}): Promise<{ items: MerchantInvoiceSummaryRow[]; total: number }> {
  await requireOperator();
  const limit = Math.min(filters.limit ?? 50, 100);
  const q = filters.q?.trim();
  const where = q
    ? {
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { merchantCompany: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.merchantInvoice.count({ where }),
    prisma.merchantInvoice.findMany({
      where,
      include: {
        merchantCompany: { select: { name: true } },
        recipient: { select: { discordUsername: true, minecraftUsername: true } },
        recipientCompany: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);
  return { items: rows.map(mapInvoiceSummary), total };
}

export async function getMerchantInvoiceAdminDetail(invoiceId: string): Promise<MerchantInvoiceDetail> {
  await requireOperator();
  const row = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      merchantCompany: { select: { name: true } },
      recipient: { select: { discordUsername: true, minecraftUsername: true } },
      recipientCompany: { select: { name: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
      payment: { select: { referenceCode: true } },
    },
  });
  if (!row) notFound();
  return {
    ...mapInvoiceSummary(row),
    lineItems: row.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: decimalToNumber(item.quantity),
      unitAmount: decimalToNumber(item.unitAmount),
      lineTotal: decimalToNumber(item.lineTotal),
      sortOrder: item.sortOrder,
    })),
    events: row.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      source: event.source,
      metadata:
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null,
      createdAt: event.createdAt.toISOString(),
    })),
    paymentReferenceCode: row.payment?.referenceCode ?? null,
  };
}

function mapLinkSummary(link: {
  id: string;
  slug: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantCompany: { name: string };
  title: string | null;
  description: string;
  amountType: PaymentLinkSummaryRow["amountType"];
  usageType: PaymentLinkSummaryRow["usageType"];
  amount: { toString(): string } | null;
  minAmount: { toString(): string } | null;
  maxAmount: { toString(): string } | null;
  currency: string;
  status: PaymentLinkSummaryRow["status"];
  expiresAt: Date | null;
  paymentCount: number;
  totalCollected: { toString(): string };
  createdAt: Date;
}): PaymentLinkSummaryRow {
  return {
    id: link.id,
    slug: link.slug,
    referenceCode: link.referenceCode,
    merchantCompanyId: link.merchantCompanyId,
    merchantName: link.merchantCompany.name,
    title: link.title,
    description: link.description,
    amountType: link.amountType,
    usageType: link.usageType,
    amount: link.amount == null ? null : decimalToNumber(link.amount),
    minAmount: link.minAmount == null ? null : decimalToNumber(link.minAmount),
    maxAmount: link.maxAmount == null ? null : decimalToNumber(link.maxAmount),
    currency: link.currency,
    status: link.status,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    paymentCount: link.paymentCount,
    totalCollected: decimalToNumber(link.totalCollected),
    createdAt: link.createdAt.toISOString(),
    checkoutUrl: paymentLinkCheckoutPath(link.slug),
  };
}

export async function searchPaymentLinksAdmin(filters: {
  q?: string;
  limit?: number;
}): Promise<{ items: PaymentLinkSummaryRow[]; total: number }> {
  await requireOperator();
  const limit = Math.min(filters.limit ?? 50, 100);
  const q = filters.q?.trim();
  const where = q
    ? {
        OR: [
          { referenceCode: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { title: { contains: q, mode: "insensitive" as const } },
          { merchantCompany: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.paymentLink.count({ where }),
    prisma.paymentLink.findMany({
      where,
      include: { merchantCompany: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);
  return { items: rows.map(mapLinkSummary), total };
}

export async function getPaymentLinkAdminDetail(linkId: string): Promise<PaymentLinkDetail> {
  await requireOperator();
  const row = await prisma.paymentLink.findUnique({
    where: { id: linkId },
    include: {
      merchantCompany: { select: { name: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { payment: { select: { referenceCode: true } } },
      },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!row) notFound();
  return {
    ...mapLinkSummary(row),
    internalMemo: row.internalMemo,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    recentPayments: row.payments.map((payment) => ({
      id: payment.id,
      amount: decimalToNumber(payment.amount),
      feeAmount: decimalToNumber(payment.feeAmount),
      payerLabel: payment.payerLabel,
      paymentReferenceCode: payment.payment?.referenceCode ?? null,
      status: payment.status,
      completedAt: payment.completedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    events: row.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      source: event.source,
      metadata:
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
