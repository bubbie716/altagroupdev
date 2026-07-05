import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageMerchantInvoices,
  canViewMerchantInvoices,
  canViewReceivedMerchantInvoice,
} from "@/lib/auth/permissions";
import {
  MERCHANT_INVOICE_REFERENCE_PREFIX,
  type CreateMerchantInvoiceInput,
  type MerchantInvoiceDashboard,
  type MerchantInvoiceDetail,
  type MerchantInvoiceLineItemInput,
  type MerchantInvoiceRecipientOption,
  type MerchantInvoiceSummaryRow,
  type UpdateMerchantInvoiceDraftInput,
  UNPAID_INVOICE_STATUSES,
} from "@/lib/bank/merchant-invoice-types";
import type { MerchantInvoiceStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  appendMerchantInvoiceEvent,
  mapAuditActionToEventType,
  recordMerchantInvoiceSentAudit,
  writeMerchantInvoiceAudit,
} from "@/server/merchant-invoice-audit.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function generateInvoiceReference(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${MERCHANT_INVOICE_REFERENCE_PREFIX}${date}-${suffix}`;
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function assertVerifiedCompanyWithOperatingAccount(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Company must be verified to manage invoices.");
  }
  const operating = company.bankAccounts[0];
  if (!operating) {
    badRequest("Company must have an active Business Operating Account.");
  }
  return { company, operatingAccount: operating };
}

function requireMerchantView(user: AltaUser, companyId: string): void {
  if (!canViewMerchantInvoices(user, { companyId })) forbidden();
}

function requireMerchantManage(user: AltaUser, companyId: string): void {
  if (!canManageMerchantInvoices(user, { companyId })) forbidden();
}

async function resolveInvoiceRecipient(userId: string) {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      bankAccounts: {
        where: { companyId: null, status: "ACTIVE" },
        take: 1,
      },
      bankSettings: {
        include: {
          defaultAltaPayReceiveAccount: true,
        },
      },
    },
  });
  if (!recipient || recipient.accountStatus !== "ACTIVE") {
    badRequest("Recipient must be an active Alta Bank user.");
  }
  const configured = recipient.bankSettings?.defaultAltaPayReceiveAccount;
  const fallback = recipient.bankAccounts[0];
  const receiveAccount =
    configured?.status === "ACTIVE" ? configured : fallback?.status === "ACTIVE" ? fallback : null;
  if (!receiveAccount) {
    badRequest("Recipient must have an active personal Alta Bank account.");
  }
  return recipient;
}

async function resolveInvoiceRecipientCompany(companyId: string, merchantCompanyId: string) {
  if (companyId === merchantCompanyId) {
    badRequest("You cannot send an invoice to your own company.");
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Recipient company must be verified with an active operating account.");
  }
  const operating = company.bankAccounts[0];
  if (!operating) {
    badRequest("Recipient company must have an active Business Operating Account.");
  }
  if (operating.restrictDeposits) {
    badRequest("Recipient company operating account cannot receive payments right now.");
  }
  return company;
}

function parseCreateRecipient(input: CreateMerchantInvoiceInput) {
  const hasUser = !!input.recipientUserId?.trim();
  const hasCompany = !!input.recipientCompanyId?.trim();
  if (hasUser === hasCompany) {
    badRequest("Select a person or company to invoice.");
  }
  return hasUser
    ? ({ kind: "person" as const, userId: input.recipientUserId!.trim() })
    : ({ kind: "company" as const, companyId: input.recipientCompanyId!.trim() });
}

function recipientDisplayName(invoice: {
  recipient: { discordUsername: string; minecraftUsername: string | null } | null;
  recipientCompany: { name: string } | null;
}): string {
  if (invoice.recipientCompany) return invoice.recipientCompany.name;
  if (invoice.recipient) {
    return invoice.recipient.minecraftUsername?.trim() || invoice.recipient.discordUsername;
  }
  return "Unknown recipient";
}

