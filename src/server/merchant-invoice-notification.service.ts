import { formatFlorin } from "@/lib/bank/format";
import { buildNotificationDmPayload, resolvePublicLinkUrl } from "@/lib/discord/notification-dm";
import { prisma } from "@/server/db";
import { createUserNotification } from "@/server/notification.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function formatDueDate(dueDate: Date | null): string {
  if (!dueDate) return "No due date";
  return dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function invoiceUrl(invoiceId: string): string {
  return `/bank/invoices/${invoiceId}`;
}

async function loadInvoiceNotificationContext(invoiceId: string) {
  return prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      merchantCompany: { select: { id: true, name: true } },
      recipient: { select: { id: true, discordUsername: true, minecraftUsername: true } },
      recipientCompany: { select: { id: true, name: true } },
    },
  });
}

async function listRecipientNotifyUserIds(invoice: {
  recipientUserId: string | null;
  recipientCompanyId: string | null;
}): Promise<string[]> {
  if (invoice.recipientUserId) return [invoice.recipientUserId];
  if (!invoice.recipientCompanyId) return [];

  const memberships = await prisma.companyMembership.findMany({
    where: {
      companyId: invoice.recipientCompanyId,
      role: { in: ["OWNER", "EXECUTIVE", "FINANCE_MANAGER", "COMPLIANCE_CONTACT"] },
    },
    select: { userId: true },
  });
  return memberships.map((member) => member.userId);
}

function recipientLabel(invoice: {
  recipient: { discordUsername: string; minecraftUsername: string | null } | null;
  recipientCompany: { name: string } | null;
}): string {
  if (invoice.recipientCompany) return invoice.recipientCompany.name;
  if (invoice.recipient) {
    return invoice.recipient.minecraftUsername?.trim() || invoice.recipient.discordUsername;
  }
  return "Recipient";
}

export async function buildMerchantInvoiceReceivedDmPayload(invoiceId: string) {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return null;

  const amount = formatFlorin(decimalToNumber(invoice.amount));
  const due = formatDueDate(invoice.dueDate);
  const description = invoice.description.trim().slice(0, 1024);
  const billTo = invoice.recipientCompany?.name ?? null;
  const recurring = invoice.isRecurring;
  const viewInvoiceUrl = resolvePublicLinkUrl(invoiceUrl(invoiceId));

  return {
    embed: {
      title: recurring ? "Recurring invoice received" : "Invoice received",
      description: `Reference \`${invoice.referenceCode}\`${recurring ? " · Recurring" : ""}`,
      color: 0x0f1729,
      fields: [
        { name: "Merchant", value: invoice.merchantCompany.name, inline: true },
        ...(billTo ? [{ name: "Bill to", value: billTo, inline: true }] : []),
        { name: "Amount", value: amount, inline: true },
        { name: "Due", value: due, inline: true },
        { name: "Description", value: description || "—", inline: false },
      ],
      footer: { text: "Alta Bank · Newport" },
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "View Invoice",
            url: viewInvoiceUrl,
          },
          {
            type: 2,
            style: 1,
            label: "Pay Now",
            custom_id: `invoice:pay:${invoiceId}`,
          },
        ],
      },
    ],
  };
}

export async function notifyMerchantInvoiceReceived(invoiceId: string): Promise<void> {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return;

  const customDmPayload = await buildMerchantInvoiceReceivedDmPayload(invoiceId);
  const amount = decimalToNumber(invoice.amount);
  const notifyUserIds = await listRecipientNotifyUserIds(invoice);
  const title = invoice.isRecurring ? "Recurring invoice received" : "Invoice received";
  const recurringHint = invoice.isRecurring ? " (recurring)" : "";

  for (const userId of notifyUserIds) {
    await createUserNotification({
      userId,
      type: "MERCHANT_INVOICE_RECEIVED",
      title,
      body: `${invoice.merchantCompany.name} sent ${invoice.recipientCompany ? `${invoice.recipientCompany.name} ` : ""}an invoice${recurringHint} for ${formatFlorin(amount)}. Reference \`${invoice.referenceCode}\`. Due ${formatDueDate(invoice.dueDate)}.`,
      linkUrl: invoiceUrl(invoiceId),
      metadata: {
        invoiceId,
        merchantCompanyId: invoice.merchantCompanyId,
        recipientCompanyId: invoice.recipientCompanyId,
        amount,
        referenceCode: invoice.referenceCode,
      },
      customDmPayload: customDmPayload ?? undefined,
    });
  }
}

export async function notifyMerchantInvoiceReminder(invoiceId: string): Promise<void> {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return;

  const amount = decimalToNumber(invoice.amount);
  const overdue = invoice.status === "OVERDUE";
  const notifyUserIds = await listRecipientNotifyUserIds(invoice);

  for (const userId of notifyUserIds) {
    await createUserNotification({
      userId,
      type: "MERCHANT_INVOICE_REMINDER",
      title: overdue ? "Invoice overdue" : "Invoice reminder",
      body: overdue
        ? `Your invoice from ${invoice.merchantCompany.name} for ${formatFlorin(amount)} is overdue. Reference \`${invoice.referenceCode}\`.`
        : `Reminder: ${invoice.merchantCompany.name} is awaiting payment of ${formatFlorin(amount)}. Reference \`${invoice.referenceCode}\`.`,
      linkUrl: invoiceUrl(invoiceId),
      metadata: { invoiceId, amount, referenceCode: invoice.referenceCode },
    });
  }
}

