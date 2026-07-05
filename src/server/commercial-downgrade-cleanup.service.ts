import type { MerchantInvoiceStatus, PaymentLinkStatus } from "@prisma/client";
import type {
  CommercialDowngradeCleanupPreview,
} from "@/lib/bank/commercial-billing-types";
import { prisma } from "@/server/db";
import { startOfUtcMonth } from "@/server/commercial-limits.service";
import { getCommercialPlatformSettings } from "@/server/commercial-platform-settings.service";
import {
  appendMerchantInvoiceEvent,
  writeMerchantInvoiceAudit,
} from "@/server/merchant-invoice-audit.service";
import {
  appendPaymentLinkEvent,
  writePaymentLinkAudit,
} from "@/server/payment-link-audit.service";
import { parsePayrollLineItems } from "@/server/business-banking-mapper";

const CANCELLABLE_PAYMENT_LINK_STATUSES: PaymentLinkStatus[] = ["ACTIVE", "PAUSED"];

const CANCELLABLE_INVOICE_STATUSES: MerchantInvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "OVERDUE",
  "PARTIALLY_PAID",
];

const CANCELLABLE_PAYROLL_RUN_STATUSES = ["PENDING_REVIEW", "APPROVED", "FAILED"] as const;

export type CommercialDowngradeCleanupResult = CommercialDowngradeCleanupPreview;

