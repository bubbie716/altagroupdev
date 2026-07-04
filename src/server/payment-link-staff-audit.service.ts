import { prisma } from "@/server/db";
import { sendStaffAuditMessage } from "@/server/staff-audit-notification.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

async function readStaffAlertThreshold(): Promise<number | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "payment_link.staff_alert_threshold" },
  });
  if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
    return null;
  }
  const enabled = (setting.value as { enabled?: boolean }).enabled;
  const amount = Number((setting.value as { amount?: number }).amount);
  if (enabled === false || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export async function maybeAlertHighValuePaymentLinkPaid(input: {
  paymentLinkId: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantName: string;
  amount: number;
}): Promise<void> {
  const threshold = await readStaffAlertThreshold();
  if (threshold == null || input.amount < threshold) return;

  sendStaffAuditMessage({
    action: "High-value payment link payment",
    product: "Alta Bank",
    severity: "ACTION",
    actorName: input.merchantName,
    details: `Link ${input.referenceCode} paid · ƒ${input.amount.toLocaleString()}`,
    internalUrl: `/bank/commercial/payment-links/${input.paymentLinkId}`,
    dedupeKey: `payment-link-high-value:${input.paymentLinkId}:${input.amount}`,
  });
}

export async function alertPaymentLinkPaymentFailed(
  paymentLinkId: string,
  referenceCode: string,
  merchantName: string,
  failureReason: string,
): Promise<void> {
  sendStaffAuditMessage({
    action: "Payment link payment failed",
    product: "Alta Bank",
    severity: "WARNING",
    actorName: merchantName,
    details: `${referenceCode}: ${failureReason}`,
    internalUrl: `/bank/commercial/payment-links/${paymentLinkId}`,
    dedupeKey: `payment-link-pay-failed:${paymentLinkId}:${failureReason.slice(0, 40)}`,
  });
}

export { decimalToNumber as paymentLinkDecimalToNumber };
