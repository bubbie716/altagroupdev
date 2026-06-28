import type {
  ActivityFeedItem,
  ExceptionItem,
  OpsHealthItem,
  OpsReportRow,
  TimelineEvent,
} from "@/lib/internal/ops-types";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { listOpsJobRuns } from "@/server/ops-job-run.service";
import { formatOpsJobRunHealthDetail } from "@/lib/internal/ops-job-run-display";
import { getInternalDashboardMetrics } from "@/server/internal-dashboard.service";
import { getMaintenanceMode } from "@/server/platform-settings.service";

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

export async function getOpsHealth(): Promise<OpsHealthItem[]> {
  await requireOperator();
  const [metrics, jobs, maintenance] = await Promise.all([
    getInternalDashboardMetrics(),
    listOpsJobRuns(),
    getMaintenanceMode(),
  ]);

  const jobMap = new Map(jobs.map((j) => [j.jobKey, j]));
  const jobStatus = (key: string, fallback: string): OpsHealthItem => {
    const j = jobMap.get(key);
    return {
      key,
      label: j?.label ?? key,
      status: j?.lastStatus === "SUCCESS" ? "operational" : j?.lastStatus === "FAILED" ? "degraded" : "unknown",
      detail: formatOpsJobRunHealthDetail(key, j?.lastMessage, fallback),
      lastSuccessAt: j?.lastSuccessAt?.toISOString() ?? null,
    };
  };

  return [
    {
      key: "maintenance",
      label: "Maintenance mode",
      status: maintenance.enabled ? "degraded" : "operational",
      detail: maintenance.enabled
        ? `Public platform offline${maintenance.updatedByUsername ? ` · set by ${maintenance.updatedByUsername}` : ""}`
        : "Public platform online",
      lastSuccessAt: maintenance.enabled ? maintenance.startedAt : maintenance.updatedAt,
    },
    {
      key: "platform",
      label: "Platform",
      status: "operational",
      detail: `${metrics.activeBankAccounts} active accounts · ${metrics.totalUsers} users`,
      lastSuccessAt: new Date().toISOString(),
    },
    jobStatus("scheduled_transfers", `${metrics.pendingScheduledTransfers} pending · ${metrics.failedScheduledTransfers} failed`),
    jobStatus("deposit_interest", "Deposit accrual and scheduled manual interest via cron"),
    jobStatus("loan_servicing", `${metrics.activeLoans} active loans`),
    jobStatus("BANK_ACCOUNT_STATEMENTS", "Bank account monthly statements"),
    jobStatus("ALTA_CARD_STATEMENTS", "Alta Card statement generation"),
    jobStatus("ALTA_CARD_BILLING", "Alta Card billing processing"),
    jobStatus("statements", "Batch generation via Statements ops"),
    {
      key: "alta_pay",
      label: "Alta Pay",
      status: "operational",
      detail: "Instant settlement active",
      lastSuccessAt: null,
    },
    {
      key: "audit",
      label: "Audit",
      status: "operational",
      detail: "Append-only audit log active",
      lastSuccessAt: null,
    },
  ];
}

