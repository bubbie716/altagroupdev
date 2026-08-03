import type { AltaUser } from "@/lib/auth/types";
import {
  canArchiveCompanyTerminalPortfolio,
  canCreateCompanyTerminalPortfolio,
  canRenameCompanyTerminalPortfolio,
  canTradeCompanyTerminalPortfolio,
  canViewCompanyTerminalPortfolio,
  companyPortfolioCapabilities,
  personalPortfolioCapabilities,
} from "@/lib/terminal/portfolio-auth";
import type { TerminalPortfolioSummary } from "@/lib/terminal/types";
import { serializeMoney } from "@/lib/terminal/terminal-decimal";

export type TerminalPortfolioRecord = {
  id: string;
  name: string;
  ownerType: "personal" | "company";
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  ownerLabel: string;
  createdByUserId: string;
  status: "active" | "archived";
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export class TerminalPersistenceUnavailableError extends Error {
  readonly code = "terminal_persistence_unavailable" as const;
  constructor(message = "Terminal database is unavailable") {
    super(message);
    this.name = "TerminalPersistenceUnavailableError";
  }
}

export class TerminalPortfolioAccessError extends Error {
  readonly code = "terminal_portfolio_access_denied" as const;
  constructor(message = "Portfolio not found or access denied") {
    super(message);
    this.name = "TerminalPortfolioAccessError";
  }
}

function assertExactlyOneOwner(input: {
  ownerType: "personal" | "company";
  ownerUserId?: string | null;
  ownerCompanyId?: string | null;
}) {
  if (input.ownerType === "personal") {
    if (!input.ownerUserId || input.ownerCompanyId) {
      throw new Error("Personal portfolios require ownerUserId and no ownerCompanyId");
    }
    return;
  }
  if (!input.ownerCompanyId || input.ownerUserId) {
    throw new Error("Company portfolios require ownerCompanyId and no ownerUserId");
  }
}

async function requirePrisma() {
  const { isDatabaseConfigured, prisma } = await import("@/server/db");
  if (!isDatabaseConfigured()) {
    throw new TerminalPersistenceUnavailableError();
  }
  return prisma;
}

function mapDbError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2021" ||
      (error as { code?: string }).code === "P2010")
  ) {
    throw new TerminalPersistenceUnavailableError("Terminal tables are not migrated yet");
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/terminalportfolio|does not exist|relation .* does not exist/i.test(message)) {
    throw new TerminalPersistenceUnavailableError("Terminal tables are not migrated yet");
  }
  throw error;
}

function toSummary(
  record: TerminalPortfolioRecord,
  user: AltaUser,
  values?: {
    totalValue?: number | null;
    dayChange?: number | null;
    dayChangePercent?: number | null;
    cashBalance?: number | null;
    valuationAvailable?: boolean;
  },
): TerminalPortfolioSummary {
  const capabilities =
    record.ownerType === "personal"
      ? personalPortfolioCapabilities()
      : companyPortfolioCapabilities(user, record.ownerCompanyId!);

  return {
    id: record.id,
    name: record.name,
    ownerType: record.ownerType,
    ownerUserId: record.ownerUserId,
    ownerCompanyId: record.ownerCompanyId,
    ownerLabel: record.ownerLabel,
    status: record.status,
    isDefault: record.isDefault,
    totalValue: values?.totalValue ?? values?.cashBalance ?? null,
    dayChange: values?.dayChange ?? null,
    dayChangePercent: values?.dayChangePercent ?? null,
    valuationAvailable: values?.valuationAvailable ?? false,
    cashBalance: values?.cashBalance ?? null,
    capabilities,
  };
}

function userCanAccessRecord(user: AltaUser, record: TerminalPortfolioRecord): boolean {
  if (record.status !== "active") return false;
  if (record.ownerType === "personal") {
    return record.ownerUserId === user.id;
  }
  return Boolean(
    record.ownerCompanyId && canViewCompanyTerminalPortfolio(user, record.ownerCompanyId),
  );
}

