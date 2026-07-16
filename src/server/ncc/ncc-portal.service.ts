import { prisma } from "@/server/db";
import { ALTA_BANK_INSTITUTION_ID } from "@/lib/bank/account-ownership";
import { canAccessInternal } from "@/lib/auth/permissions";
import { requireAuth } from "@/server/auth.service";
import { NCC_DEFAULT_CURRENCY, decimalToNumber } from "@/lib/ncc/ncc-money";
import type {
  PortalAccountSummary,
  PortalAlert,
  PortalAuditRow,
  PortalDashboardMetrics,
  PortalInstitutionSummary,
  PortalMemberRow,
  PortalNotification,
  PortalReportMetrics,
  PortalRoutingRow,
  PortalSearchResult,
  PortalSettlementDetail,
  PortalSettlementRow,
} from "@/lib/ncc/portal-types";
import { requireInstitutionPermission } from "@/server/ncc/ncc-permissions.service";
import { isCompensationEligible } from "@/server/ncc/ncc-compensation.service";
import type {
  Prisma,
  SettlementExecutionStatus,
  SettlementInstructionStatus,
} from "@prisma/client";

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function canCancelInstruction(
  status: SettlementInstructionStatus,
  executionStatus: SettlementExecutionStatus | null | undefined,
): boolean {
  if (status === "SETTLED" || status === "REVERSED" || status === "CANCELLED" || status === "FAILED") {
    return false;
  }
  if (status === "SETTLING") return false;
  if (!executionStatus || executionStatus === "NOT_STARTED") return true;
  return false;
}

function mapInstitution(row: {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  institutionType: string;
  status: PortalInstitutionSummary["status"];
  isAlta: boolean;
  isNCCParticipant: boolean;
}): PortalInstitutionSummary {
  return {
    id: row.id,
    legalName: row.legalName,
    displayName: row.displayName,
    slug: row.slug,
    institutionType: row.institutionType,
    status: row.status,
    isAlta: row.isAlta,
    isNCCParticipant: row.isNCCParticipant,
  };
}

function settlementStage(status: string): string {
  switch (status) {
    case "CREATED":
    case "SUBMITTED":
      return "Intake";
    case "VALIDATING":
      return "Validation";
    case "QUEUED":
      return "Queue";
    case "SETTLING":
      return "Settlement";
    case "SETTLED":
      return "Complete";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "REVERSED":
      return "Reversed";
    default:
      return status;
  }
}

/** Lightweight shell context for portal chrome (sidebar + notifications). */
export async function getPortalShell(institutionId: string): Promise<{
  institution: PortalInstitutionSummary;
  notifications: PortalNotification[];
}> {
  const dashboard = await getPortalDashboard(institutionId);
  return {
    institution: dashboard.metrics.institution,
    notifications: dashboard.notifications,
  };
}