export async function getExceptionCenterItems(): Promise<ExceptionItem[]> {
  await requireOperator();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const items: ExceptionItem[] = [];

  const { getExceptionDispositionMap } = await import("@/server/ops-exception-disposition.service");
  const dispositions = await getExceptionDispositionMap();

  const negativeAccounts = await prisma.bankAccount.findMany({
    where: { balance: { lt: 0 } },
    include: { user: true, company: true },
    take: 50,
  });
  for (const a of negativeAccounts) {
    items.push({
      id: `neg-${a.id}`,
      category: "negative_balance",
      severity: "critical",
      title: `Negative balance · ${a.accountNumber}`,
      detail: a.company?.name ?? a.user.discordUsername,
      href: `/internal/bank/accounts/${a.id}`,
      amount: decimalToNumber(a.balance),
      createdAt: a.updatedAt.toISOString(),
    });
  }

  const failedTransfers = await prisma.scheduledPayment.findMany({
    where: { status: "FAILED" },
    include: { bankAccount: true },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  for (const s of failedTransfers) {
    items.push({
      id: `stf-${s.id}`,
      category: "failed_transfer",
      severity: "high",
      title: s.label,
      detail: s.lastFailureReason ?? "Scheduled transfer failed",
      href: "/internal/bank/transfers",
      createdAt: s.updatedAt.toISOString(),
    });
  }

  const largeAdjustments = await prisma.bankTransaction.findMany({
    where: { type: "ADJUSTMENT", status: "APPROVED", createdAt: { gte: since }, amount: { gte: 100_000 } },
    include: { bankAccount: { include: { user: true, company: true } } },
    take: 25,
    orderBy: { createdAt: "desc" },
  });
  for (const tx of largeAdjustments) {
    items.push({
      id: `adj-${tx.id}`,
      category: "large_adjustment",
      severity: "medium",
      title: `Large adjustment · ${tx.referenceCode}`,
      detail: tx.bankAccount.company?.name ?? tx.bankAccount.user.discordUsername,
      href: `/internal/bank/transactions/${tx.id}`,
      amount: decimalToNumber(tx.amount),
      createdAt: tx.createdAt.toISOString(),
    });
  }

  const pending = await getInternalDashboardMetrics();
  if (pending.pendingDeposits > 0) {
    items.push({
      id: "queue-deposits",
      category: "pending_review",
      severity: "medium",
      title: `${pending.pendingDeposits} pending deposits`,
      detail: "Deposit review queue",
      href: "/internal/bank/deposits",
      createdAt: new Date().toISOString(),
    });
  }
  if (pending.pendingWithdrawals > 0) {
    items.push({
      id: "queue-withdrawals",
      category: "pending_review",
      severity: "medium",
      title: `${pending.pendingWithdrawals} pending withdrawals`,
      detail: "Withdrawal review queue",
      href: "/internal/bank/withdrawals",
      createdAt: new Date().toISOString(),
    });
  }

  return items
    .map((item) => {
      const disp = dispositions.get(item.id);
      return {
        ...item,
        dispositionStatus: disp?.status ?? "OPEN",
        dispositionReason: disp?.lastReason ?? null,
      };
    })
    .filter((item) => {
      const status = item.dispositionStatus ?? "OPEN";
      return status !== "RESOLVED" && status !== "DISMISSED";
    })
    .sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2 };
      return sev[a.severity] - sev[b.severity];
    });
}

function formatAccountLabel(account: { accountName: string; accountNumber: string }): string {
  return `${account.accountName} · ${account.accountNumber}`;
}