function rowToRecord(row: {
  id: string;
  name: string;
  ownerType: "PERSONAL" | "COMPANY";
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  createdByUserId: string;
  status: "ACTIVE" | "ARCHIVED";
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerCompany?: { name: string } | null;
}): TerminalPortfolioRecord {
  return {
    id: row.id,
    name: row.name,
    ownerType: row.ownerType === "PERSONAL" ? "personal" : "company",
    ownerUserId: row.ownerUserId,
    ownerCompanyId: row.ownerCompanyId,
    ownerLabel: row.ownerType === "PERSONAL" ? "Personal" : (row.ownerCompany?.name ?? "Company"),
    createdByUserId: row.createdByUserId,
    status: row.status === "ACTIVE" ? "active" : "archived",
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function listFromDb(user: AltaUser): Promise<TerminalPortfolioRecord[]> {
  const prisma = await requirePrisma();
  try {
    const companyIds = user.companyMemberships
      .filter((m) => canViewCompanyTerminalPortfolio(user, m.companyId))
      .map((m) => m.companyId);

    const rows = await prisma.terminalPortfolio.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { ownerType: "PERSONAL", ownerUserId: user.id },
          ...(companyIds.length
            ? [{ ownerType: "COMPANY" as const, ownerCompanyId: { in: companyIds } }]
            : []),
        ],
      },
      include: {
        ownerCompany: { select: { name: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return rows.map((row) => rowToRecord(row));
  } catch (error) {
    mapDbError(error);
  }
}

/**
 * Ensure existing portfolios have a zero cash account (idempotent app-level backfill).
 * Does not create fabricated activity, positions, orders, or watchlists.
 */
export async function ensurePortfolioCashAccount(portfolioId: string): Promise<void> {
  const prisma = await requirePrisma();
  try {
    await prisma.terminalPortfolioCashAccount.upsert({
      where: { portfolioId },
      create: {
        portfolioId,
        availableCash: 0,
        reservedCash: 0,
        currency: "FLORIN",
      },
      update: {},
    });
  } catch (error) {
    mapDbError(error);
  }
}

/**
 * Resolve invalid personal default combinations transactionally:
 * at most one default ACTIVE personal portfolio per user — keep oldest by createdAt.
 */
export async function repairPersonalDefaultPortfolios(userId: string): Promise<void> {
  const prisma = await requirePrisma();
  try {
    await prisma.$transaction(async (tx) => {
      const personal = await tx.terminalPortfolio.findMany({
        where: { ownerType: "PERSONAL", ownerUserId: userId, status: "ACTIVE" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, isDefault: true },
      });
      if (personal.length === 0) return;
      const defaults = personal.filter((p) => p.isDefault);
      const keepId = defaults[0]?.id ?? personal[0]!.id;
      for (const row of personal) {
        const shouldDefault = row.id === keepId;
        if (row.isDefault !== shouldDefault) {
          await tx.terminalPortfolio.update({
            where: { id: row.id },
            data: { isDefault: shouldDefault },
          });
        }
      }
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function listAccessibleTerminalPortfolios(
  user: AltaUser,
): Promise<TerminalPortfolioSummary[]> {
  // Intentionally does NOT auto-create portfolios — new users see an empty state.
  const records = await listFromDb(user);
  const prisma = await requirePrisma();

  const cashByPortfolio = new Map<string, number>();
  try {
    const accounts = await prisma.terminalPortfolioCashAccount.findMany({
      where: { portfolioId: { in: records.map((r) => r.id) } },
      select: { portfolioId: true, availableCash: true },
    });
    for (const account of accounts) {
      cashByPortfolio.set(account.portfolioId, serializeMoney(account.availableCash));
    }
  } catch {
    // Cash foundation table may be missing until migration is applied.
    // Portfolio metadata remains available; cash stays null/0.
  }

  return records
    .filter((r) => userCanAccessRecord(user, r))
    .map((r) =>
      toSummary(r, user, {
        cashBalance: cashByPortfolio.get(r.id) ?? 0,
        valuationAvailable: false,
        totalValue: null,
        dayChange: null,
        dayChangePercent: null,
      }),
    );
}

export async function resolveTerminalPortfolioId(
  user: AltaUser,
  requestedId?: string | null,
): Promise<string | null> {
  const accessible = await listAccessibleTerminalPortfolios(user);
  if (accessible.length === 0) return null;

  if (requestedId) {
    const match = accessible.find((p) => p.id === requestedId);
    if (!match) throw new TerminalPortfolioAccessError();
    return match.id;
  }

  const prisma = await requirePrisma();
  try {
    const settings = await prisma.userTerminalSettings.findUnique({ where: { userId: user.id } });
    if (settings?.lastSelectedPortfolioId) {
      const recent = accessible.find((p) => p.id === settings.lastSelectedPortfolioId);
      if (recent) return recent.id;
    }
  } catch (error) {
    mapDbError(error);
  }

  const defaultPortfolio = accessible.find((p) => p.isDefault);
  if (defaultPortfolio) return defaultPortfolio.id;
  return accessible[0]?.id ?? null;
}

export async function rememberSelectedTerminalPortfolio(user: AltaUser, portfolioId: string) {
  const accessible = await listAccessibleTerminalPortfolios(user);
  if (!accessible.some((p) => p.id === portfolioId)) {
    throw new TerminalPortfolioAccessError();
  }

  const prisma = await requirePrisma();
  try {
    await prisma.userTerminalSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastSelectedPortfolioId: portfolioId },
      update: { lastSelectedPortfolioId: portfolioId },
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function getTerminalPortfolioForUser(
  user: AltaUser,
  portfolioId: string,
): Promise<TerminalPortfolioSummary> {
  const accessible = await listAccessibleTerminalPortfolios(user);
  const match = accessible.find((p) => p.id === portfolioId);
  if (!match) throw new TerminalPortfolioAccessError();
  return match;
}

/** Includes archived portfolios the user may still view for history (not selectable). */
export async function getTerminalPortfolioRecordIncludingArchived(
  user: AltaUser,
  portfolioId: string,
): Promise<TerminalPortfolioRecord | null> {
  const prisma = await requirePrisma();
  try {
    const row = await prisma.terminalPortfolio.findUnique({
      where: { id: portfolioId },
      include: { ownerCompany: { select: { name: true } } },
    });
    if (!row) return null;
    const record = rowToRecord(row);
    if (record.ownerType === "personal") {
      if (record.ownerUserId !== user.id) return null;
    } else if (
      !record.ownerCompanyId ||
      !canViewCompanyTerminalPortfolio(user, record.ownerCompanyId)
    ) {
      return null;
    }
    return record;
  } catch (error) {
    mapDbError(error);
  }
}

export type CreateTerminalPortfolioInput = {
  name: string;
  ownerType: "personal" | "company";
  ownerCompanyId?: string | null;
};

export async function createTerminalPortfolio(
  user: AltaUser,
  input: CreateTerminalPortfolioInput,
): Promise<TerminalPortfolioSummary> {
  const name = input.name.trim();
  if (!name) throw new Error("Portfolio name is required");

  if (input.ownerType === "personal") {
    assertExactlyOneOwner({ ownerType: "personal", ownerUserId: user.id, ownerCompanyId: null });
  } else {
    if (!input.ownerCompanyId) throw new Error("Company is required");
    if (!canCreateCompanyTerminalPortfolio(user, input.ownerCompanyId)) {
      throw new Error("Not authorized to create a company portfolio");
    }
    assertExactlyOneOwner({
      ownerType: "company",
      ownerUserId: null,
      ownerCompanyId: input.ownerCompanyId,
    });
  }

  const ownerLabel =
    input.ownerType === "personal"
      ? "Personal"
      : (user.companyMemberships.find((m) => m.companyId === input.ownerCompanyId)?.companyName ??
        "Company");

  const prisma = await requirePrisma();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const personalCount =
        input.ownerType === "personal"
          ? await tx.terminalPortfolio.count({
              where: { ownerType: "PERSONAL", ownerUserId: user.id, status: "ACTIVE" },
            })
          : 0;

      const created = await tx.terminalPortfolio.create({
        data: {
          name,
          ownerType: input.ownerType === "personal" ? "PERSONAL" : "COMPANY",
          ownerUserId: input.ownerType === "personal" ? user.id : null,
          ownerCompanyId: input.ownerType === "company" ? input.ownerCompanyId! : null,
          createdByUserId: user.id,
          isDefault: input.ownerType === "personal" && personalCount === 0,
          status: "ACTIVE",
          cashAccount: {
            create: {
              availableCash: 0,
              reservedCash: 0,
              currency: "FLORIN",
            },
          },
        },
        include: { ownerCompany: { select: { name: true } }, cashAccount: true },
      });

      // Ensure at most one personal default remains if a race created another.
      if (input.ownerType === "personal" && created.isDefault) {
        await tx.terminalPortfolio.updateMany({
          where: {
            ownerType: "PERSONAL",
            ownerUserId: user.id,
            status: "ACTIVE",
            isDefault: true,
            NOT: { id: created.id },
          },
          data: { isDefault: false },
        });
      }

      return created;
    });

    // After commit: enqueue Terminal Investor grant (never sync Discord inside the tx).
    void import("@/server/discord-product-role.service")
      .then(({ enqueueTerminalInvestorRoleGrantAfterActivation }) =>
        enqueueTerminalInvestorRoleGrantAfterActivation({
          altaUserId: user.id,
          portfolioId: row.id,
          actorUserId: user.id,
          reason: "terminal_portfolio_activated",
        }),
      )
      .catch(() => {});

    return toSummary(
      {
        id: row.id,
        name: row.name,
        ownerType: input.ownerType,
        ownerUserId: row.ownerUserId,
        ownerCompanyId: row.ownerCompanyId,
        ownerLabel:
          input.ownerType === "personal" ? "Personal" : (row.ownerCompany?.name ?? ownerLabel),
        createdByUserId: row.createdByUserId,
        status: "active",
        isDefault: row.isDefault,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      user,
      {
        cashBalance: 0,
        valuationAvailable: false,
        totalValue: null,
        dayChange: null,
        dayChangePercent: null,
      },
    );
  } catch (error) {
    mapDbError(error);
  }
}

export async function renameTerminalPortfolio(
  user: AltaUser,
  portfolioId: string,
  name: string,
): Promise<TerminalPortfolioSummary> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Portfolio name is required");
  const current = await getTerminalPortfolioForUser(user, portfolioId);
  if (!current.capabilities.canRename) throw new Error("Not authorized to rename this portfolio");
  if (current.ownerType === "company" && current.ownerCompanyId) {
    if (!canRenameCompanyTerminalPortfolio(user, current.ownerCompanyId)) {
      throw new Error("Not authorized to rename this portfolio");
    }
  }

  const prisma = await requirePrisma();
  try {
    const row = await prisma.terminalPortfolio.update({
      where: { id: portfolioId },
      data: { name: trimmed },
      include: {
        ownerCompany: { select: { name: true } },
        cashAccount: { select: { availableCash: true } },
      },
    });
    return toSummary(rowToRecord(row), user, {
      cashBalance: row.cashAccount ? serializeMoney(row.cashAccount.availableCash) : 0,
      valuationAvailable: false,
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function archiveTerminalPortfolio(
  user: AltaUser,
  portfolioId: string,
): Promise<TerminalPortfolioSummary> {
  const current = await getTerminalPortfolioForUser(user, portfolioId);
  if (!current.capabilities.canArchive) throw new Error("Not authorized to archive this portfolio");
  if (current.ownerType === "company" && current.ownerCompanyId) {
    if (!canArchiveCompanyTerminalPortfolio(user, current.ownerCompanyId)) {
      throw new Error("Not authorized to archive this portfolio");
    }
  }

  const prisma = await requirePrisma();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const archived = await tx.terminalPortfolio.update({
        where: { id: portfolioId },
        data: { status: "ARCHIVED", isDefault: false },
        include: {
          ownerCompany: { select: { name: true } },
          cashAccount: { select: { availableCash: true } },
        },
      });

      // Clear last-selected pointers so archived portfolios cannot remain selected.
      await tx.userTerminalSettings.updateMany({
        where: { lastSelectedPortfolioId: portfolioId },
        data: { lastSelectedPortfolioId: null },
      });

      // If this was the personal default, promote the oldest remaining active personal portfolio.
      if (archived.ownerType === "PERSONAL" && archived.ownerUserId) {
        const nextDefault = await tx.terminalPortfolio.findFirst({
          where: {
            ownerType: "PERSONAL",
            ownerUserId: archived.ownerUserId,
            status: "ACTIVE",
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (nextDefault && !nextDefault.isDefault) {
          await tx.terminalPortfolio.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }

      return archived;
    });

    // Conservative: never auto-revoke Investor on archive — pending reconcile only.
    const affectedUserIds = new Set<string>();
    if (row.ownerUserId) affectedUserIds.add(row.ownerUserId);
    if (row.createdByUserId) affectedUserIds.add(row.createdByUserId);
    affectedUserIds.add(user.id);
    void import("@/server/discord-product-role.service")
      .then(async ({ surfaceTerminalInvestorIneligibilityPendingReconcile }) => {
        for (const altaUserId of affectedUserIds) {
          await surfaceTerminalInvestorIneligibilityPendingReconcile({
            altaUserId,
            portfolioId: portfolioId,
            actorUserId: user.id,
            reason: "terminal_portfolio_archived_pending_reconcile",
          });
        }
      })
      .catch(() => {});

    return toSummary(
      {
        ...rowToRecord(row),
        status: "archived",
        isDefault: false,
      },
      user,
      {
        cashBalance: row.cashAccount ? serializeMoney(row.cashAccount.availableCash) : 0,
        valuationAvailable: false,
      },
    );
  } catch (error) {
    mapDbError(error);
  }
}

export function assertCanTradePortfolio(user: AltaUser, portfolio: TerminalPortfolioSummary) {
  if (portfolio.status !== "active") {
    throw new Error("Archived portfolios cannot be traded");
  }
  if (!portfolio.capabilities.canTrade) {
    throw new Error("Not authorized to trade this portfolio");
  }
  if (portfolio.ownerType === "company" && portfolio.ownerCompanyId) {
    if (!canTradeCompanyTerminalPortfolio(user, portfolio.ownerCompanyId)) {
      throw new Error("Not authorized to trade this portfolio");
    }
  }
}

export function eligibleCompaniesForPortfolioCreate(user: AltaUser) {
  return user.companyMemberships
    .filter((m) => canCreateCompanyTerminalPortfolio(user, m.companyId))
    .map((m) => ({
      id: m.companyId,
      name: m.companyName,
      ticker: m.companyTicker,
    }));
}
