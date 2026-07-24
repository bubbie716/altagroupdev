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
import { mockPortfolioIds } from "@/lib/terminal/terminal-fixtures";
import type { TerminalPortfolioSummary } from "@/lib/terminal/types";

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

type MemoryStore = {
  portfolios: TerminalPortfolioRecord[];
  lastSelectedByUser: Map<string, string>;
};

const memoryByUser = new Map<string, MemoryStore>();

function nowIso() {
  return new Date().toISOString();
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

function seedMemoryStore(user: AltaUser): MemoryStore {
  const ids = mockPortfolioIds(user.id);
  const ts = nowIso();
  const portfolios: TerminalPortfolioRecord[] = [
    {
      id: ids.personalCore,
      name: "Core",
      ownerType: "personal",
      ownerUserId: user.id,
      ownerCompanyId: null,
      ownerLabel: "Personal",
      createdByUserId: user.id,
      status: "active",
      isDefault: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.personalGrowth,
      name: "Growth",
      ownerType: "personal",
      ownerUserId: user.id,
      ownerCompanyId: null,
      ownerLabel: "Personal",
      createdByUserId: user.id,
      status: "active",
      isDefault: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  const altg = user.companyMemberships.find((m) => m.companyId === "CO-ALTG");
  if (altg && canViewCompanyTerminalPortfolio(user, altg.companyId)) {
    portfolios.push({
      id: ids.companyAltg,
      name: "Treasury",
      ownerType: "company",
      ownerUserId: null,
      ownerCompanyId: altg.companyId,
      ownerLabel: altg.companyName,
      createdByUserId: user.id,
      status: "active",
      isDefault: false,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const store: MemoryStore = {
    portfolios,
    lastSelectedByUser: new Map([[user.id, ids.personalCore]]),
  };
  memoryByUser.set(user.id, store);
  return store;
}

function getMemoryStore(user: AltaUser): MemoryStore {
  return memoryByUser.get(user.id) ?? seedMemoryStore(user);
}

/** Test helper — clears in-memory portfolio metadata. */
export function resetTerminalPortfolioMemoryForTests() {
  memoryByUser.clear();
}

/** Prefer Prisma when configured; tests may force memory via TERMINAL_PORTFOLIO_STORE=memory. */
async function isPortfolioDatabaseAvailable(): Promise<boolean> {
  if (process.env.TERMINAL_PORTFOLIO_STORE === "memory") return false;
  try {
    const { isDatabaseConfigured } = await import("@/server/db");
    return isDatabaseConfigured();
  } catch {
    return false;
  }
}

function isMissingTerminalPortfolioTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

function toSummary(
  record: TerminalPortfolioRecord,
  user: AltaUser,
  values?: { totalValue?: number; dayChange?: number; dayChangePercent?: number },
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
    totalValue: values?.totalValue ?? 0,
    dayChange: values?.dayChange ?? 0,
    dayChangePercent: values?.dayChangePercent ?? 0,
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

async function listFromDb(user: AltaUser): Promise<TerminalPortfolioRecord[]> {
  const { prisma } = await import("@/server/db");
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
    include: { ownerCompany: { select: { name: true } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerType: row.ownerType === "PERSONAL" ? ("personal" as const) : ("company" as const),
    ownerUserId: row.ownerUserId,
    ownerCompanyId: row.ownerCompanyId,
    ownerLabel: row.ownerType === "PERSONAL" ? "Personal" : (row.ownerCompany?.name ?? "Company"),
    createdByUserId: row.createdByUserId,
    status: row.status === "ACTIVE" ? ("active" as const) : ("archived" as const),
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function ensureDbDefaults(user: AltaUser): Promise<void> {
  const { prisma } = await import("@/server/db");
  const existing = await prisma.terminalPortfolio.count({
    where: { ownerType: "PERSONAL", ownerUserId: user.id, status: "ACTIVE" },
  });
  if (existing > 0) return;

  await prisma.terminalPortfolio.create({
    data: {
      name: "Core",
      ownerType: "PERSONAL",
      ownerUserId: user.id,
      createdByUserId: user.id,
      isDefault: true,
      status: "ACTIVE",
    },
  });
}

export async function listAccessibleTerminalPortfolios(
  user: AltaUser,
): Promise<TerminalPortfolioSummary[]> {
  if (await isPortfolioDatabaseAvailable()) {
    try {
      await ensureDbDefaults(user);
      const records = await listFromDb(user);
      return records.filter((r) => userCanAccessRecord(user, r)).map((r) => toSummary(r, user));
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
    }
  }

  const store = getMemoryStore(user);
  return store.portfolios
    .filter((r) => userCanAccessRecord(user, r))
    .map((r) => toSummary(r, user));
}

export async function resolveTerminalPortfolioId(
  user: AltaUser,
  requestedId?: string | null,
): Promise<string | null> {
  const accessible = await listAccessibleTerminalPortfolios(user);
  if (accessible.length === 0) return null;

  if (requestedId) {
    const match = accessible.find((p) => p.id === requestedId);
    if (!match) {
      throw new Error("Portfolio not found or access denied");
    }
    return match.id;
  }

  if (await isPortfolioDatabaseAvailable()) {
    try {
      const { prisma } = await import("@/server/db");
      const settings = await prisma.userTerminalSettings.findUnique({ where: { userId: user.id } });
      if (settings?.lastSelectedPortfolioId) {
        const recent = accessible.find((p) => p.id === settings.lastSelectedPortfolioId);
        if (recent) return recent.id;
      }
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
      const store = getMemoryStore(user);
      const recentId = store.lastSelectedByUser.get(user.id);
      if (recentId && accessible.some((p) => p.id === recentId)) return recentId;
    }
  } else {
    const store = getMemoryStore(user);
    const recentId = store.lastSelectedByUser.get(user.id);
    if (recentId && accessible.some((p) => p.id === recentId)) return recentId;
  }

  const defaultPortfolio = accessible.find((p) => p.isDefault);
  if (defaultPortfolio) return defaultPortfolio.id;
  return accessible[0]?.id ?? null;
}

export async function rememberSelectedTerminalPortfolio(user: AltaUser, portfolioId: string) {
  const accessible = await listAccessibleTerminalPortfolios(user);
  if (!accessible.some((p) => p.id === portfolioId)) {
    throw new Error("Portfolio not found or access denied");
  }

  if (await isPortfolioDatabaseAvailable()) {
    try {
      const { prisma } = await import("@/server/db");
      await prisma.userTerminalSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, lastSelectedPortfolioId: portfolioId },
        update: { lastSelectedPortfolioId: portfolioId },
      });
      return;
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
    }
  }

  getMemoryStore(user).lastSelectedByUser.set(user.id, portfolioId);
}

export async function getTerminalPortfolioForUser(
  user: AltaUser,
  portfolioId: string,
): Promise<TerminalPortfolioSummary> {
  const accessible = await listAccessibleTerminalPortfolios(user);
  const match = accessible.find((p) => p.id === portfolioId);
  if (!match) throw new Error("Portfolio not found or access denied");
  return match;
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

  if (await isPortfolioDatabaseAvailable()) {
    try {
      const { prisma } = await import("@/server/db");
      const personalCount = await prisma.terminalPortfolio.count({
        where: { ownerType: "PERSONAL", ownerUserId: user.id, status: "ACTIVE" },
      });
      const row = await prisma.terminalPortfolio.create({
        data: {
          name,
          ownerType: input.ownerType === "personal" ? "PERSONAL" : "COMPANY",
          ownerUserId: input.ownerType === "personal" ? user.id : null,
          ownerCompanyId: input.ownerType === "company" ? input.ownerCompanyId! : null,
          createdByUserId: user.id,
          isDefault: input.ownerType === "personal" && personalCount === 0,
          status: "ACTIVE",
        },
        include: { ownerCompany: { select: { name: true } } },
      });
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
      );
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
    }
  }

  const store = getMemoryStore(user);
  const personalActive = store.portfolios.filter(
    (p) => p.ownerType === "personal" && p.ownerUserId === user.id && p.status === "active",
  );
  const id = `tp_${user.id}_${Date.now().toString(36)}`;
  const ts = nowIso();
  const record: TerminalPortfolioRecord = {
    id,
    name,
    ownerType: input.ownerType,
    ownerUserId: input.ownerType === "personal" ? user.id : null,
    ownerCompanyId: input.ownerType === "company" ? input.ownerCompanyId! : null,
    ownerLabel,
    createdByUserId: user.id,
    status: "active",
    isDefault: input.ownerType === "personal" && personalActive.length === 0,
    createdAt: ts,
    updatedAt: ts,
  };
  store.portfolios.push(record);
  return toSummary(record, user);
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

  if (await isPortfolioDatabaseAvailable()) {
    try {
      const { prisma } = await import("@/server/db");
      const row = await prisma.terminalPortfolio.update({
        where: { id: portfolioId },
        data: { name: trimmed },
        include: { ownerCompany: { select: { name: true } } },
      });
      return toSummary(
        {
          id: row.id,
          name: row.name,
          ownerType: row.ownerType === "PERSONAL" ? "personal" : "company",
          ownerUserId: row.ownerUserId,
          ownerCompanyId: row.ownerCompanyId,
          ownerLabel:
            row.ownerType === "PERSONAL" ? "Personal" : (row.ownerCompany?.name ?? "Company"),
          createdByUserId: row.createdByUserId,
          status: row.status === "ACTIVE" ? "active" : "archived",
          isDefault: row.isDefault,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
        user,
      );
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
    }
  }

  const store = getMemoryStore(user);
  const record = store.portfolios.find((p) => p.id === portfolioId);
  if (!record) throw new Error("Portfolio not found or access denied");
  record.name = trimmed;
  record.updatedAt = nowIso();
  return toSummary(record, user);
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

  if (await isPortfolioDatabaseAvailable()) {
    try {
      const { prisma } = await import("@/server/db");
      const row = await prisma.terminalPortfolio.update({
        where: { id: portfolioId },
        data: { status: "ARCHIVED", isDefault: false },
        include: { ownerCompany: { select: { name: true } } },
      });
      return toSummary(
        {
          id: row.id,
          name: row.name,
          ownerType: row.ownerType === "PERSONAL" ? "personal" : "company",
          ownerUserId: row.ownerUserId,
          ownerCompanyId: row.ownerCompanyId,
          ownerLabel:
            row.ownerType === "PERSONAL" ? "Personal" : (row.ownerCompany?.name ?? "Company"),
          createdByUserId: row.createdByUserId,
          status: "archived",
          isDefault: false,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
        user,
      );
    } catch (error) {
      if (!isMissingTerminalPortfolioTable(error)) throw error;
    }
  }

  const store = getMemoryStore(user);
  const record = store.portfolios.find((p) => p.id === portfolioId);
  if (!record) throw new Error("Portfolio not found or access denied");
  record.status = "archived";
  record.isDefault = false;
  record.updatedAt = nowIso();
  return toSummary(record, user);
}

export function assertCanTradePortfolio(user: AltaUser, portfolio: TerminalPortfolioSummary) {
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