function recipientKindFromInvoice(invoice: {
  recipientUserId: string | null;
  recipientCompanyId: string | null;
}): "person" | "company" {
  return invoice.recipientCompanyId ? "company" : "person";
}

function buildLineItems(
  amount: number,
  description: string,
  lineItems?: MerchantInvoiceLineItemInput[],
) {
  if (lineItems && lineItems.length > 0) {
    return lineItems.map((item, index) => {
      const quantity = item.quantity ?? 1;
      const lineTotal = Math.round(quantity * item.unitAmount * 100) / 100;
      return {
        description: item.description.trim(),
        quantity,
        unitAmount: item.unitAmount,
        lineTotal,
        sortOrder: index,
      };
    });
  }
  return [
    {
      description: description.trim(),
      quantity: 1,
      unitAmount: amount,
      lineTotal: amount,
      sortOrder: 0,
    },
  ];
}

function mapSummary(invoice: {
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
  status: MerchantInvoiceStatus;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  merchantCompany: { name: string };
  recipient: { discordUsername: string; minecraftUsername: string | null } | null;
  recipientCompany: { name: string } | null;
}): MerchantInvoiceSummaryRow {
  return {
    id: invoice.id,
    referenceCode: invoice.referenceCode,
    merchantCompanyId: invoice.merchantCompanyId,
    merchantName: invoice.merchantCompany.name,
    recipientKind: recipientKindFromInvoice(invoice),
    recipientUserId: invoice.recipientUserId,
    recipientCompanyId: invoice.recipientCompanyId,
    recipientName: recipientDisplayName(invoice),
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

const invoiceInclude = {
  merchantCompany: { select: { name: true } },
  recipient: { select: { discordUsername: true, minecraftUsername: true, discordId: true } },
  recipientCompany: { select: { id: true, name: true } },
  lineItems: { orderBy: { sortOrder: "asc" as const } },
  events: { orderBy: { createdAt: "desc" as const }, take: 50 },
  payment: { select: { referenceCode: true } },
} as const;

export async function searchInvoiceRecipients(
  query: string,
  merchantCompanyId?: string,
): Promise<MerchantInvoiceRecipientOption[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const [companies, users] = await Promise.all([
    prisma.company.findMany({
      where: {
        verificationStatus: "VERIFIED",
        ...(merchantCompanyId ? { id: { not: merchantCompanyId } } : {}),
        bankAccounts: {
          some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sector: { contains: q, mode: "insensitive" } },
          { ticker: { contains: q.toUpperCase(), mode: "insensitive" } },
        ],
      },
      include: {
        bankAccounts: {
          where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.user.findMany({
      where: {
        accountStatus: "ACTIVE",
        OR: [
          { discordUsername: { contains: q, mode: "insensitive" } },
          { minecraftUsername: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        discordUsername: true,
        minecraftUsername: true,
        bankAccounts: {
          where: { companyId: null, status: "ACTIVE" },
          take: 1,
          select: { accountName: true, accountNumber: true, status: true },
        },
        bankSettings: {
          select: {
            defaultAltaPayReceiveAccount: {
              select: { accountName: true, accountNumber: true, status: true },
            },
          },
        },
      },
      orderBy: { discordUsername: "asc" },
      take: 10,
    }),
  ]);

  const companyOptions: MerchantInvoiceRecipientOption[] = companies.map((company) => {
    const account = company.bankAccounts[0]!;
    const subtitle = [company.sector, company.ticker].filter(Boolean).join(" · ") || null;
    return {
      kind: "company",
      id: company.id,
      displayName: company.name,
      subtitle,
      canReceive: true,
      destinationLabel: `${account.accountName} · Business Operating Account`,
    };
  });

  const personOptions: MerchantInvoiceRecipientOption[] = users.map((user) => {
    const configured = user.bankSettings?.defaultAltaPayReceiveAccount;
    const oldest = user.bankAccounts[0];
    const receiveAccount =
      configured?.status === "ACTIVE" ? configured : oldest?.status === "ACTIVE" ? oldest : null;
    const canReceive = !!receiveAccount;
    return {
      kind: "person",
      id: user.id,
      displayName: user.minecraftUsername?.trim() || user.discordUsername,
      subtitle: user.discordUsername,
      canReceive,
      destinationLabel: canReceive
        ? `${receiveAccount.accountName} · ${receiveAccount.accountNumber}`
        : "No active personal Alta Bank account",
    };
  });

  return [...companyOptions, ...personOptions].slice(0, 20);
}

export async function createMerchantInvoiceDraft(
  user: AltaUser,
  input: CreateMerchantInvoiceInput,
): Promise<MerchantInvoiceDetail> {
  requireMerchantManage(user, input.companyId);
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (!input.description.trim()) badRequest("Description is required.");

  const { assertCommercialInvoiceLimit } = await import("@/server/commercial-limits.service");
  await assertCommercialInvoiceLimit(input.companyId);

  const { company, operatingAccount } = await assertVerifiedCompanyWithOperatingAccount(
    input.companyId,
  );
  const recipientRef = parseCreateRecipient(input);
  const lineItems = buildLineItems(input.amount, input.description, input.lineItems);
  const referenceCode = generateInvoiceReference();
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  let recipientUserId: string | null = null;
  let recipientCompanyId: string | null = null;

  if (recipientRef.kind === "person") {
    const recipient = await resolveInvoiceRecipient(recipientRef.userId);
    recipientUserId = recipient.id;
  } else {
    const recipientCompany = await resolveInvoiceRecipientCompany(
      recipientRef.companyId,
      company.id,
    );
    recipientCompanyId = recipientCompany.id;
  }

  const invoice = await prisma.merchantInvoice.create({
    data: {
      referenceCode,
      merchantCompanyId: company.id,
      destinationAccountId: operatingAccount.id,
      recipientUserId,
      recipientCompanyId,
      amount: input.amount,
      description: input.description.trim(),
      memo: input.memo?.trim() || null,
      dueDate,
      createdByUserId: user.id,
      lineItems: { create: lineItems },
    },
    include: invoiceInclude,
  });

  await writeMerchantInvoiceAudit({
    actorUserId: user.id,
    action: "MERCHANT_INVOICE_CREATED",
    invoiceId: invoice.id,
    merchantCompanyId: company.id,
    recipientUserId,
    recipientCompanyId,
    amount: input.amount,
    status: invoice.status,
    referenceCode: invoice.referenceCode,
    source: "website",
  });
  await appendMerchantInvoiceEvent({
    invoiceId: invoice.id,
    eventType: "CREATED",
    actorUserId: user.id,
    source: "website",
    metadata: { amount: input.amount, referenceCode: invoice.referenceCode },
  });

  return mapDetail(invoice);
}

export async function updateMerchantInvoiceDraft(
  user: AltaUser,
  input: UpdateMerchantInvoiceDraftInput,
): Promise<MerchantInvoiceDetail> {
  requireMerchantManage(user, input.companyId);
  const existing = await prisma.merchantInvoice.findFirst({
    where: { id: input.invoiceId, merchantCompanyId: input.companyId },
  });
  if (!existing) notFound();
  if (existing.status !== "DRAFT") badRequest("Only draft invoices can be edited.");

  if (input.recipientUserId !== undefined || input.recipientCompanyId !== undefined) {
    const hasUser = !!input.recipientUserId?.trim();
    const hasCompany = !!input.recipientCompanyId?.trim();
    if (hasUser === hasCompany) {
      badRequest("Select a person or company to invoice.");
    }
    if (hasUser) {
      await resolveInvoiceRecipient(input.recipientUserId!.trim());
    } else {
      await resolveInvoiceRecipientCompany(input.recipientCompanyId!.trim(), input.companyId);
    }
  }

  const lineItems =
    input.amount != null || input.lineItems
      ? buildLineItems(
          input.amount ?? decimalToNumber(existing.amount),
          input.description ?? existing.description,
          input.lineItems,
        )
      : null;

  const recipientUpdate =
    input.recipientUserId !== undefined || input.recipientCompanyId !== undefined
      ? {
          recipientUserId: input.recipientUserId?.trim() || null,
          recipientCompanyId: input.recipientCompanyId?.trim() || null,
        }
      : {};

  const invoice = await prisma.$transaction(async (tx) => {
    if (lineItems) {
      await tx.merchantInvoiceLineItem.deleteMany({ where: { invoiceId: existing.id } });
    }
    return tx.merchantInvoice.update({
      where: { id: existing.id },
      data: {
        ...recipientUpdate,
        amount: input.amount,
        description: input.description?.trim(),
        memo: input.memo === undefined ? undefined : input.memo?.trim() || null,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate
              ? new Date(input.dueDate)
              : null,
        ...(lineItems ? { lineItems: { create: lineItems } } : {}),
      },
      include: invoiceInclude,
    });
  });

  await appendMerchantInvoiceEvent({
    invoiceId: invoice.id,
    eventType: "UPDATED",
    actorUserId: user.id,
    source: "website",
  });

  return mapDetail(invoice);
}

export async function sendMerchantInvoice(
  user: AltaUser,
  companyId: string,
  invoiceId: string,
  source = "website",
): Promise<MerchantInvoiceDetail> {
  requireMerchantManage(user, companyId);
  await assertVerifiedCompanyWithOperatingAccount(companyId);

  const invoice = await prisma.merchantInvoice.findFirst({
    where: { id: invoiceId, merchantCompanyId: companyId },
    include: { recipient: { select: { discordId: true } } },
  });
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") badRequest("Only draft invoices can be sent.");

  const now = new Date();
  const updated = await prisma.merchantInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "SENT",
      sentAt: now,
      recipientDiscordId: invoice.recipient?.discordId ?? null,
    },
    include: invoiceInclude,
  });

  await recordMerchantInvoiceSentAudit({
    actorUserId: user.id,
    invoiceId: updated.id,
    merchantCompanyId: updated.merchantCompanyId,
    merchantName: updated.merchantCompany.name,
    recipientUserId: updated.recipientUserId,
    recipientCompanyId: updated.recipientCompanyId,
    recipientName: recipientDisplayName(updated),
    amount: decimalToNumber(updated.amount),
    referenceCode: updated.referenceCode,
    source,
    sentAt: now,
  });

  try {
    const { notifyMerchantInvoiceReceived } = await import(
      "@/server/merchant-invoice-notification.service"
    );
    await notifyMerchantInvoiceReceived(updated.id);
  } catch (error) {
    console.error("[merchant-invoice] received notification failed", error);
  }

  try {
    const { maybeAlertHighValueInvoiceSent } = await import(
      "@/server/merchant-invoice-staff-audit.service"
    );
    await maybeAlertHighValueInvoiceSent(updated);
  } catch (error) {
    console.error("[merchant-invoice] staff alert failed", error);
  }

  try {
    const { tryAutopayAfterInvoiceSent } = await import("@/server/merchant-autopay.service");
    await tryAutopayAfterInvoiceSent(updated.id);
  } catch (error) {
    console.error("[merchant-invoice] autopay attempt failed", error);
  }

  return mapDetail(updated);
}

export async function cancelMerchantInvoice(
  user: AltaUser,
  companyId: string,
  invoiceId: string,
  source = "website",
): Promise<MerchantInvoiceDetail> {
  requireMerchantManage(user, companyId);
  const invoice = await prisma.merchantInvoice.findFirst({
    where: { id: invoiceId, merchantCompanyId: companyId },
  });
  if (!invoice) notFound();
  if (!UNPAID_INVOICE_STATUSES.includes(invoice.status) && invoice.status !== "DRAFT") {
    badRequest("This invoice cannot be cancelled.");
  }

  const updated = await prisma.merchantInvoice.update({
    where: { id: invoice.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: invoiceInclude,
  });

  await writeMerchantInvoiceAudit({
    actorUserId: user.id,
    action: "MERCHANT_INVOICE_CANCELLED",
    invoiceId: updated.id,
    merchantCompanyId: updated.merchantCompanyId,
    recipientUserId: updated.recipientUserId,
    recipientCompanyId: updated.recipientCompanyId,
    amount: decimalToNumber(updated.amount),
    status: updated.status,
    referenceCode: updated.referenceCode,
    source,
  });
  await appendMerchantInvoiceEvent({
    invoiceId: updated.id,
    eventType: "CANCELLED",
    actorUserId: user.id,
    source,
  });

  if (invoice.status !== "DRAFT") {
    try {
      const { notifyMerchantInvoiceCancelled } = await import(
        "@/server/merchant-invoice-notification.service"
      );
      await notifyMerchantInvoiceCancelled(updated.id);
    } catch (error) {
      console.error("[merchant-invoice] cancelled notification failed", error);
    }
  }

  return mapDetail(updated);
}

export async function sendMerchantInvoiceReminder(
  user: AltaUser,
  companyId: string,
  invoiceId: string,
): Promise<MerchantInvoiceDetail> {
  requireMerchantManage(user, companyId);
  const invoice = await prisma.merchantInvoice.findFirst({
    where: { id: invoiceId, merchantCompanyId: companyId },
  });
  if (!invoice) notFound();
  if (!UNPAID_INVOICE_STATUSES.includes(invoice.status)) {
    badRequest("Reminders can only be sent for unpaid invoices.");
  }

  const updated = await prisma.merchantInvoice.update({
    where: { id: invoice.id },
    data: { lastReminderSentAt: new Date() },
    include: invoiceInclude,
  });

  await writeMerchantInvoiceAudit({
    actorUserId: user.id,
    action: "MERCHANT_INVOICE_REMINDER_SENT",
    invoiceId: updated.id,
    merchantCompanyId: updated.merchantCompanyId,
    recipientUserId: updated.recipientUserId,
    recipientCompanyId: updated.recipientCompanyId,
    amount: decimalToNumber(updated.amount),
    status: updated.status,
    referenceCode: updated.referenceCode,
    source: "website",
  });
  await appendMerchantInvoiceEvent({
    invoiceId: updated.id,
    eventType: "REMINDER_SENT",
    actorUserId: user.id,
    source: "website",
  });

  try {
    const { notifyMerchantInvoiceReminder } = await import(
      "@/server/merchant-invoice-notification.service"
    );
    await notifyMerchantInvoiceReminder(updated.id);
  } catch (error) {
    console.error("[merchant-invoice] reminder notification failed", error);
  }

  return mapDetail(updated);
}

export async function markMerchantInvoiceViewed(
  user: AltaUser,
  invoiceId: string,
  source = "website",
): Promise<MerchantInvoiceDetail | null> {
  const invoice = await prisma.merchantInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) notFound();
  if (!canViewReceivedMerchantInvoice(user, invoice)) forbidden();
  if (invoice.viewedAt) {
    return getCustomerInvoice(user, invoiceId);
  }
  if (!["SENT", "OVERDUE"].includes(invoice.status)) {
    return getCustomerInvoice(user, invoiceId);
  }

  const now = new Date();
  const updated = await prisma.merchantInvoice.update({
    where: { id: invoice.id },
    data: {
      status: invoice.status === "SENT" ? "VIEWED" : invoice.status,
      viewedAt: now,
    },
    include: invoiceInclude,
  });

  await writeMerchantInvoiceAudit({
    actorUserId: user.id,
    action: "MERCHANT_INVOICE_VIEWED",
    invoiceId: updated.id,
    merchantCompanyId: updated.merchantCompanyId,
    recipientUserId: updated.recipientUserId,
    recipientCompanyId: updated.recipientCompanyId,
    amount: decimalToNumber(updated.amount),
    status: updated.status,
    referenceCode: updated.referenceCode,
    source,
  });
  await appendMerchantInvoiceEvent({
    invoiceId: updated.id,
    eventType: "VIEWED",
    actorUserId: user.id,
    source,
  });

  return mapDetail(updated);
}

export async function getMerchantInvoiceDashboard(
  user: AltaUser,
  companyId: string,
): Promise<MerchantInvoiceDashboard> {
  requireMerchantView(user, companyId);
  const monthStart = startOfUtcMonth();

  const [outstanding, paidThisMonth, overdueCount, recent] = await Promise.all([
    prisma.merchantInvoice.aggregate({
      where: {
        merchantCompanyId: companyId,
        status: { in: UNPAID_INVOICE_STATUSES },
      },
      _sum: { amount: true },
    }),
    prisma.merchantInvoice.aggregate({
      where: {
        merchantCompanyId: companyId,
        status: "PAID",
        paidAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.merchantInvoice.count({
      where: { merchantCompanyId: companyId, status: "OVERDUE" },
    }),
    prisma.merchantInvoice.findMany({
      where: { merchantCompanyId: companyId },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    outstandingTotal: decimalToNumber(outstanding._sum.amount ?? { toString: () => "0" }),
    paidThisMonth: decimalToNumber(paidThisMonth._sum.amount ?? { toString: () => "0" }),
    overdueCount,
    recent: recent.map(mapSummary),
  };
}

export async function listMerchantInvoices(
  user: AltaUser,
  companyId: string,
  status?: MerchantInvoiceStatus,
): Promise<MerchantInvoiceSummaryRow[]> {
  requireMerchantView(user, companyId);
  const invoices = await prisma.merchantInvoice.findMany({
    where: {
      merchantCompanyId: companyId,
      ...(status ? { status } : {}),
    },
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return invoices.map(mapSummary);
}

export async function getMerchantInvoiceDetail(
  user: AltaUser,
  companyId: string,
  invoiceId: string,
): Promise<MerchantInvoiceDetail> {
  requireMerchantView(user, companyId);
  const invoice = await prisma.merchantInvoice.findFirst({
    where: { id: invoiceId, merchantCompanyId: companyId },
    include: invoiceInclude,
  });
  if (!invoice) notFound();
  return mapDetail(invoice);
}

export async function listReceivedInvoices(user: AltaUser): Promise<MerchantInvoiceSummaryRow[]> {
  const companyIds = user.companyMemberships
    .filter((membership) => canViewMerchantInvoices(user, { companyId: membership.companyId }))
    .map((membership) => membership.companyId);

  const invoices = await prisma.merchantInvoice.findMany({
    where: {
      status: { not: "DRAFT" },
      OR: [
        { recipientUserId: user.id },
        ...(companyIds.length > 0 ? [{ recipientCompanyId: { in: companyIds } }] : []),
      ],
    },
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return invoices.map(mapSummary);
}

export async function getCustomerInvoice(
  user: AltaUser,
  invoiceId: string,
): Promise<MerchantInvoiceDetail> {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });
  if (!invoice || invoice.status === "DRAFT") notFound();
  if (!canViewReceivedMerchantInvoice(user, invoice)) forbidden();
  return mapDetail(invoice);
}

function mapDetail(invoice: {
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
  status: MerchantInvoiceStatus;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  merchantCompany: { name: string };
  recipient: { discordUsername: string; minecraftUsername: string | null } | null;
  recipientCompany: { name: string } | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: { toString(): string };
    unitAmount: { toString(): string };
    lineTotal: { toString(): string };
    sortOrder: number;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorUserId: string | null;
    source: string;
    metadata: unknown;
    createdAt: Date;
  }>;
  payment: { referenceCode: string } | null;
}): MerchantInvoiceDetail {
  return {
    ...mapSummary(invoice),
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: decimalToNumber(item.quantity),
      unitAmount: decimalToNumber(item.unitAmount),
      lineTotal: decimalToNumber(item.lineTotal),
      sortOrder: item.sortOrder,
    })),
    events: invoice.events.map((event) => ({
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
    paymentReferenceCode: invoice.payment?.referenceCode ?? null,
  };
}

export { mapAuditActionToEventType };
