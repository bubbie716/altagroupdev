import { prisma } from "@/server/db";
import { scheduleCreateUserNotification } from "@/server/notification.service";

const MERCHANT_NOTIFY_ROLES = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] as const;

async function listMerchantFinanceUserIds(companyId: string): Promise<string[]> {
  const memberships = await prisma.companyMembership.findMany({
    where: {
      companyId,
      role: { in: [...MERCHANT_NOTIFY_ROLES] },
    },
    select: { userId: true },
  });
  return [...new Set(memberships.map((m) => m.userId))];
}

export async function notifyPaymentLinkPaid(input: {
  paymentLinkId: string;
  paymentId: string;
  payerUserId: string;
  amount: number;
}): Promise<void> {
  const link = await prisma.paymentLink.findUnique({
    where: { id: input.paymentLinkId },
    include: {
      merchantCompany: { select: { id: true, name: true } },
      payments: {
        where: { paymentId: input.paymentId },
        take: 1,
        include: {
          payment: { select: { referenceCode: true } },
        },
      },
    },
  });
  if (!link) return;

  const paymentRef = link.payments[0]?.payment?.referenceCode ?? "Payment";
  const amountLabel = `ƒ${input.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const merchantUserIds = await listMerchantFinanceUserIds(link.merchantCompanyId);
  for (const userId of merchantUserIds) {
    scheduleCreateUserNotification({
      userId,
      type: "PAYMENT_LINK_PAID",
      title: "Payment link paid",
      body: `${amountLabel} received via ${link.referenceCode}`,
      linkUrl: `/bank/commercial/payment-links/${link.id}?companyId=${link.merchantCompanyId}`,
    });
  }

  scheduleCreateUserNotification({
    userId: input.payerUserId,
    type: "PAYMENT_LINK_RECEIPT",
    title: "Payment receipt",
    body: `You paid ${amountLabel} to ${link.merchantCompany.name} · Ref ${paymentRef}`,
    linkUrl: `/pay/${link.slug}`,
  });
}
