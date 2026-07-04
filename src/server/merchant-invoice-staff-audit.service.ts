import { prisma } from "@/server/db";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

async function readStaffAlertThreshold(): Promise<number | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "merchant_invoice.staff_alert_threshold" },
  });
  if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
    return null;
  }
  const enabled = (setting.value as { enabled?: boolean }).enabled;
  const amount = Number((setting.value as { amount?: number }).amount);
  if (enabled === false || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

async function readRepeatWindowConfig(): Promise<{ count: number; windowMinutes: number } | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "merchant_invoice.staff_alert_repeat_window" },
  });
  if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
    return null;
  }
  const count = Number((setting.value as { count?: number }).count);
  const windowMinutes = Number((setting.value as { windowMinutes?: number }).windowMinutes);
  if (!Number.isFinite(count) || !Number.isFinite(windowMinutes) || count < 2) return null;
  return { count, windowMinutes };
}

export async function maybeAlertHighValueInvoiceSent(invoice: {
  id: string;
  referenceCode: string;
  merchantCompanyId: string;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  amount: { toString(): string };
  merchantCompany?: { name: string };
}): Promise<void> {
  const threshold = await readStaffAlertThreshold();
  if (threshold == null) return;

  const amount = decimalToNumber(invoice.amount);
  if (amount < threshold) return;

  const company =
    invoice.merchantCompany ??
    (await prisma.company.findUnique({
      where: { id: invoice.merchantCompanyId },
      select: { name: true },
    }));
  if (!company) return;

  await sendStaffAuditMessage({
    action: "High-value merchant invoice sent",
    product: "Alta Pay",
    severity: "ACTION",
    actorName: company.name,
    details: `Invoice ${invoice.referenceCode} sent for ƒ${amount.toLocaleString()}`,
    internalUrl: `/internal/companies`,
    dedupeKey: `merchant-invoice-high-value:${invoice.id}`,
  });

  const repeatConfig = await readRepeatWindowConfig();
  if (!repeatConfig) return;

  const since = new Date(Date.now() - repeatConfig.windowMinutes * 60_000);
  const recipientKey = invoice.recipientCompanyId ?? invoice.recipientUserId ?? "unknown";
  const recentCount = await prisma.merchantInvoice.count({
    where: {
      merchantCompanyId: invoice.merchantCompanyId,
      ...(invoice.recipientCompanyId
        ? { recipientCompanyId: invoice.recipientCompanyId }
        : { recipientUserId: invoice.recipientUserId ?? undefined }),
      sentAt: { gte: since },
      status: { notIn: ["DRAFT", "CANCELLED", "VOIDED"] },
    },
  });

  if (recentCount >= repeatConfig.count) {
    await sendStaffAuditMessage({
      action: "Repeated merchant invoices to same recipient",
      product: "Alta Pay",
      severity: "WARNING",
      actorName: company.name,
      details: `${recentCount} invoices to same recipient in ${repeatConfig.windowMinutes}m — review for abuse`,
      internalUrl: `/internal/companies`,
      dedupeKey: `merchant-invoice-repeat:${invoice.merchantCompanyId}:${recipientKey}`,
    });
  }
}

export async function alertMerchantInvoicePaymentFailed(
  invoiceId: string,
  failureReason: string,
): Promise<void> {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: { merchantCompany: { select: { name: true } } },
  });
  if (!invoice) return;

  sendStaffAuditMessage({
    action: "Merchant invoice payment failed",
    product: "Alta Pay",
    severity: "WARNING",
    actorName: invoice.merchantCompany.name,
    details: `${invoice.referenceCode}: ${failureReason}`,
    internalUrl: `/bank/invoices/${invoiceId}`,
    dedupeKey: `merchant-invoice-pay-failed:${invoiceId}:${failureReason.slice(0, 40)}`,
  });
}

export async function alertMerchantInvoiceVoided(invoiceId: string, reason: string): Promise<void> {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: { merchantCompany: { select: { name: true } } },
  });
  if (!invoice) return;

  sendStaffAuditMessage({
    action: "Merchant invoice voided",
    product: "Alta Pay",
    severity: "WARNING",
    actorName: invoice.merchantCompany.name,
    details: `${invoice.referenceCode}: ${reason}`,
    internalUrl: `/bank/commercial/invoices/${invoiceId}`,
    dedupeKey: `merchant-invoice-voided:${invoiceId}`,
  });
}
