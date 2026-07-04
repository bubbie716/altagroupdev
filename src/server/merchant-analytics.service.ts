import type { AltaUser } from "@/lib/auth/types";
import type {
  BasicMerchantAnalytics,
  CommercialDashboard,
  CommercialMerchantActivityRow,
  MerchantAnalytics,
  MerchantAnalyticsRange,
  MerchantAnalyticsRecentPayment,
  MerchantAnalyticsTopCustomer,
  MerchantAnalyticsTrendPoint,
} from "@/lib/bank/commercial-banking-types";
import { UNPAID_INVOICE_STATUSES } from "@/lib/bank/merchant-invoice-types";
import { prisma } from "@/server/db";
import {
  assertAdvancedMerchantAnalyticsAccess,
  assertBasicMerchantAnalyticsAccess,
} from "@/server/commercial-plan.service";
import { getMerchantInvoiceDashboard } from "@/server/merchant-invoice.service";
import { getPaymentLinkDashboard } from "@/server/payment-link.service";

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function resolveAnalyticsRangeStart(range: MerchantAnalyticsRange): Date | null {
  const now = new Date();
  switch (range) {
    case "7D":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30D":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90D":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "YTD":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    case "ALL":
      return null;
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function completedAtFilter(start: Date | null) {
  return start ? { gte: start } : undefined;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getCommercialDashboard(
  user: AltaUser,
  companyId: string,
): Promise<CommercialDashboard> {
  const { resolveCommercialBankingContext } = await import("@/server/commercial-plan.service");
  const ctx = await resolveCommercialBankingContext(user, companyId);
  if (!ctx.isVerified || !ctx.accountId) {
    throw new Error("BAD_REQUEST:Company verification required for Alta Commercial.");
  }

  const [operating, invoiceDashboard, paymentLinkDashboard, recentInvoices, recentLinks, recentInvoicePayments, recentLinkPayments] =
    await Promise.all([
      prisma.bankAccount.findUnique({ where: { id: ctx.accountId } }),
      getMerchantInvoiceDashboard(user, companyId),
      getPaymentLinkDashboard(user, companyId),
      prisma.merchantInvoice.findMany({
        where: { merchantCompanyId: companyId },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          referenceCode: true,
          amount: true,
          status: true,
          createdAt: true,
          description: true,
        },
      }),
      prisma.paymentLink.findMany({
        where: { merchantCompanyId: companyId },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          referenceCode: true,
          amount: true,
          status: true,
          createdAt: true,
          description: true,
        },
      }),
      prisma.merchantInvoicePayment.findMany({
        where: {
          status: "COMPLETED",
          invoice: { merchantCompanyId: companyId },
        },
        orderBy: { completedAt: "desc" },
        take: 6,
        include: {
          invoice: { select: { referenceCode: true } },
          initiatedBy: { select: { discordUsername: true, minecraftUsername: true } },
        },
      }),
      prisma.paymentLinkPayment.findMany({
        where: {
          status: "COMPLETED",
          paymentLink: { merchantCompanyId: companyId },
        },
        orderBy: { completedAt: "desc" },
        take: 6,
        include: {
          paymentLink: { select: { referenceCode: true } },
        },
      }),
    ]);

  const monthStart = startOfUtcMonth();
  const paymentLinkVolumeAgg = await prisma.paymentLinkPayment.aggregate({
    where: {
      status: "COMPLETED",
      completedAt: { gte: monthStart },
      paymentLink: { merchantCompanyId: companyId },
    },
    _sum: { amount: true },
  });

  const overdueAgg = await prisma.merchantInvoice.aggregate({
    where: { merchantCompanyId: companyId, status: "OVERDUE" },
    _sum: { amount: true },
  });

  const activity: CommercialMerchantActivityRow[] = [
    ...recentInvoices.map((row) => ({
      id: row.id,
      kind: "invoice" as const,
      label: row.description,
      amount: decimalToNumber(row.amount),
      status: row.status,
      referenceCode: row.referenceCode,
      createdAt: row.createdAt.toISOString(),
    })),
    ...recentLinks.map((row) => ({
      id: row.id,
      kind: "payment_link" as const,
      label: row.description,
      amount: row.amount != null ? decimalToNumber(row.amount) : null,
      status: row.status,
      referenceCode: row.referenceCode,
      createdAt: row.createdAt.toISOString(),
    })),
    ...recentInvoicePayments.map((row) => ({
      id: row.id,
      kind: "invoice_payment" as const,
      label:
        row.initiatedBy.minecraftUsername?.trim() ||
        row.initiatedBy.discordUsername ||
        "Customer",
      amount: decimalToNumber(row.amount),
      status: row.status,
      referenceCode: row.invoice.referenceCode,
      createdAt: (row.completedAt ?? row.createdAt).toISOString(),
    })),
    ...recentLinkPayments.map((row) => ({
      id: row.id,
      kind: "link_payment" as const,
      label: row.payerLabel ?? "Customer",
      amount: decimalToNumber(row.amount),
      status: row.status,
      referenceCode: row.paymentLink.referenceCode,
      createdAt: (row.completedAt ?? row.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return {
    cashBalance: decimalToNumber(operating?.balance),
    outstandingInvoices: invoiceDashboard.outstandingTotal,
    paidThisMonth: invoiceDashboard.paidThisMonth,
    paymentLinkVolume: decimalToNumber(paymentLinkVolumeAgg._sum.amount),
    overdueInvoiceTotal: decimalToNumber(overdueAgg._sum.amount),
    recentActivity: activity,
    invoiceDashboard: {
      outstandingTotal: invoiceDashboard.outstandingTotal,
      paidThisMonth: invoiceDashboard.paidThisMonth,
      overdueCount: invoiceDashboard.overdueCount,
    },
    paymentLinkDashboard: {
      activeCount: paymentLinkDashboard.activeCount,
      totalCollected: paymentLinkDashboard.totalCollected,
      paymentCount: paymentLinkDashboard.paymentCount,
    },
  };
}

export async function getBasicMerchantAnalytics(
  user: AltaUser,
  companyId: string,
): Promise<BasicMerchantAnalytics> {
  await assertBasicMerchantAnalyticsAccess(user, companyId);
  const monthStart = startOfUtcMonth();

  const [invoicePayments, linkPayments, outstandingAgg] = await Promise.all([
    prisma.merchantInvoicePayment.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: monthStart },
        invoice: { merchantCompanyId: companyId },
      },
      include: {
        invoice: { select: { referenceCode: true } },
        initiatedBy: { select: { discordUsername: true, minecraftUsername: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 8,
    }),
    prisma.paymentLinkPayment.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: monthStart },
        paymentLink: { merchantCompanyId: companyId },
      },
      include: {
        paymentLink: { select: { referenceCode: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 8,
    }),
    prisma.merchantInvoice.aggregate({
      where: {
        merchantCompanyId: companyId,
        status: { in: UNPAID_INVOICE_STATUSES },
      },
      _sum: { amount: true },
    }),
  ]);

  const invoiceRevenue = invoicePayments.reduce(
    (sum, row) => sum + decimalToNumber(row.amount),
    0,
  );
  const linkRevenue = linkPayments.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);

  const recentPayments: MerchantAnalyticsRecentPayment[] = [
    ...invoicePayments.map((row) => ({
      id: row.id,
      source: "invoice" as const,
      customerLabel:
        row.initiatedBy.minecraftUsername?.trim() ||
        row.initiatedBy.discordUsername ||
        "Customer",
      grossAmount: decimalToNumber(row.amount),
      netAmount: decimalToNumber(row.amount) - decimalToNumber(row.feeAmount),
      feeAmount: decimalToNumber(row.feeAmount),
      referenceCode: row.invoice.referenceCode,
      createdAt: row.completedAt?.toISOString() ?? row.createdAt.toISOString(),
    })),
    ...linkPayments.map((row) => ({
      id: row.id,
      source: "payment_link" as const,
      customerLabel: row.payerLabel ?? "Customer",
      grossAmount: decimalToNumber(row.amount),
      netAmount: decimalToNumber(row.amount) - decimalToNumber(row.feeAmount),
      feeAmount: decimalToNumber(row.feeAmount),
      referenceCode: row.paymentLink.referenceCode,
      createdAt: row.completedAt?.toISOString() ?? row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return {
    revenueThisMonth: Math.round((invoiceRevenue + linkRevenue) * 100) / 100,
    outstandingInvoiceTotal: decimalToNumber(outstandingAgg._sum.amount),
    recentPayments,
  };
}

export async function getMerchantAnalytics(
  user: AltaUser,
  companyId: string,
  range: MerchantAnalyticsRange = "30D",
): Promise<MerchantAnalytics> {
  await assertAdvancedMerchantAnalyticsAccess(user, companyId);
  const start = resolveAnalyticsRangeStart(range);
  const completedAt = completedAtFilter(start);

  const [
    invoicePayments,
    linkPayments,
    invoiceFailures,
    linkFailures,
    outstandingAgg,
    overdueAgg,
    paidInvoicesCount,
  ] = await Promise.all([
    prisma.merchantInvoicePayment.findMany({
      where: {
        status: "COMPLETED",
        ...(completedAt ? { completedAt } : {}),
        invoice: { merchantCompanyId: companyId },
      },
      include: {
        invoice: { select: { referenceCode: true } },
        initiatedBy: { select: { discordUsername: true, minecraftUsername: true } },
      },
    }),
    prisma.paymentLinkPayment.findMany({
      where: {
        status: "COMPLETED",
        ...(completedAt ? { completedAt } : {}),
        paymentLink: { merchantCompanyId: companyId },
      },
      include: {
        paymentLink: { select: { referenceCode: true } },
      },
    }),
    prisma.merchantInvoicePayment.count({
      where: {
        status: "FAILED",
        ...(completedAt ? { createdAt: completedAt } : {}),
        invoice: { merchantCompanyId: companyId },
      },
    }),
    prisma.paymentLinkPayment.count({
      where: {
        status: "FAILED",
        ...(completedAt ? { createdAt: completedAt } : {}),
        paymentLink: { merchantCompanyId: companyId },
      },
    }),
    prisma.merchantInvoice.aggregate({
      where: {
        merchantCompanyId: companyId,
        status: { in: UNPAID_INVOICE_STATUSES },
      },
      _sum: { amount: true },
    }),
    prisma.merchantInvoice.aggregate({
      where: { merchantCompanyId: companyId, status: "OVERDUE" },
      _sum: { amount: true },
    }),
    prisma.merchantInvoice.count({
      where: {
        merchantCompanyId: companyId,
        status: "PAID",
        ...(completedAt ? { paidAt: completedAt } : {}),
      },
    }),
  ]);

  const invoiceGross = invoicePayments.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  const invoiceFees = invoicePayments.reduce((sum, row) => sum + decimalToNumber(row.feeAmount), 0);
  const linkGross = linkPayments.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  const linkFees = linkPayments.reduce((sum, row) => sum + decimalToNumber(row.feeAmount), 0);

  const grossVolume = invoiceGross + linkGross;
  const totalFees = invoiceFees + linkFees;
  const netVolume = Math.round((grossVolume - totalFees) * 100) / 100;
  const successfulPayments = invoicePayments.length + linkPayments.length;
  const failedPayments = invoiceFailures + linkFailures;
  const totalAttempts = successfulPayments + failedPayments;

  const customerTotals = new Map<string, MerchantAnalyticsTopCustomer>();
  for (const row of invoicePayments) {
    const label =
      row.initiatedBy.minecraftUsername?.trim() ||
      row.initiatedBy.discordUsername ||
      "Customer";
    const existing = customerTotals.get(label) ?? {
      customerLabel: label,
      paymentCount: 0,
      grossVolume: 0,
    };
    existing.paymentCount += 1;
    existing.grossVolume += decimalToNumber(row.amount);
    customerTotals.set(label, existing);
  }
  for (const row of linkPayments) {
    const label = row.payerLabel ?? "Customer";
    const existing = customerTotals.get(label) ?? {
      customerLabel: label,
      paymentCount: 0,
      grossVolume: 0,
    };
    existing.paymentCount += 1;
    existing.grossVolume += decimalToNumber(row.amount);
    customerTotals.set(label, existing);
  }

  const topCustomers = [...customerTotals.values()]
    .sort((a, b) => b.grossVolume - a.grossVolume)
    .slice(0, 5);

  const recentPayments: MerchantAnalyticsRecentPayment[] = [
    ...invoicePayments.map((row) => ({
      id: row.id,
      source: "invoice" as const,
      customerLabel:
        row.initiatedBy.minecraftUsername?.trim() ||
        row.initiatedBy.discordUsername ||
        "Customer",
      grossAmount: decimalToNumber(row.amount),
      netAmount:
        Math.round((decimalToNumber(row.amount) - decimalToNumber(row.feeAmount)) * 100) / 100,
      feeAmount: decimalToNumber(row.feeAmount),
      referenceCode: row.invoice.referenceCode,
      createdAt: (row.completedAt ?? row.createdAt).toISOString(),
    })),
    ...linkPayments.map((row) => ({
      id: row.id,
      source: "payment_link" as const,
      customerLabel: row.payerLabel ?? "Customer",
      grossAmount: decimalToNumber(row.amount),
      netAmount:
        Math.round((decimalToNumber(row.amount) - decimalToNumber(row.feeAmount)) * 100) / 100,
      feeAmount: decimalToNumber(row.feeAmount),
      referenceCode: row.paymentLink.referenceCode,
      createdAt: (row.completedAt ?? row.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  const trendMap = new Map<string, MerchantAnalyticsTrendPoint>();
  const addTrend = (
    date: Date,
    gross: number,
    net: number,
    invoice: number,
    link: number,
  ) => {
    const key = monthKey(date);
    const existing = trendMap.get(key) ?? {
      month: key,
      grossVolume: 0,
      netVolume: 0,
      invoiceRevenue: 0,
      paymentLinkRevenue: 0,
    };
    existing.grossVolume += gross;
    existing.netVolume += net;
    existing.invoiceRevenue += invoice;
    existing.paymentLinkRevenue += link;
    trendMap.set(key, existing);
  };

  for (const row of invoicePayments) {
    const gross = decimalToNumber(row.amount);
    const fee = decimalToNumber(row.feeAmount);
    addTrend(row.completedAt ?? row.createdAt, gross, gross - fee, gross, 0);
  }
  for (const row of linkPayments) {
    const gross = decimalToNumber(row.amount);
    const fee = decimalToNumber(row.feeAmount);
    addTrend(row.completedAt ?? row.createdAt, gross, gross - fee, 0, gross);
  }

  const monthlyTrend = [...trendMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
    .map((point) => ({
      ...point,
      grossVolume: Math.round(point.grossVolume * 100) / 100,
      netVolume: Math.round(point.netVolume * 100) / 100,
      invoiceRevenue: Math.round(point.invoiceRevenue * 100) / 100,
      paymentLinkRevenue: Math.round(point.paymentLinkRevenue * 100) / 100,
    }));

  return {
    range,
    grossVolume: Math.round(grossVolume * 100) / 100,
    netVolume,
    totalFees: Math.round(totalFees * 100) / 100,
    invoiceRevenue: Math.round(invoiceGross * 100) / 100,
    paymentLinkRevenue: Math.round(linkGross * 100) / 100,
    outstandingInvoiceTotal: decimalToNumber(outstandingAgg._sum.amount),
    overdueInvoiceTotal: decimalToNumber(overdueAgg._sum.amount),
    paidInvoicesCount,
    averagePaymentSize:
      successfulPayments > 0
        ? Math.round((grossVolume / successfulPayments) * 100) / 100
        : 0,
    paymentSuccessRate:
      totalAttempts > 0 ? Math.round((successfulPayments / totalAttempts) * 1000) / 10 : 100,
    paymentFailureRate:
      totalAttempts > 0 ? Math.round((failedPayments / totalAttempts) * 1000) / 10 : 0,
    successfulPayments,
    failedPayments,
    topCustomers,
    recentPayments,
    monthlyTrend,
  };
}

/** Pure calculation helper for tests. */
export function computeMerchantAnalyticsSummary(input: {
  invoicePayments: Array<{ amount: number; feeAmount: number }>;
  linkPayments: Array<{ amount: number; feeAmount: number }>;
  failedAttempts: number;
}): Pick<
  MerchantAnalytics,
  | "grossVolume"
  | "netVolume"
  | "totalFees"
  | "invoiceRevenue"
  | "paymentLinkRevenue"
  | "averagePaymentSize"
  | "paymentSuccessRate"
  | "paymentFailureRate"
> {
  const invoiceGross = input.invoicePayments.reduce((sum, row) => sum + row.amount, 0);
  const invoiceFees = input.invoicePayments.reduce((sum, row) => sum + row.feeAmount, 0);
  const linkGross = input.linkPayments.reduce((sum, row) => sum + row.amount, 0);
  const linkFees = input.linkPayments.reduce((sum, row) => sum + row.feeAmount, 0);
  const grossVolume = invoiceGross + linkGross;
  const totalFees = invoiceFees + linkFees;
  const successfulPayments = input.invoicePayments.length + input.linkPayments.length;
  const totalAttempts = successfulPayments + input.failedAttempts;

  return {
    grossVolume: Math.round(grossVolume * 100) / 100,
    netVolume: Math.round((grossVolume - totalFees) * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    invoiceRevenue: Math.round(invoiceGross * 100) / 100,
    paymentLinkRevenue: Math.round(linkGross * 100) / 100,
    averagePaymentSize:
      successfulPayments > 0
        ? Math.round((grossVolume / successfulPayments) * 100) / 100
        : 0,
    paymentSuccessRate:
      totalAttempts > 0 ? Math.round((successfulPayments / totalAttempts) * 1000) / 10 : 100,
    paymentFailureRate:
      totalAttempts > 0 ? Math.round((input.failedAttempts / totalAttempts) * 1000) / 10 : 0,
  };
}

export type { MerchantAnalyticsTopCustomer, MerchantAnalyticsTrendPoint, MerchantAnalyticsRecentPayment };