/** Resolve which institution the current user operates in the portal. */
export async function resolvePortalInstitutionId(preferredId?: string | null): Promise<string> {
  const user = await requireAuth();

  if (preferredId && canAccessInternal(user)) {
    const exists = await prisma.financialInstitution.findUnique({
      where: { id: preferredId },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  const membership = await prisma.institutionMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { institutionId: true },
  });
  if (membership) return membership.institutionId;

  if (canAccessInternal(user)) {
    return ALTA_BANK_INSTITUTION_ID;
  }

  throw new Error("FORBIDDEN");
}

export async function getPortalDashboard(institutionId: string): Promise<{
  metrics: PortalDashboardMetrics;
  alerts: PortalAlert[];
  recentSettlements: PortalSettlementRow[];
  recentAudit: PortalAuditRow[];
  notifications: PortalNotification[];
}> {
  await requireInstitutionPermission(institutionId, "view_institution");

  const dayStart = startOfUtcDay();
  const [
    institution,
    primaryRouting,
    account,
    todaySettled,
    pendingCount,
    failedCount,
    memberCount,
    recent,
    settledWithTimes,
  ] = await Promise.all([
    prisma.financialInstitution.findUniqueOrThrow({ where: { id: institutionId } }),
    prisma.routingNumber.findFirst({
      where: { institutionId, isPrimary: true, status: "ACTIVE" },
    }),
    prisma.settlementAccount.findUnique({
      where: { institutionId_currency: { institutionId, currency: NCC_DEFAULT_CURRENCY } },
    }),
    prisma.settlementInstruction.findMany({
      where: {
        status: "SETTLED",
        settledAt: { gte: dayStart },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
      select: { amount: true, submittedAt: true, settledAt: true },
    }),
    prisma.settlementInstruction.count({
      where: {
        status: { in: ["CREATED", "SUBMITTED", "VALIDATING", "QUEUED", "SETTLING"] },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
    }),
    prisma.settlementInstruction.count({
      where: {
        status: "FAILED",
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
    }),
    prisma.institutionMember.count({ where: { institutionId, status: "ACTIVE" } }),
    listPortalSettlements(institutionId, { limit: 8 }),
    prisma.settlementInstruction.findMany({
      where: {
        status: "SETTLED",
        settledAt: { not: null },
        submittedAt: { not: null },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
      orderBy: { settledAt: "desc" },
      take: 50,
      select: { submittedAt: true, settledAt: true },
    }),
  ]);

  const todayVolume = todaySettled.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  const durations = settledWithTimes
    .map((row) => {
      if (!row.submittedAt || !row.settledAt) return null;
      return row.settledAt.getTime() - row.submittedAt.getTime();
    })
    .filter((v): v is number => v != null && v >= 0);
  const averageSettlementMs =
    durations.length === 0 ? null : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const alerts: PortalAlert[] = [];
  if (failedCount > 0) {
    alerts.push({
      id: "failed-settlements",
      severity: "critical",
      title: "Failed settlements",
      detail: `${failedCount} instruction${failedCount === 1 ? "" : "s"} require attention.`,
      href: "/portal/queue?status=FAILED",
    });
  }
  if (pendingCount > 10) {
    alerts.push({
      id: "settlement-backlog",
      severity: "warning",
      title: "Settlement backlog",
      detail: `${pendingCount} instructions are pending in the queue.`,
      href: "/portal/queue",
    });
  }
  if (institution.status === "RESTRICTED" || institution.status === "SUSPENDED") {
    alerts.push({
      id: "institution-status",
      severity: "critical",
      title: "Institution status",
      detail: `Institution is currently ${institution.status.toLowerCase()}.`,
      href: "/portal/settings",
    });
  }
  const suspendedRouting = await prisma.routingNumber.count({
    where: { institutionId, status: "SUSPENDED" },
  });
  if (suspendedRouting > 0) {
    alerts.push({
      id: "routing-suspended",
      severity: "warning",
      title: "Suspended routing number",
      detail: `${suspendedRouting} routing number${suspendedRouting === 1 ? "" : "s"} suspended.`,
      href: "/portal/routing",
    });
  }

  const recentAudit = await listPortalAudit(institutionId, { limit: 6 });

  const notifications: PortalNotification[] = [
    ...alerts.slice(0, 3).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      body: alert.detail,
      createdAt: new Date().toISOString(),
      read: false,
      href: alert.href,
    })),
    ...recentAudit.slice(0, 3).map((event) => ({
      id: `audit-${event.id}`,
      title: event.action.replace(/^NCC_/, "").replace(/_/g, " "),
      body: event.description,
      createdAt: event.createdAt,
      read: true,
      href: "/portal/audit",
    })),
  ];

  return {
    metrics: {
      institution: mapInstitution(institution),
      primaryRoutingNumber: primaryRouting?.routingNumber ?? null,
      settlementBalance: account ? decimalToNumber(account.ledgerBalance) : 0,
      settlementAvailable: account ? decimalToNumber(account.availableBalance) : 0,
      currency: account?.currency ?? NCC_DEFAULT_CURRENCY,
      todayVolume,
      todayCount: todaySettled.length,
      pendingCount,
      failedCount,
      averageSettlementMs,
      memberCount,
    },
    alerts,
    recentSettlements: recent,
    recentAudit,
    notifications,
  };
}

export async function listPortalSettlements(
  institutionId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string | string[];
    q?: string;
    queueOnly?: boolean;
  },
): Promise<PortalSettlementRow[]> {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");

  const statusFilter = options?.status
    ? Array.isArray(options.status)
      ? options.status
      : [options.status]
    : undefined;

  const q = options?.q?.trim();
  const andFilters: Prisma.SettlementInstructionWhereInput[] = [
    {
      OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
    },
  ];

  if (statusFilter && statusFilter.length > 0) {
    andFilters.push({
      status: { in: statusFilter as SettlementInstructionStatus[] },
    });
  }

  if (options?.queueOnly) {
    andFilters.push({
      OR: [
        {
          status: {
            in: ["CREATED", "SUBMITTED", "VALIDATING", "SETTLING", "FAILED"] as SettlementInstructionStatus[],
          },
        },
        {
          execution: {
            status: {
              in: [
                "NOT_STARTED",
                "VALIDATING",
                "PREPARING_SOURCE",
                "SOURCE_PREPARED",
                "POSTING_NCC_LEDGER",
                "NCC_LEDGER_POSTED",
                "COMMITTING_SOURCE",
                "SOURCE_COMMITTED",
                "CREDITING_DESTINATION",
                "RETRY_PENDING",
                "MANUAL_REVIEW",
                "FAILED",
                "COMPENSATING",
              ] as SettlementExecutionStatus[],
            },
          },
        },
      ],
    });
  }

  if (q) {
    andFilters.push({
      OR: [
        { publicReference: { contains: q, mode: "insensitive" } },
        { externalReference: { contains: q, mode: "insensitive" } },
        { idempotencyKey: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const rows = await prisma.settlementInstruction.findMany({
    where: { AND: andFilters },
    include: {
      sendingInstitution: { select: { displayName: true } },
      receivingInstitution: { select: { displayName: true } },
      execution: true,
      compensation: true,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 50, 100),
    skip: options?.offset ?? 0,
  });

  return rows.map((row) => {
    const eligibility = isCompensationEligible(row.status, row.execution);
    return {
      id: row.id,
      publicReference: row.publicReference,
      status: row.status,
      sendingInstitutionId: row.sendingInstitutionId,
      sendingInstitutionName: row.sendingInstitution.displayName,
      receivingInstitutionId: row.receivingInstitutionId,
      receivingInstitutionName: row.receivingInstitution.displayName,
      amount: decimalToNumber(row.amount),
      currency: row.currency,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      settledAt: row.settledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      failureCode: row.failureCode ?? row.execution?.failureCode ?? null,
      failureReason: row.failureReason ?? row.execution?.failureReason ?? null,
      stage: row.execution?.status ?? settlementStage(row.status),
      executionStatus: row.execution?.status ?? null,
      executionStep: row.execution?.currentStep ?? null,
      completedAt: row.execution?.completedAt?.toISOString() ?? null,
      sourceCommitReference: row.execution?.sourceCommitReference ?? null,
      destinationCreditReference: row.execution?.destinationCreditReference ?? null,
      compensationEligible: eligibility.ok,
      compensationStatus: row.compensation ? "COMPENSATED" : row.execution?.status === "COMPENSATING" ? "COMPENSATING" : null,
      canCancel: canCancelInstruction(row.status, row.execution?.status),
    };
  });
}

export async function getPortalSettlementDetail(
  institutionId: string,
  instructionId: string,
): Promise<PortalSettlementDetail> {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");

  const row = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: instructionId },
    include: {
      sendingInstitution: { select: { displayName: true } },
      receivingInstitution: { select: { displayName: true } },
      sendingRoutingNumber: { select: { routingNumber: true } },
      receivingRoutingNumber: { select: { routingNumber: true } },
      entries: { orderBy: { createdAt: "asc" } },
      reversalAsOriginal: true,
      execution: true,
      compensation: true,
      outboxEvents: {
        where: { status: "FAILED" },
        select: { id: true },
      },
      reconciliations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  if (
    row.sendingInstitutionId !== institutionId &&
    row.receivingInstitutionId !== institutionId
  ) {
    throw new Error("FORBIDDEN");
  }

  const { queryAuditLogs } = await import("@/server/audit.service");
  const auditEvents = await queryAuditLogs(
    { entityType: "SETTLEMENT_INSTRUCTION", entityId: instructionId },
    50,
  );

  const eligibility = isCompensationEligible(row.status, row.execution);

  return {
    id: row.id,
    publicReference: row.publicReference,
    status: row.status,
    sendingInstitutionId: row.sendingInstitutionId,
    sendingInstitutionName: row.sendingInstitution.displayName,
    receivingInstitutionId: row.receivingInstitutionId,
    receivingInstitutionName: row.receivingInstitution.displayName,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    failureCode: row.failureCode ?? row.execution?.failureCode ?? null,
    failureReason: row.failureReason ?? row.execution?.failureReason ?? null,
    stage: row.execution?.status ?? settlementStage(row.status),
    executionStatus: row.execution?.status ?? null,
    executionStep: row.execution?.currentStep ?? null,
    completedAt: row.execution?.completedAt?.toISOString() ?? null,
    sourceCommitReference: row.execution?.sourceCommitReference ?? null,
    destinationCreditReference: row.execution?.destinationCreditReference ?? null,
    compensationEligible: eligibility.ok,
    compensationStatus: row.compensation
      ? "COMPENSATED"
      : row.execution?.status === "COMPENSATING"
        ? "COMPENSATING"
        : null,
    canCancel: canCancelInstruction(row.status, row.execution?.status),
    purpose: row.purpose,
    externalReference: row.externalReference,
    idempotencyKey: row.idempotencyKey,
    sendingRoutingNumber: row.sendingRoutingNumber.routingNumber,
    receivingRoutingNumber: row.receivingRoutingNumber.routingNumber,
    submittedByUserId: row.submittedByUserId,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    manualReviewReason:
      row.execution?.status === "MANUAL_REVIEW" ? (row.execution.failureReason ?? null) : null,
    outboxFailureCount: row.outboxEvents.length,
    reconciliationStatus: row.reconciliations[0]?.status ?? null,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      amount: decimalToNumber(entry.amount),
      currency: entry.currency,
      balanceBefore: decimalToNumber(entry.balanceBefore),
      balanceAfter: decimalToNumber(entry.balanceAfter),
      createdAt: entry.createdAt.toISOString(),
      institutionId: entry.institutionId,
    })),
    reversal: row.reversalAsOriginal
      ? {
          id: row.reversalAsOriginal.id,
          reason: row.reversalAsOriginal.reason,
          actorUserId: row.reversalAsOriginal.actorUserId,
          createdAt: row.reversalAsOriginal.createdAt.toISOString(),
          reversalInstructionId: row.reversalAsOriginal.reversalInstructionId,
        }
      : null,
    compensation: row.compensation
      ? {
          id: row.compensation.id,
          reason: row.compensation.reason,
          actorUserId: row.compensation.actorUserId,
          createdAt: row.compensation.createdAt.toISOString(),
          sourceRestoreReference: row.compensation.sourceRestoreReference,
          compensatingInstructionId: row.compensation.compensatingInstructionId,
        }
      : null,
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      description: event.description,
      createdAt: event.createdAt,
      actorUsername: event.actorUsername,
    })),
  };
}