export async function getOpsActivityFeed(limit = 30): Promise<ActivityFeedItem[]> {
  await requireOperator();
  const items: ActivityFeedItem[] = [];

  const [audit, deposits, withdrawals, adjustments, loans] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.bankTransaction.findMany({
      where: { type: "DEPOSIT", status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: { bankAccount: true, reviewedBy: true },
    }),
    prisma.bankTransaction.findMany({
      where: { type: "WITHDRAWAL", status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: { bankAccount: true, reviewedBy: true },
    }),
    prisma.bankTransaction.findMany({
      where: { type: "ADJUSTMENT", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { bankAccount: true },
    }),
    prisma.loan.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { borrowerUser: true, company: true, linkedBankAccount: true },
    }),
  ]);

  const { resolveAccountsByAuditLogId } = await import("@/server/audit.service");
  const auditAccounts = await resolveAccountsByAuditLogId(audit);

  for (const a of audit) {
    const account = auditAccounts.get(a.id);
    items.push({
      id: `audit-${a.id}`,
      category: "audit",
      title: a.action,
      detail: a.description,
      accountLabel: account ? formatAccountLabel(account) : null,
      accountId: account?.id ?? null,
      href: "/internal/audit",
      actorLabel: a.actor.discordUsername,
      createdAt: a.createdAt.toISOString(),
    });
  }
  for (const d of deposits) {
    items.push({
      id: `dep-${d.id}`,
      category: "deposit",
      title: `Deposit approved · ${d.referenceCode}`,
      detail: d.description,
      accountLabel: formatAccountLabel(d.bankAccount),
      accountId: d.bankAccountId,
      href: `/internal/bank/transactions/${d.id}`,
      actorLabel: d.reviewedBy?.discordUsername ?? null,
      createdAt: (d.reviewedAt ?? d.createdAt).toISOString(),
    });
  }
  for (const w of withdrawals) {
    items.push({
      id: `wdr-${w.id}`,
      category: "withdrawal",
      title: `Withdrawal approved · ${w.referenceCode}`,
      detail: w.description,
      accountLabel: formatAccountLabel(w.bankAccount),
      accountId: w.bankAccountId,
      href: `/internal/bank/transactions/${w.id}`,
      actorLabel: w.reviewedBy?.discordUsername ?? null,
      createdAt: (w.reviewedAt ?? w.createdAt).toISOString(),
    });
  }
  for (const adj of adjustments) {
    items.push({
      id: `adj-${adj.id}`,
      category: "adjustment",
      title: `Adjustment · ${adj.referenceCode}`,
      detail: adj.description,
      accountLabel: formatAccountLabel(adj.bankAccount),
      accountId: adj.bankAccountId,
      href: `/internal/bank/transactions/${adj.id}`,
      actorLabel: null,
      createdAt: adj.createdAt.toISOString(),
    });
  }
  for (const l of loans) {
    items.push({
      id: `loan-${l.id}`,
      category: "loan",
      title: `Loan ${l.status}`,
      detail: l.company?.name ?? l.borrowerUser?.discordUsername ?? l.id.slice(0, 8),
      accountLabel: l.linkedBankAccount ? formatAccountLabel(l.linkedBankAccount) : null,
      accountId: l.linkedBankAccountId,
      href: `/internal/lending/loans/${l.id}`,
      actorLabel: null,
      createdAt: l.updatedAt.toISOString(),
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getOpsDailyReports(): Promise<Record<string, OpsReportRow>> {
  await requireOperator();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [deposits, withdrawals, adjustments, interest, altaPay, loans] = await Promise.all([
    prisma.bankTransaction.aggregate({
      where: { type: "DEPOSIT", status: "APPROVED", reviewedAt: { gte: start } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "WITHDRAWAL", status: "APPROVED", reviewedAt: { gte: start } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "ADJUSTMENT", status: "APPROVED", createdAt: { gte: start } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { type: "INTEREST_CREDIT", status: "APPROVED", createdAt: { gte: start } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: {
        type: "WITHDRAWAL",
        status: "APPROVED",
        description: { contains: "Alta Pay", mode: "insensitive" },
        createdAt: { gte: start },
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.loan.aggregate({
      where: { approvedAt: { gte: start } },
      _count: true,
      _sum: { principalAmount: true },
    }),
  ]);

  return {
    deposits: { label: "Today's deposits", count: deposits._count, totalAmount: decimalToNumber(deposits._sum.amount) },
    withdrawals: { label: "Today's withdrawals", count: withdrawals._count, totalAmount: decimalToNumber(withdrawals._sum.amount) },
    adjustments: { label: "Today's adjustments", count: adjustments._count, totalAmount: decimalToNumber(adjustments._sum.amount) },
    interest: { label: "Today's interest", count: interest._count, totalAmount: decimalToNumber(interest._sum.amount) },
    altaPay: { label: "Today's Alta Pay", count: altaPay._count, totalAmount: decimalToNumber(altaPay._sum.amount) },
    loans: { label: "Today's loan volume", count: loans._count, totalAmount: decimalToNumber(loans._sum.amount) },
  };
}

export async function buildActivityTimeline(
  entityType: "USER" | "BANK_ACCOUNT" | "COMPANY" | "LOAN",
  entityId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  await requireOperator();
  const events: TimelineEvent[] = [];

  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType, entityId },
        { targetUserId: entityType === "USER" ? entityId : undefined },
        { targetAccountId: entityType === "BANK_ACCOUNT" ? entityId : undefined },
        { targetCompanyId: entityType === "COMPANY" ? entityId : undefined },
        { targetLoanId: entityType === "LOAN" ? entityId : undefined },
      ].filter((c) => Object.values(c).some((v) => v !== undefined)),
    },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const { resolveAccountsByAuditLogId } = await import("@/server/audit.service");
  const auditAccounts = await resolveAccountsByAuditLogId(audit);
  const {
    formatLendingAuditActionTitle,
    formatLendingAuditDescription,
    isLendingAuditAction,
  } = await import("@/lib/bank/lending-audit-display");

  for (const a of audit) {
    const account = auditAccounts.get(a.id);
    const showAccount = entityType !== "BANK_ACCOUNT" && account;
    events.push({
      id: a.id,
      kind: a.action,
      title: isLendingAuditAction(a.action)
        ? formatLendingAuditActionTitle(a.action)
        : a.action.replace(/_/g, " "),
      detail: isLendingAuditAction(a.action)
        ? formatLendingAuditDescription(a.description)
        : a.description,
      actorLabel: a.actor.discordUsername,
      createdAt: a.createdAt.toISOString(),
      href: null,
      accountLabel: showAccount ? formatAccountLabel(account) : null,
      accountId: showAccount ? account.id : null,
    });
  }

  if (entityType === "BANK_ACCOUNT") {
    const account = await prisma.bankAccount.findUnique({ where: { id: entityId } });
    if (account) {
      events.push({
        id: `created-${account.id}`,
        kind: "ACCOUNT_CREATED",
        title: "Account created",
        detail: account.accountNumber,
        actorLabel: null,
        createdAt: account.createdAt.toISOString(),
        href: null,
        accountLabel: null,
        accountId: null,
      });
    }
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