/** Counts receivables and payroll that would be trimmed when Pro ends. */
export async function previewCommercialCoreDowngradeCleanup(
  companyId: string,
): Promise<CommercialDowngradeCleanupResult> {
  const limits = await getCommercialPlatformSettings();
  const monthStart = startOfUtcMonth();

  const [payrollRuns, activePayrollEmployees, links, invoices] = await Promise.all([
    prisma.payrollRun.findMany({
      where: {
        companyId,
        status: { in: [...CANCELLABLE_PAYROLL_RUN_STATUSES] },
      },
      orderBy: [{ payDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        payDate: true,
        status: true,
        totalAmount: true,
        lineItems: true,
        bankAccount: {
          select: {
            accountName: true,
            accountNumber: true,
          },
        },
      },
    }),
    prisma.payrollEmployee.findMany({
      where: {
        companyId,
        status: "ACTIVE",
      },
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        displayName: true,
        accountNumber: true,
        payAmount: true,
        nextPayDate: true,
      },
    }),
    prisma.paymentLink.findMany({
      where: {
        merchantCompanyId: companyId,
        createdAt: { gte: monthStart },
        status: { in: CANCELLABLE_PAYMENT_LINK_STATUSES },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.merchantInvoice.findMany({
      where: {
        merchantCompanyId: companyId,
        createdAt: { gte: monthStart },
        status: { in: CANCELLABLE_INVOICE_STATUSES },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  return {
    payrollRunsCancelled: payrollRuns.length,
    paymentLinksCancelled: selectExcessRowIds(links, limits.corePaymentLinkMonthlyLimit).length,
    invoicesCancelled: selectExcessRowIds(invoices, limits.coreInvoiceMonthlyLimit).length,
    payrollRuns: payrollRuns.map((run) => ({
      id: run.id,
      label: run.label,
      payDate: run.payDate.toISOString(),
      status: run.status,
      totalAmount: Number(run.totalAmount.toString()),
      sourceAccountName: run.bankAccount.accountName,
      sourceAccountNumber: run.bankAccount.accountNumber,
      payouts: parsePayrollLineItems(run.lineItems),
    })),
    activePayrollEmployees: activePayrollEmployees.map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      accountNumber: employee.accountNumber,
      payAmount: Number(employee.payAmount.toString()),
      nextPayDate: employee.nextPayDate?.toISOString() ?? null,
    })),
  };
}

export function selectExcessRowIds<T extends { id: string }>(
  rows: T[],
  limit: number,
): string[] {
  if (rows.length <= limit) return [];
  return rows.slice(limit).map((row) => row.id);
}

async function cancelPendingPayrollRuns(companyId: string): Promise<number> {
  const pending = await prisma.payrollRun.findMany({
    where: {
      companyId,
      status: { in: [...CANCELLABLE_PAYROLL_RUN_STATUSES] },
    },
    select: { id: true },
  });
  if (pending.length === 0) return 0;

  const now = new Date();
  await prisma.payrollRun.updateMany({
    where: { id: { in: pending.map((row) => row.id) } },
    data: {
      status: "CANCELLED",
      lastFailureReason: "Cancelled because Alta Commercial Pro ended.",
    },
  });

  await prisma.payrollRunExecution.updateMany({
    where: {
      payrollRunId: { in: pending.map((row) => row.id) },
      status: "PENDING",
    },
    data: {
      status: "SKIPPED",
      failureReason: "Cancelled because Alta Commercial Pro ended.",
      executedAt: now,
    },
  });

  return pending.length;
}

async function cancelPaymentLinkForDowngrade(
  link: {
    id: string;
    merchantCompanyId: string;
    slug: string;
    referenceCode: string;
  },
  actorUserId: string,
  source: string,
): Promise<void> {
  await prisma.paymentLink.update({
    where: { id: link.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await writePaymentLinkAudit({
    actorUserId,
    action: "PAYMENT_LINK_CANCELLED",
    paymentLinkId: link.id,
    merchantCompanyId: link.merchantCompanyId,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: "CANCELLED",
    actorUserId,
    source,
  });
}

async function cancelInvoiceForDowngrade(
  invoice: {
    id: string;
    merchantCompanyId: string;
    recipientUserId: string | null;
    recipientCompanyId: string | null;
    amount: { toString(): string };
    status: MerchantInvoiceStatus;
    referenceCode: string;
  },
  actorUserId: string,
  source: string,
): Promise<void> {
  const previousStatus = invoice.status;
  const updated = await prisma.merchantInvoice.update({
    where: { id: invoice.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await writeMerchantInvoiceAudit({
    actorUserId,
    action: "MERCHANT_INVOICE_CANCELLED",
    invoiceId: updated.id,
    merchantCompanyId: updated.merchantCompanyId,
    recipientUserId: updated.recipientUserId,
    recipientCompanyId: updated.recipientCompanyId,
    amount: Number(invoice.amount.toString()),
    status: updated.status,
    referenceCode: updated.referenceCode,
    source,
  });
  await appendMerchantInvoiceEvent({
    invoiceId: updated.id,
    eventType: "CANCELLED",
    actorUserId,
    source,
  });

  if (previousStatus !== "DRAFT") {
    try {
      const { notifyMerchantInvoiceCancelled } = await import(
        "@/server/merchant-invoice-notification.service"
      );
      await notifyMerchantInvoiceCancelled(updated.id);
    } catch (error) {
      console.error("[commercial-downgrade] invoice cancelled notification failed", error);
    }
  }
}

async function cancelExcessPaymentLinks(
  companyId: string,
  actorUserId: string,
  source: string,
  limit: number,
): Promise<number> {
  const monthStart = startOfUtcMonth();
  const links = await prisma.paymentLink.findMany({
    where: {
      merchantCompanyId: companyId,
      createdAt: { gte: monthStart },
      status: { in: CANCELLABLE_PAYMENT_LINK_STATUSES },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      merchantCompanyId: true,
      slug: true,
      referenceCode: true,
    },
  });

  const excessIds = selectExcessRowIds(links, limit);
  for (const link of links.filter((row) => excessIds.includes(row.id))) {
    await cancelPaymentLinkForDowngrade(link, actorUserId, source);
  }
  return excessIds.length;
}

async function cancelExcessInvoices(
  companyId: string,
  actorUserId: string,
  source: string,
  limit: number,
): Promise<number> {
  const monthStart = startOfUtcMonth();
  const invoices = await prisma.merchantInvoice.findMany({
    where: {
      merchantCompanyId: companyId,
      createdAt: { gte: monthStart },
      status: { in: CANCELLABLE_INVOICE_STATUSES },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      merchantCompanyId: true,
      recipientUserId: true,
      recipientCompanyId: true,
      amount: true,
      status: true,
      referenceCode: true,
    },
  });

  const excessIds = selectExcessRowIds(invoices, limit);
  for (const invoice of invoices.filter((row) => excessIds.includes(row.id))) {
    await cancelInvoiceForDowngrade(invoice, actorUserId, source);
  }
  return excessIds.length;
}

/** Stops pending payroll and trims receivables to Core limits when Pro ends. */
export async function applyCommercialCoreDowngradeCleanup(
  companyId: string,
  actorUserId: string,
  source: string,
): Promise<CommercialDowngradeCleanupResult> {
  const limits = await getCommercialPlatformSettings();

  const [payrollRunsCancelled, paymentLinksCancelled, invoicesCancelled] = await Promise.all([
    cancelPendingPayrollRuns(companyId),
    cancelExcessPaymentLinks(companyId, actorUserId, source, limits.corePaymentLinkMonthlyLimit),
    cancelExcessInvoices(companyId, actorUserId, source, limits.coreInvoiceMonthlyLimit),
  ]);

  return {
    payrollRunsCancelled,
    paymentLinksCancelled,
    invoicesCancelled,
  };
}