export async function listPortalRouting(institutionId: string): Promise<PortalRoutingRow[]> {
  await requireInstitutionPermission(institutionId, "view_routing_numbers");
  const rows = await prisma.routingNumber.findMany({
    where: { institutionId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    routingNumber: row.routingNumber,
    status: row.status,
    isPrimary: row.isPrimary,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
  }));
}

export async function listPortalMembers(institutionId: string): Promise<PortalMemberRow[]> {
  await requireInstitutionPermission(institutionId, "view_institution");
  const rows = await prisma.institutionMember.findMany({
    where: { institutionId },
    include: { user: { select: { discordUsername: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    username: row.user.discordUsername,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));
}

export async function getPortalAccountSummary(institutionId: string): Promise<PortalAccountSummary | null> {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const account = await prisma.settlementAccount.findUnique({
    where: { institutionId_currency: { institutionId, currency: NCC_DEFAULT_CURRENCY } },
  });
  if (!account) return null;

  const dayStart = startOfUtcDay();
  const todayEntries = await prisma.settlementEntry.findMany({
    where: { settlementAccountId: account.id, createdAt: { gte: dayStart } },
    select: { entryType: true, amount: true },
  });
  const dailyNetMovement = todayEntries.reduce((sum, entry) => {
    const amount = decimalToNumber(entry.amount);
    if (entry.entryType === "CREDIT" || entry.entryType === "REVERSAL_CREDIT") return sum + amount;
    return sum - amount;
  }, 0);

  const recent = await prisma.settlementEntry.findMany({
    where: { settlementAccountId: account.id },
    include: { instruction: { select: { publicReference: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return {
    id: account.id,
    currency: account.currency,
    ledgerBalance: decimalToNumber(account.ledgerBalance),
    availableBalance: decimalToNumber(account.availableBalance),
    reservedBalance: Number(
      (decimalToNumber(account.ledgerBalance) - decimalToNumber(account.availableBalance)).toFixed(2),
    ),
    status: account.status,
    dailyNetMovement: Number(dailyNetMovement.toFixed(2)),
    recentEntries: recent.map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      amount: decimalToNumber(entry.amount),
      balanceAfter: decimalToNumber(entry.balanceAfter),
      createdAt: entry.createdAt.toISOString(),
      publicReference: entry.instruction.publicReference,
    })),
  };
}

export async function getPortalReports(institutionId: string): Promise<PortalReportMetrics> {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [settled, failed, accounts, counterparties] = await Promise.all([
    prisma.settlementInstruction.findMany({
      where: {
        status: "SETTLED",
        settledAt: { gte: since },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
      select: {
        amount: true,
        submittedAt: true,
        settledAt: true,
        sendingInstitutionId: true,
        receivingInstitutionId: true,
        sendingInstitution: { select: { displayName: true } },
        receivingInstitution: { select: { displayName: true } },
      },
    }),
    prisma.settlementInstruction.count({
      where: {
        status: "FAILED",
        createdAt: { gte: since },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
    }),
    prisma.settlementAccount.findMany({ where: { institutionId } }),
    prisma.settlementInstruction.groupBy({
      by: ["sendingInstitutionId", "receivingInstitutionId"],
      where: {
        status: "SETTLED",
        settledAt: { gte: since },
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const settlementVolume = settled.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  const settlementCount = settled.length;
  const totalTerminal = settlementCount + failed;
  const failureRate = totalTerminal === 0 ? 0 : failed / totalTerminal;

  const durations = settled
    .map((row) =>
      row.submittedAt && row.settledAt ? row.settledAt.getTime() - row.submittedAt.getTime() : null,
    )
    .filter((v): v is number => v != null && v >= 0);
  const averageProcessingMs =
    durations.length === 0 ? null : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const counterpartyMap = new Map<string, { name: string; volume: number; count: number }>();
  for (const row of settled) {
    const otherId =
      row.sendingInstitutionId === institutionId
        ? row.receivingInstitutionId
        : row.sendingInstitutionId;
    const otherName =
      row.sendingInstitutionId === institutionId
        ? row.receivingInstitution.displayName
        : row.sendingInstitution.displayName;
    const current = counterpartyMap.get(otherId) ?? { name: otherName, volume: 0, count: 0 };
    current.volume += decimalToNumber(row.amount);
    current.count += 1;
    counterpartyMap.set(otherId, current);
  }

  const dailyMap = new Map<string, { volume: number; count: number }>();
  for (const row of settled) {
    const date = (row.settledAt ?? new Date()).toISOString().slice(0, 10);
    const current = dailyMap.get(date) ?? { volume: 0, count: 0 };
    current.volume += decimalToNumber(row.amount);
    current.count += 1;
    dailyMap.set(date, current);
  }

  void counterparties;

  return {
    settlementVolume,
    settlementCount,
    failureRate,
    averageProcessingMs,
    balances: accounts.map((account) => ({
      currency: account.currency,
      ledgerBalance: decimalToNumber(account.ledgerBalance),
      availableBalance: decimalToNumber(account.availableBalance),
    })),
    topCounterparties: [...counterpartyMap.entries()]
      .map(([id, value]) => ({ institutionId: id, ...value }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8),
    dailyVolume: [...dailyMap.entries()]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function listPortalAudit(
  institutionId: string,
  options?: { limit?: number; q?: string },
): Promise<PortalAuditRow[]> {
  await requireInstitutionPermission(institutionId, "view_audit");

  const instructionIds = (
    await prisma.settlementInstruction.findMany({
      where: {
        OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
      },
      select: { id: true },
      take: 500,
      orderBy: { createdAt: "desc" },
    })
  ).map((row) => row.id);

  const routingIds = (
    await prisma.routingNumber.findMany({
      where: { institutionId },
      select: { id: true },
    })
  ).map((row) => row.id);

  const accountIds = (
    await prisma.settlementAccount.findMany({
      where: { institutionId },
      select: { id: true },
    })
  ).map((row) => row.id);

  const memberIds = (
    await prisma.institutionMember.findMany({
      where: { institutionId },
      select: { id: true },
    })
  ).map((row) => row.id);

  const q = options?.q?.trim();
  const rows = await prisma.auditLog.findMany({
    where: {
      AND: [
        {
          OR: [
            { institutionId },
            {
              entityType: "SETTLEMENT_INSTRUCTION",
              entityId: { in: instructionIds.length > 0 ? instructionIds : ["__none__"] },
            },
            {
              entityType: "ROUTING_NUMBER",
              entityId: { in: routingIds.length > 0 ? routingIds : ["__none__"] },
            },
            {
              entityType: "SETTLEMENT_ACCOUNT",
              entityId: { in: accountIds.length > 0 ? accountIds : ["__none__"] },
            },
            {
              entityType: "INSTITUTION_MEMBER",
              entityId: { in: memberIds.length > 0 ? memberIds : ["__none__"] },
            },
            {
              entityType: "FINANCIAL_INSTITUTION",
              entityId: institutionId,
            },
            {
              entityType: "SETTLEMENT_EXECUTION",
              entityId: {
                in:
                  instructionIds.length > 0
                    ? (
                        await prisma.settlementExecution.findMany({
                          where: { settlementInstructionId: { in: instructionIds } },
                          select: { id: true },
                        })
                      ).map((row) => row.id)
                    : ["__none__"],
              },
            },
          ],
        },
        ...(q
          ? [
              {
                OR: [
                  { action: { contains: q, mode: "insensitive" as const } },
                  { description: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 50, 100),
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorUsername: row.actor.discordUsername,
    action: row.action,
    description: row.description,
    entityType: row.entityType,
    entityId: row.entityId,
  }));
}

export async function searchPortal(
  institutionId: string,
  query: string,
): Promise<PortalSearchResult[]> {
  await requireInstitutionPermission(institutionId, "view_institution");
  const q = query.trim();
  if (q.length < 2) return [];

  const [settlements, routing, members, audit] = await Promise.all([
    listPortalSettlements(institutionId, { q, limit: 5 }),
    prisma.routingNumber.findMany({
      where: { institutionId, routingNumber: { contains: q } },
      take: 5,
    }),
    prisma.institutionMember.findMany({
      where: {
        institutionId,
        user: { discordUsername: { contains: q, mode: "insensitive" } },
      },
      include: { user: { select: { discordUsername: true } } },
      take: 5,
    }),
    listPortalAudit(institutionId, { q, limit: 5 }),
  ]);

  return [
    ...settlements.map((row) => ({
      kind: "settlement" as const,
      id: row.id,
      title: row.publicReference,
      subtitle: `${row.status} · ${row.amount} ${row.currency}`,
      href: `/portal/settlements/${row.id}`,
    })),
    ...routing.map((row) => ({
      kind: "routing" as const,
      id: row.id,
      title: row.routingNumber,
      subtitle: row.status,
      href: "/portal/routing",
    })),
    ...members.map((row) => ({
      kind: "member" as const,
      id: row.id,
      title: row.user.discordUsername,
      subtitle: row.role,
      href: "/portal/members",
    })),
    ...audit.map((row) => ({
      kind: "audit" as const,
      id: row.id,
      title: row.action,
      subtitle: row.description,
      href: "/portal/audit",
    })),
  ];
}