export async function notifyMerchantInvoicePaid(
  invoiceId: string,
  paymentId: string,
  options?: { autopay?: boolean },
): Promise<void> {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      merchantCompany: { select: { id: true, name: true } },
      recipient: { select: { id: true, discordUsername: true, minecraftUsername: true } },
      recipientCompany: { select: { id: true, name: true } },
      payment: { select: { referenceCode: true } },
    },
  });
  if (!invoice) return;

  const amount = decimalToNumber(invoice.amount);
  const payerName = recipientLabel(invoice);
  const paymentRef = invoice.payment?.referenceCode ?? paymentId;
  const notifyUserIds = await listRecipientNotifyUserIds(invoice);

  if (!options?.autopay) {
    for (const userId of notifyUserIds) {
      await createUserNotification({
        userId,
        type: "MERCHANT_INVOICE_PAID",
        title: "Invoice paid",
        body: `You paid ${formatFlorin(amount)} to ${invoice.merchantCompany.name}. Reference \`${paymentRef}\`.`,
        linkUrl: invoiceUrl(invoiceId),
        metadata: { invoiceId, amount, paymentReferenceCode: paymentRef },
      });
    }
  }

  const memberships = await prisma.companyMembership.findMany({
    where: {
      companyId: invoice.merchantCompanyId,
      role: { in: ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] },
    },
    select: { userId: true },
  });

  for (const member of memberships) {
    await createUserNotification({
      userId: member.userId,
      type: "MERCHANT_INVOICE_PAID",
      title: options?.autopay ? "Invoice paid via AutoPay" : "Invoice paid",
      body: options?.autopay
        ? `${payerName} paid invoice \`${invoice.referenceCode}\` for ${formatFlorin(amount)} via AutoPay.`
        : `${payerName} paid invoice \`${invoice.referenceCode}\` for ${formatFlorin(amount)}.`,
      linkUrl: `/bank/commercial/invoices/${invoiceId}?companyId=${invoice.merchantCompanyId}`,
      metadata: {
        invoiceId,
        amount,
        payerName,
        referenceCode: invoice.referenceCode,
        autopay: options?.autopay ?? false,
      },
    });
  }
}

export async function notifyMerchantInvoiceCancelled(invoiceId: string): Promise<void> {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return;

  const amount = decimalToNumber(invoice.amount);
  const notifyUserIds = await listRecipientNotifyUserIds(invoice);

  for (const userId of notifyUserIds) {
    await createUserNotification({
      userId,
      type: "MERCHANT_INVOICE_CANCELLED",
      title: "Invoice cancelled",
      body: `${invoice.merchantCompany.name} cancelled invoice \`${invoice.referenceCode}\` for ${formatFlorin(amount)}.`,
      linkUrl: invoiceUrl(invoiceId),
      metadata: { invoiceId, referenceCode: invoice.referenceCode },
    });
  }
}

export async function notifyMerchantInvoiceOverdue(invoiceId: string): Promise<void> {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return;

  const amount = decimalToNumber(invoice.amount);
  const notifyUserIds = await listRecipientNotifyUserIds(invoice);
  const recipientName = recipientLabel(invoice);

  for (const userId of notifyUserIds) {
    await createUserNotification({
      userId,
      type: "MERCHANT_INVOICE_REMINDER",
      title: "Invoice overdue",
      body: `Your invoice from ${invoice.merchantCompany.name} for ${formatFlorin(amount)} is now overdue.`,
      linkUrl: invoiceUrl(invoiceId),
      metadata: { invoiceId, status: "OVERDUE" },
    });
  }

  const memberships = await prisma.companyMembership.findMany({
    where: {
      companyId: invoice.merchantCompanyId,
      role: { in: ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] },
    },
    select: { userId: true },
  });

  for (const member of memberships) {
    await createUserNotification({
      userId: member.userId,
      type: "MERCHANT_INVOICE_OVERDUE",
      title: "Invoice overdue",
      body: `Invoice \`${invoice.referenceCode}\` to ${recipientName} is overdue (${formatFlorin(amount)}).`,
      linkUrl: `/bank/commercial/invoices/${invoiceId}?companyId=${invoice.merchantCompanyId}`,
      metadata: { invoiceId, amount },
    });
  }
}

export { buildNotificationDmPayload };

export async function buildAutopayConfirmationDmPayload(invoiceId: string) {
  const invoice = await loadInvoiceNotificationContext(invoiceId);
  if (!invoice) return null;

  const amount = formatFlorin(decimalToNumber(invoice.amount));
  const invoiceLink = resolvePublicLinkUrl(invoiceUrl(invoiceId));
  const payLink = invoiceLink;

  return {
    embed: {
      title: "AutoPay confirmation required",
      description: `${invoice.merchantCompany.name} invoice \`${invoice.referenceCode}\` for ${amount} requires your confirmation before AutoPay can run.`,
      color: 0x0f1729,
      footer: { text: "Alta Bank · Newport" },
    },
    components: [
      {
        type: 1,
        components: [
          ...(invoiceLink
            ? [
                {
                  type: 2,
                  style: 5,
                  label: "Review Invoice",
                  url: invoiceLink,
                },
              ]
            : []),
          ...(payLink
            ? [
                {
                  type: 2,
                  style: 5,
                  label: "Pay Manually",
                  url: payLink,
                },
              ]
            : []),
        ],
      },
    ],
  };
}
