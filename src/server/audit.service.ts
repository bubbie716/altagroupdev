import type { AuditEntityType, Prisma } from "@prisma/client";
import type { AuditLogFilters, AuditLogRow, WriteAuditLogInput } from "@/lib/internal/audit.types";
import { prisma } from "@/server/db";

type AuditRowRecord = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { discordUsername: true } } };
}>;

type AccountRef = {
  id: string;
  accountNumber: string;
  accountName: string;
};

function mapAuditRow(
  row: AuditRowRecord,
  targetUsername: string | null,
  account: AccountRef | null,
): AuditLogRow {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    actorUsername: row.actor.discordUsername,
    targetUserId: row.targetUserId,
    targetUsername,
    targetAccountId: account?.id ?? row.targetAccountId,
    targetAccountNumber: account?.accountNumber ?? null,
    targetAccountName: account?.accountName ?? null,
    targetCompanyId: row.targetCompanyId,
    targetTransactionId: row.targetTransactionId,
    targetLoanId: row.targetLoanId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    description: row.description,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? {
          source: (input.metadata as Record<string, unknown>).source ?? "OPERATOR",
          severity: (input.metadata as Record<string, unknown>).severity ?? "info",
          timestamp: new Date().toISOString(),
          ...input.metadata,
        }
      : { source: "OPERATOR", severity: "info", timestamp: new Date().toISOString() };

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      targetAccountId: input.targetAccountId ?? null,
      targetCompanyId: input.targetCompanyId ?? null,
      targetTransactionId: input.targetTransactionId ?? null,
      targetLoanId: input.targetLoanId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      metadata,
    },
  });

  try {
    const { notifyDiscordFromAuditLog } = await import("@/lib/staff-audit/audit-log-discord-bridge");
    notifyDiscordFromAuditLog({ ...input, metadata });
  } catch (error) {
    console.error("[audit] Discord staff notification failed", error);
  }
}

const MEANINGFUL_VIEW_EXCLUDED_ACTIONS = [
  "ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED",
  "RELATIONSHIP_RECOMMENDATION_VIEWED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_VIEWED",
  "RELATIONSHIP_INTELLIGENCE_VIEWED",
  "COMPANY_RELATIONSHIP_INTELLIGENCE_VIEWED",
];

function categoryActionWhere(
  category: string,
): Prisma.AuditLogWhereInput | null {
  switch (category) {
    case "money":
      return {
        OR: [
          { action: { contains: "DEPOSIT", mode: "insensitive" } },
          { action: { contains: "WITHDRAWAL", mode: "insensitive" } },
          { action: { contains: "TRANSFER", mode: "insensitive" } },
          { action: { contains: "INTEREST", mode: "insensitive" } },
          { action: { contains: "ADJUSTMENT", mode: "insensitive" } },
          { action: { contains: "FEE", mode: "insensitive" } },
          { action: { contains: "PAYROLL", mode: "insensitive" } },
          { action: { contains: "ALTA_PAY", mode: "insensitive" } },
          { action: { contains: "PAYMENT", mode: "insensitive" } },
        ],
      };
    case "lending":
      return {
        OR: [
          { action: { startsWith: "LOAN_" } },
          { action: { contains: "LENDING", mode: "insensitive" } },
          { action: { contains: "DEAL_ROOM", mode: "insensitive" } },
        ],
      };
    case "cards":
      return { action: { contains: "ALTA_CARD", mode: "insensitive" } };
    case "accounts":
      return {
        OR: [
          { action: { contains: "ACCOUNT", mode: "insensitive" } },
          { action: { contains: "HOLD_", mode: "insensitive" } },
          { action: { contains: "STATEMENT", mode: "insensitive" } },
        ],
      };
    case "access":
      return {
        OR: [
          { action: { contains: "RESTRICT", mode: "insensitive" } },
          { action: { contains: "FREEZE", mode: "insensitive" } },
          { action: { contains: "FROZEN", mode: "insensitive" } },
          { action: { contains: "MAINTENANCE", mode: "insensitive" } },
          { action: { contains: "CREDIT_DESK", mode: "insensitive" } },
        ],
      };
    case "jobs":
      return {
        OR: [
          { action: { contains: "OPS_JOB", mode: "insensitive" } },
          { action: { contains: "JOB_RUN", mode: "insensitive" } },
          { action: { contains: "SERVICING", mode: "insensitive" } },
          { action: { contains: "RECONCILIATION", mode: "insensitive" } },
        ],
      };
    case "alerts":
      return {
        OR: [
          { action: { contains: "STAFF_AUDIT", mode: "insensitive" } },
          { action: { contains: "STAFF_ALERT", mode: "insensitive" } },
          { action: { contains: "NOTIFICATION", mode: "insensitive" } },
        ],
      };
    case "other":
      return null;
    default:
      return null;
  }
}

function buildAuditWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { actor: { discordUsername: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const actor = filters.actor?.trim();
  if (actor) {
    and.push({ actor: { discordUsername: { contains: actor, mode: "insensitive" } } });
  }

  if (filters.action) and.push({ action: filters.action });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.entityId) and.push({ entityId: filters.entityId });
  if (filters.actorUserId) and.push({ actorUserId: filters.actorUserId });
  if (filters.targetUserId) and.push({ targetUserId: filters.targetUserId });
  if (filters.targetAccountId) and.push({ targetAccountId: filters.targetAccountId });
  if (filters.targetCompanyId) and.push({ targetCompanyId: filters.targetCompanyId });

  if (filters.from) {
    and.push({ createdAt: { gte: new Date(filters.from) } });
  }
  if (filters.to) {
    and.push({ createdAt: { lte: new Date(filters.to) } });
  }

  if (filters.view !== "all") {
    and.push({ action: { notIn: MEANINGFUL_VIEW_EXCLUDED_ACTIONS } });
  }

  if (filters.category && filters.category !== "other") {
    const cat = categoryActionWhere(filters.category);
    if (cat) and.push(cat);
  }

  return and.length > 0 ? { AND: and } : {};
}

async function resolveTargetUsernames(rows: { targetUserId: string | null }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.targetUserId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, discordUsername: true },
  });
  return new Map(users.map((u) => [u.id, u.discordUsername]));
}

async function resolveAuditAccounts(rows: AuditRowRecord[]): Promise<{
  accounts: Map<string, AccountRef>;
  transactionAccountIds: Map<string, string>;
}> {
  const accountIds = new Set<string>();
  const transactionIds: string[] = [];

  for (const row of rows) {
    if (row.targetAccountId) accountIds.add(row.targetAccountId);
    if (row.entityType === "BANK_ACCOUNT" && row.entityId) accountIds.add(row.entityId);
    if (row.targetTransactionId) transactionIds.push(row.targetTransactionId);
  }

  const transactionAccountIds = new Map<string, string>();
  if (transactionIds.length > 0) {
    const transactions = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds } },
      select: { id: true, bankAccountId: true },
    });
    for (const tx of transactions) {
      transactionAccountIds.set(tx.id, tx.bankAccountId);
      accountIds.add(tx.bankAccountId);
    }
  }

  if (accountIds.size === 0) {
    return { accounts: new Map(), transactionAccountIds };
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { id: { in: [...accountIds] } },
    select: { id: true, accountNumber: true, accountName: true },
  });

  return {
    accounts: new Map(accounts.map((a) => [a.id, a])),
    transactionAccountIds,
  };
}

function accountForAuditRow(
  row: AuditRowRecord,
  accounts: Map<string, AccountRef>,
  transactionAccountIds: Map<string, string>,
): AccountRef | null {
  if (row.targetAccountId) {
    const account = accounts.get(row.targetAccountId);
    if (account) return account;
  }
  if (row.entityType === "BANK_ACCOUNT" && row.entityId) {
    const account = accounts.get(row.entityId);
    if (account) return account;
  }
  if (row.targetTransactionId) {
    const bankAccountId = transactionAccountIds.get(row.targetTransactionId);
    if (bankAccountId) {
      const account = accounts.get(bankAccountId);
      if (account) return account;
    }
  }
  return null;
}

async function mapAuditRows(rows: AuditRowRecord[]): Promise<AuditLogRow[]> {
  const [targetMap, { accounts, transactionAccountIds }] = await Promise.all([
    resolveTargetUsernames(rows),
    resolveAuditAccounts(rows),
  ]);

  return rows.map((row) =>
    mapAuditRow(
      row,
      row.targetUserId ? targetMap.get(row.targetUserId) ?? null : null,
      accountForAuditRow(row, accounts, transactionAccountIds),
    ),
  );
}

export async function listRecentAuditLogs(limit = 25): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return mapAuditRows(rows);
}

export async function queryAuditLogs(
  filters: AuditLogFilters,
  limit = 50,
): Promise<import("@/lib/internal/audit.types").AuditLogPage> {
  const pageSize = Math.min(Math.max(filters.limit ?? limit, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = buildAuditWhere(filters);
  const rows = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    skip: offset,
  });
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    rows: await mapAuditRows(pageRows),
    offset,
    limit: pageSize,
    hasMore,
  };
}

export async function listAuditLogsForTarget(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType, entityId },
        { targetUserId: entityId },
        { targetAccountId: entityId },
        { targetCompanyId: entityId },
        { targetLoanId: entityId },
        { targetTransactionId: entityId },
      ],
    },
    include: { actor: { select: { discordUsername: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return mapAuditRows(rows);
}

export async function resolveAccountsByAuditLogId(
  rows: Array<{
    id: string;
    targetAccountId: string | null;
    entityType: AuditEntityType;
    entityId: string | null;
    targetTransactionId: string | null;
  }>,
): Promise<Map<string, AccountRef>> {
  const { accounts, transactionAccountIds } = await resolveAuditAccounts(
    rows as AuditRowRecord[],
  );
  const result = new Map<string, AccountRef>();
  for (const row of rows) {
    const account = accountForAuditRow(row as AuditRowRecord, accounts, transactionAccountIds);
    if (account) result.set(row.id, account);
  }
  return result;
}
