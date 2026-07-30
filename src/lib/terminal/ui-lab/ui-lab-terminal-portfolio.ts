/**
 * UI Lab ONLY — in-memory portfolio metadata for demonstration previews.
 * Never writes to PostgreSQL. Gated by isUiLabMode().
 */
import type { AltaUser } from "@/lib/auth/types";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import {
  canCreateCompanyTerminalPortfolio,
  canViewCompanyTerminalPortfolio,
  companyPortfolioCapabilities,
  personalPortfolioCapabilities,
} from "@/lib/terminal/portfolio-auth";
import { mockPortfolioIds } from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";
import type { TerminalPortfolioSummary } from "@/lib/terminal/types";

export type UiLabPortfolioRecord = {
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

type Store = {
  portfolios: UiLabPortfolioRecord[];
  lastSelectedByUser: Map<string, string>;
};

const stores = new Map<string, Store>();

function assertUiLab() {
  if (!isUiLabMode()) {
    throw new Error("UI Lab Terminal portfolio store is only available in UI Lab mode");
  }
}

function nowIso() {
  return new Date().toISOString();
}

function seed(user: AltaUser): Store {
  const ids = mockPortfolioIds(user.id);
  const ts = nowIso();
  const portfolios: UiLabPortfolioRecord[] = [
    {
      id: ids.personalCore,
      name: "Core Portfolio",
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
      name: "Growth Portfolio",
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
    {
      id: ids.personalIncome,
      name: "Income Portfolio",
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
    {
      id: ids.personalActive,
      name: "Active Trading",
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
      name: "ALTG Treasury",
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

  const store: Store = {
    portfolios,
    lastSelectedByUser: new Map([[user.id, ids.personalCore]]),
  };
  stores.set(user.id, store);
  return store;
}

function getStore(user: AltaUser): Store {
  assertUiLab();
  return stores.get(user.id) ?? seed(user);
}

function toSummary(record: UiLabPortfolioRecord, user: AltaUser): TerminalPortfolioSummary {
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
    totalValue: null,
    dayChange: null,
    dayChangePercent: null,
    valuationAvailable: false,
    cashBalance: null,
    capabilities,
  };
}

function canAccess(user: AltaUser, record: UiLabPortfolioRecord): boolean {
  if (record.status !== "active") return false;
  if (record.ownerType === "personal") return record.ownerUserId === user.id;
  return Boolean(
    record.ownerCompanyId && canViewCompanyTerminalPortfolio(user, record.ownerCompanyId),
  );
}

export function listUiLabTerminalPortfolios(user: AltaUser): TerminalPortfolioSummary[] {
  return getStore(user)
    .portfolios.filter((r) => canAccess(user, r))
    .map((r) => toSummary(r, user));
}

export function resolveUiLabTerminalPortfolioId(
  user: AltaUser,
  requestedId?: string | null,
): string | null {
  const accessible = listUiLabTerminalPortfolios(user);
  if (accessible.length === 0) return null;
  if (requestedId) {
    const match = accessible.find((p) => p.id === requestedId);
    if (!match) throw new Error("Portfolio not found or access denied");
    return match.id;
  }
  const recent = getStore(user).lastSelectedByUser.get(user.id);
  if (recent && accessible.some((p) => p.id === recent)) return recent;
  return accessible.find((p) => p.isDefault)?.id ?? accessible[0]?.id ?? null;
}

export function rememberUiLabSelectedPortfolio(user: AltaUser, portfolioId: string) {
  const accessible = listUiLabTerminalPortfolios(user);
  if (!accessible.some((p) => p.id === portfolioId)) {
    throw new Error("Portfolio not found or access denied");
  }
  getStore(user).lastSelectedByUser.set(user.id, portfolioId);
}

export function getUiLabTerminalPortfolio(
  user: AltaUser,
  portfolioId: string,
): TerminalPortfolioSummary {
  const match = listUiLabTerminalPortfolios(user).find((p) => p.id === portfolioId);
  if (!match) throw new Error("Portfolio not found or access denied");
  return match;
}

export function createUiLabTerminalPortfolio(
  user: AltaUser,
  input: { name: string; ownerType: "personal" | "company"; ownerCompanyId?: string | null },
): TerminalPortfolioSummary {
  assertUiLab();
  const name = input.name.trim();
  if (!name) throw new Error("Portfolio name is required");
  if (input.ownerType === "company") {
    if (!input.ownerCompanyId) throw new Error("Company is required");
    if (!canCreateCompanyTerminalPortfolio(user, input.ownerCompanyId)) {
      throw new Error("Not authorized to create a company portfolio");
    }
  }
  const store = getStore(user);
  const personalActive = store.portfolios.filter(
    (p) => p.ownerType === "personal" && p.ownerUserId === user.id && p.status === "active",
  );
  const ts = nowIso();
  const record: UiLabPortfolioRecord = {
    id: `tp_${user.id}_${Date.now().toString(36)}`,
    name,
    ownerType: input.ownerType,
    ownerUserId: input.ownerType === "personal" ? user.id : null,
    ownerCompanyId: input.ownerType === "company" ? input.ownerCompanyId! : null,
    ownerLabel:
      input.ownerType === "personal"
        ? "Personal"
        : (user.companyMemberships.find((m) => m.companyId === input.ownerCompanyId)?.companyName ??
          "Company"),
    createdByUserId: user.id,
    status: "active",
    isDefault: input.ownerType === "personal" && personalActive.length === 0,
    createdAt: ts,
    updatedAt: ts,
  };
  store.portfolios.push(record);
  return toSummary(record, user);
}

export function renameUiLabTerminalPortfolio(
  user: AltaUser,
  portfolioId: string,
  name: string,
): TerminalPortfolioSummary {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Portfolio name is required");
  const current = getUiLabTerminalPortfolio(user, portfolioId);
  if (!current.capabilities.canRename) throw new Error("Not authorized to rename this portfolio");
  const record = getStore(user).portfolios.find((p) => p.id === portfolioId);
  if (!record) throw new Error("Portfolio not found or access denied");
  record.name = trimmed;
  record.updatedAt = nowIso();
  return toSummary(record, user);
}

export function archiveUiLabTerminalPortfolio(
  user: AltaUser,
  portfolioId: string,
): TerminalPortfolioSummary {
  const current = getUiLabTerminalPortfolio(user, portfolioId);
  if (!current.capabilities.canArchive) throw new Error("Not authorized to archive this portfolio");
  const record = getStore(user).portfolios.find((p) => p.id === portfolioId);
  if (!record) throw new Error("Portfolio not found or access denied");
  record.status = "archived";
  record.isDefault = false;
  record.updatedAt = nowIso();
  return toSummary(record, user);
}

export function resetUiLabTerminalPortfoliosForTests() {
  stores.clear();
}
