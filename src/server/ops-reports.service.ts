import type { OpsReportFilters, OpsReportsBundle, OpsReportRow } from "@/lib/internal/ops-report.types";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function resolveReportRange(filters: OpsReportFilters = {}): { from: Date; to: Date; periodLabel: string } {
  const to = filters.to ? new Date(filters.to) : new Date();
  to.setHours(23, 59, 59, 999);

  let from: Date;
  let periodLabel: string;

  if (filters.period === "7d") {
    from = new Date(to);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    periodLabel = "Last 7 days";
  } else if (filters.period === "30d") {
    from = new Date(to);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    periodLabel = "Last 30 days";
  } else if (filters.period === "custom" && filters.from) {
    from = new Date(filters.from);
    from.setHours(0, 0, 0, 0);
    periodLabel = `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`;
  } else {
    from = new Date(to);
    from.setHours(0, 0, 0, 0);
    periodLabel = "Today";
  }

  return { from, to, periodLabel };
}

export async function getOpsReports(filters: OpsReportFilters = {}): Promise<OpsReportsBundle> {
  await requireOperator();
  const { from, to, periodLabel } = resolveReportRange(filters);
  const range = { gte: from, lte: to };

  const [
    deposits,
    withdrawals,
    transfers,
    altaPay,
    loanApplications,
    loanOriginations,
    loanPayments,
    altaCardApplications,
    altaCardReviews,
    bankStatements,
    altaCardStatements,
    tierChangesPersonal,
    tierChangesCompany,
    manualAdjustments,
    exceptionDispositions,
  ] = await Promise.all([
    prisma.bankTransaction.aggregate({
      where: { type: "DEPOSIT", status: "APPROVED", reviewedAt: range },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "WITHDRAWAL", status: "APPROVED", reviewedAt: range },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.scheduledTransferExecution.count({
      where: { status: "EXECUTED", executedAt: range },
    }),
    prisma.bankTransaction.aggregate({
      where: {
        type: "WITHDRAWAL",
        status: "APPROVED",
        description: { contains: "Alta Pay", mode: "insensitive" },
        reviewedAt: range,
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.loanApplication.count({ where: { createdAt: range } }),
    prisma.loan.aggregate({
      where: { approvedAt: range },
      _count: true,
      _sum: { principalAmount: true },
    }),
    prisma.loanPayment.aggregate({
      where: { paymentDate: range, status: "COMPLETED" },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.altaCardApplication.count({ where: { createdAt: range } }),
    prisma.altaCardReviewRequest.count({ where: { createdAt: range } }),
    prisma.bankStatement.count({
      where: { OR: [{ generatedAt: range }, { generatedAt: null, createdAt: range }] },
    }),
    prisma.altaCardStatement.count({ where: { createdAt: range } }),
    prisma.relationshipTimelineEvent.count({
      where: { eventType: "RELATIONSHIP_TIER_CHANGED", occurredAt: range },
    }),
    prisma.companyRelationshipTimelineEvent.count({
      where: { eventType: "RELATIONSHIP_TIER_CHANGED", occurredAt: range },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "ADJUSTMENT", status: "APPROVED", createdAt: range },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.opsExceptionDisposition.count({ where: { createdAt: range } }),
  ]);

  // Transfer amounts require a separate query — aggregate _sum on relation not supported cleanly
  const transferExecutions = await prisma.scheduledTransferExecution.findMany({
    where: { status: "EXECUTED", executedAt: range },
    include: { scheduledPayment: { select: { amount: true } } },
    take: 5000,
  });
  const transferTotal = transferExecutions.reduce(
    (s, e) => s + decimalToNumber(e.scheduledPayment.amount),
    0,
  );

  const reports: OpsReportRow[] = [
    {
      key: "deposits",
      label: "Deposits",
      count: deposits._count,
      totalAmount: decimalToNumber(deposits._sum.amount),
    },
    {
      key: "withdrawals",
      label: "Withdrawals",
      count: withdrawals._count,
      totalAmount: decimalToNumber(withdrawals._sum.amount),
    },
    {
      key: "transfers",
      label: "Transfers",
      count: transfers,
      totalAmount: transferTotal,
    },
    {
      key: "altaPay",
      label: "Alta Pay",
      count: altaPay._count,
      totalAmount: decimalToNumber(altaPay._sum.amount),
    },
    {
      key: "loanApplications",
      label: "Loan applications",
      count: loanApplications,
      totalAmount: 0,
    },
    {
      key: "loanOriginations",
      label: "Loan originations",
      count: loanOriginations._count,
      totalAmount: decimalToNumber(loanOriginations._sum.principalAmount),
    },
    {
      key: "loanPayments",
      label: "Loan payments",
      count: loanPayments._count,
      totalAmount: decimalToNumber(loanPayments._sum.amount),
    },
    {
      key: "altaCardApplications",
      label: "Alta Card applications",
      count: altaCardApplications,
      totalAmount: 0,
    },
    {
      key: "altaCardReviews",
      label: "Alta Card reviews",
      count: altaCardReviews,
      totalAmount: 0,
    },
    {
      key: "statementsGenerated",
      label: "Statements generated",
      count: bankStatements + altaCardStatements,
      totalAmount: 0,
    },
    {
      key: "relationshipTierChanges",
      label: "Relationship tier changes",
      count: tierChangesPersonal + tierChangesCompany,
      totalAmount: 0,
    },
    {
      key: "manualAdjustments",
      label: "Manual adjustments",
      count: manualAdjustments._count,
      totalAmount: decimalToNumber(manualAdjustments._sum.amount),
    },
    {
      key: "exceptions",
      label: "Exception actions",
      count: exceptionDispositions,
      totalAmount: 0,
    },
  ];

  return {
    periodLabel,
    from: from.toISOString(),
    to: to.toISOString(),
    reports,
  };
}

export async function exportOpsReportsCsv(filters: OpsReportFilters = {}): Promise<string> {
  const bundle = await getOpsReports(filters);
  const header = "report,count,total_amount\n";
  const body = bundle.reports
    .map((r) => `${r.label},${r.count},${r.totalAmount.toFixed(2)}`)
    .join("\n");
  return header + body;
}
