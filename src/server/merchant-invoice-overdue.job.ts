import { prisma } from "@/server/db";
import {
  appendMerchantInvoiceEvent,
  writeMerchantInvoiceAudit,
} from "@/server/merchant-invoice-audit.service";
import { notifyMerchantInvoiceOverdue } from "@/server/merchant-invoice-notification.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function markOverdueMerchantInvoices(now = new Date()): Promise<number> {
  const dueInvoices = await prisma.merchantInvoice.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
      dueDate: { lt: now },
    },
    take: 200,
  });

  if (dueInvoices.length === 0) return 0;

  const actorUserId = await resolveSystemActorUserId();

  for (const invoice of dueInvoices) {
    await prisma.merchantInvoice.update({
      where: { id: invoice.id },
      data: { status: "OVERDUE" },
    });

    await writeMerchantInvoiceAudit({
      actorUserId,
      action: "MERCHANT_INVOICE_OVERDUE",
      invoiceId: invoice.id,
      merchantCompanyId: invoice.merchantCompanyId,
      recipientUserId: invoice.recipientUserId,
      recipientCompanyId: invoice.recipientCompanyId,
      amount: decimalToNumber(invoice.amount),
      status: "OVERDUE",
      referenceCode: invoice.referenceCode,
      source: "cron",
    });
    await appendMerchantInvoiceEvent({
      invoiceId: invoice.id,
      eventType: "OVERDUE_MARKED",
      actorUserId,
      source: "cron",
    });

    try {
      await notifyMerchantInvoiceOverdue(invoice.id);
    } catch (error) {
      console.error("[merchant-invoice] overdue notification failed", invoice.id, error);
    }
  }

  return dueInvoices.length;
}

export async function runMerchantInvoiceOverdueJob(): Promise<{ overdueMarked: number }> {
  const overdueMarked = await markOverdueMerchantInvoices();
  return { overdueMarked };
}
