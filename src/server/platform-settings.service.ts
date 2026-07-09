import type { AltaUser } from "@/lib/auth/types";
import { canBypassMaintenanceMode, isAdmin } from "@/lib/auth/permissions";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  PLATFORM_SETTING_KEYS,
  emptyMaintenanceScopeFlags,
  emptyMaintenanceScopeStartedAt,
  getActiveMaintenanceScopes,
  isAnyMaintenanceScopeActive,
  isMaintenanceActiveForSite,
  type MaintenanceModeSettings,
  type MaintenanceModeState,
  type MaintenanceScope,
  type MaintenanceScopeFlags,
} from "@/lib/platform/maintenance-types";
import type { SiteKey } from "@/config/sites";
import {
  PLATFORM_SETTING_KEYS as CREDIT_DESK_KEYS,
  type CreditDeskSettings,
  type CreditDeskState,
  type CreditDeskStatus,
  type CreditDeskCustomerNav,
} from "@/lib/platform/credit-desk-types";
import { CREDIT_DESK_SUBMISSION_BLOCKED } from "@/lib/platform/credit-desk-copy";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/permissions.service";

const MAINTENANCE_ENTITY_ID = "platform-maintenance";
const MAINTENANCE_KEYS = [
  PLATFORM_SETTING_KEYS.maintenanceModeEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeCorporateEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeBankEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeExchangeEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeTerminalEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeMarketsEnabled,
  PLATFORM_SETTING_KEYS.maintenanceModeMessage,
  PLATFORM_SETTING_KEYS.maintenanceModeStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeCorporateStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeBankStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeExchangeStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeTerminalStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeMarketsStartedAt,
  PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById,
] as const;

const SCOPE_ENABLED_KEY: Record<MaintenanceScope, keyof typeof PLATFORM_SETTING_KEYS> = {
  sitewide: "maintenanceModeEnabled",
  corporate: "maintenanceModeCorporateEnabled",
  bank: "maintenanceModeBankEnabled",
  exchange: "maintenanceModeExchangeEnabled",
  terminal: "maintenanceModeTerminalEnabled",
};

const SCOPE_STARTED_AT_KEY: Record<MaintenanceScope, keyof typeof PLATFORM_SETTING_KEYS> = {
  sitewide: "maintenanceModeStartedAt",
  corporate: "maintenanceModeCorporateStartedAt",
  bank: "maintenanceModeBankStartedAt",
  exchange: "maintenanceModeExchangeStartedAt",
  terminal: "maintenanceModeTerminalStartedAt",
};

let maintenanceGateCache: { scopes: MaintenanceScopeFlags; expiresAt: number } | null = null;
let maintenanceFullCache: { value: MaintenanceModeState; expiresAt: number } | null = null;

export function clearMaintenanceModeCache(): void {
  maintenanceGateCache = null;
  maintenanceFullCache = null;
}

async function readMaintenanceSettings(): Promise<
  Map<(typeof MAINTENANCE_KEYS)[number], { value: unknown; updatedAt: Date }>
> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: [...MAINTENANCE_KEYS] } },
    select: { key: true, value: true, updatedAt: true },
  });
  return new Map(
    rows.map((row) => [row.key as (typeof MAINTENANCE_KEYS)[number], { value: row.value, updatedAt: row.updatedAt }]),
  );
}

const GATE_CACHE_TTL_MS = 15_000;
const FULL_CACHE_TTL_MS = 10_000;

function parseMaintenanceScopeFlags(
  settings: Map<(typeof MAINTENANCE_KEYS)[number], { value: unknown; updatedAt: Date }>,
): MaintenanceScopeFlags {
  const marketsLegacy = parseBoolean(
    settings.get(PLATFORM_SETTING_KEYS.maintenanceModeMarketsEnabled)?.value,
  );
  const hasExchangeKey = settings.has(PLATFORM_SETTING_KEYS.maintenanceModeExchangeEnabled);
  const hasTerminalKey = settings.has(PLATFORM_SETTING_KEYS.maintenanceModeTerminalEnabled);

  return {
    sitewide: parseBoolean(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeEnabled)?.value),
    corporate: parseBoolean(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeCorporateEnabled)?.value),
    bank: parseBoolean(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeBankEnabled)?.value),
    exchange: hasExchangeKey
      ? parseBoolean(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeExchangeEnabled)?.value)
      : marketsLegacy,
    terminal: hasTerminalKey
      ? parseBoolean(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeTerminalEnabled)?.value)
      : marketsLegacy,
  };
}

function parseMaintenanceScopeStartedAt(
  settings: Map<(typeof MAINTENANCE_KEYS)[number], { value: unknown; updatedAt: Date }>,
): Record<MaintenanceScope, string | null> {
  const marketsLegacyStartedAt = parseIsoDate(
    settings.get(PLATFORM_SETTING_KEYS.maintenanceModeMarketsStartedAt)?.value,
  );
  const hasExchangeKey = settings.has(PLATFORM_SETTING_KEYS.maintenanceModeExchangeStartedAt);
  const hasTerminalKey = settings.has(PLATFORM_SETTING_KEYS.maintenanceModeTerminalStartedAt);

  return {
    sitewide: parseIsoDate(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeStartedAt)?.value),
    corporate: parseIsoDate(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeCorporateStartedAt)?.value),
    bank: parseIsoDate(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeBankStartedAt)?.value),
    exchange: hasExchangeKey
      ? parseIsoDate(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeExchangeStartedAt)?.value)
      : marketsLegacyStartedAt,
    terminal: hasTerminalKey
      ? parseIsoDate(settings.get(PLATFORM_SETTING_KEYS.maintenanceModeTerminalStartedAt)?.value)
      : marketsLegacyStartedAt,
  };
}

async function readMaintenanceScopeFlags(): Promise<MaintenanceScopeFlags> {
  const settings = await readMaintenanceSettings();
  return parseMaintenanceScopeFlags(settings);
}

/** Lightweight gate for root routing — cached scope flags. */
export async function getMaintenanceScopeFlags(): Promise<MaintenanceScopeFlags> {
  if (maintenanceGateCache && Date.now() < maintenanceGateCache.expiresAt) {
    return maintenanceGateCache.scopes;
  }
  try {
    const scopes = await readMaintenanceScopeFlags();
    maintenanceGateCache = { scopes, expiresAt: Date.now() + GATE_CACHE_TTL_MS };
    return scopes;
  } catch (error) {
    console.error("[maintenance] Failed to read maintenance scopes; defaulting to OFF", error);
    return emptyMaintenanceScopeFlags();
  }
}

/** Whether maintenance is active for a specific Alta site. */
export async function getMaintenanceActiveForSite(siteKey: SiteKey): Promise<boolean> {
  const scopes = await getMaintenanceScopeFlags();
  return isMaintenanceActiveForSite(siteKey, scopes);
}

/** @deprecated Use getMaintenanceActiveForSite(siteKey) or getMaintenanceScopeFlags(). */
export async function getMaintenanceModeGate(): Promise<boolean> {
  const scopes = await getMaintenanceScopeFlags();
  return isAnyMaintenanceScopeActive(scopes);
}

function badRequest(msg: string): never {
  throw new Error(`BAD_REQUEST:${msg}`);
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readSetting(key: string): Promise<unknown> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: unknown, actorUserId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedById: actorUserId },
    update: { value: value as object, updatedById: actorUserId },
  });
}

/** Admins and operators bypass maintenance mode entirely. */
export function isMaintenanceBypassUser(user: AltaUser | null | undefined): boolean {
  return canBypassMaintenanceMode(user);
}

/**
 * Read maintenance mode from the database.
 * On read failure, defaults to disabled so admins are not locked out accidentally.
 */
export async function getMaintenanceMode(): Promise<MaintenanceModeState> {
  if (maintenanceFullCache && Date.now() < maintenanceFullCache.expiresAt) {
    return maintenanceFullCache.value;
  }

  try {
    const settings = await readMaintenanceSettings();
    const scopes = parseMaintenanceScopeFlags(settings);
    const scopeStartedAt = parseMaintenanceScopeStartedAt(settings);
    const messageRaw = settings.get(PLATFORM_SETTING_KEYS.maintenanceModeMessage)?.value;
    const updatedByIdRaw = settings.get(PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById)?.value;

    const updatedById = parseString(updatedByIdRaw) || null;
    let updatedByUsername: string | null = null;
    let updatedAt: string | null = null;

    if (updatedById) {
      const updater = await prisma.user.findUnique({
        where: { id: updatedById },
        select: { discordUsername: true },
      });
      updatedByUsername = updater?.discordUsername ?? null;
    }

    const latestRow = [...settings.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];
    updatedAt = latestRow?.updatedAt.toISOString() ?? null;

    const activeScopes = getActiveMaintenanceScopes(scopes);
    const value: MaintenanceModeState = {
      scopes,
      enabled: activeScopes.length > 0,
      activeScopes,
      message: parseString(messageRaw) || DEFAULT_MAINTENANCE_MESSAGE,
      scopeStartedAt,
      startedAt: activeScopes.map((scope) => scopeStartedAt[scope]).find(Boolean) ?? null,
      updatedAt,
      updatedById,
      updatedByUsername,
    };

    maintenanceFullCache = { value, expiresAt: Date.now() + FULL_CACHE_TTL_MS };
    maintenanceGateCache = { scopes, expiresAt: Date.now() + GATE_CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error("[maintenance] Failed to read maintenance mode; defaulting to OFF", error);
    return {
      scopes: emptyMaintenanceScopeFlags(),
      enabled: false,
      activeScopes: [],
      message: DEFAULT_MAINTENANCE_MESSAGE,
      scopeStartedAt: emptyMaintenanceScopeStartedAt(),
      startedAt: null,
      updatedAt: null,
      updatedById: null,
      updatedByUsername: null,
    };
  }
}

export async function getMaintenanceModeSettings(): Promise<MaintenanceModeSettings> {
  const { requireOperator } = await import("@/server/permissions.service");
  const { isAdmin } = await import("@/lib/auth/permissions");
  const actor = await requireOperator();
  const state = await getMaintenanceMode();
  return { ...state, canEdit: isAdmin(actor) };
}

export async function setMaintenanceMode(
  actorUserId: string,
  input: { enabled: boolean; message: string; reason: string },
): Promise<MaintenanceModeState> {
  return setMaintenanceScope(actorUserId, {
    scope: "sitewide",
    enabled: input.enabled,
    message: input.message,
    reason: input.reason,
  });
}

export async function setMaintenanceScope(
  actorUserId: string,
  input: { scope: MaintenanceScope; enabled: boolean; message?: string; reason: string },
): Promise<MaintenanceModeState> {
  await requireAdmin();
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) badRequest("Reason is required");

  const previous = await getMaintenanceMode();
  const message = (input.message ?? previous.message).trim() || DEFAULT_MAINTENANCE_MESSAGE;
  const nowIso = new Date().toISOString();
  const scopeWasEnabled = previous.scopes[input.scope];
  const startedAt =
    input.enabled
      ? scopeWasEnabled && previous.scopeStartedAt[input.scope]
        ? previous.scopeStartedAt[input.scope]
        : nowIso
      : null;

  const writes: Promise<void>[] = [
    writeSetting(PLATFORM_SETTING_KEYS[SCOPE_ENABLED_KEY[input.scope]], input.enabled, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS[SCOPE_STARTED_AT_KEY[input.scope]], startedAt, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeMessage, message, actorUserId),
    writeSetting(PLATFORM_SETTING_KEYS.maintenanceModeUpdatedById, actorUserId, actorUserId),
  ];

  await Promise.all(writes);

  clearMaintenanceModeCache();

  const { writeAuditLog } = await import("@/server/audit.service");
  const metadata = {
    reason: trimmedReason,
    scope: input.scope,
    previousEnabled: scopeWasEnabled,
    newEnabled: input.enabled,
    previousMessage: previous.message,
    newMessage: message,
    actorUserId,
  };

  if (input.enabled && !scopeWasEnabled) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MODE_ENABLED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: `Enabled ${input.scope} maintenance mode`,
      metadata,
    });
  } else if (!input.enabled && scopeWasEnabled) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MODE_DISABLED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: `Disabled ${input.scope} maintenance mode`,
      metadata,
    });
  } else if (message !== previous.message) {
    await writeAuditLog({
      actorUserId,
      action: "MAINTENANCE_MESSAGE_UPDATED",
      entityType: "PLATFORM",
      entityId: MAINTENANCE_ENTITY_ID,
      description: "Updated platform maintenance message",
      metadata,
    });
  }

  return getMaintenanceMode();
}

// --- Credit Desk ---

const CREDIT_DESK_ENTITY_ID = "credit-desk";
const CREDIT_DESK_SETTING_KEYS = [
  CREDIT_DESK_KEYS.creditDeskStatus,
  CREDIT_DESK_KEYS.creditDeskClosedAt,
  CREDIT_DESK_KEYS.creditDeskUpdatedById,
] as const;

const CREDIT_DESK_GATE_CACHE_TTL_MS = 15_000;
const CREDIT_DESK_FULL_CACHE_TTL_MS = 10_000;

let creditDeskGateCache: { closed: boolean; expiresAt: number } | null = null;
let creditDeskFullCache: { value: CreditDeskState; expiresAt: number } | null = null;

export function clearCreditDeskCache(): void {
  creditDeskGateCache = null;
  creditDeskFullCache = null;
}

function parseCreditDeskStatus(value: unknown): CreditDeskStatus {
  return value === "closed" ? "closed" : "open";
}

async function readCreditDeskSettings(): Promise<
  Map<(typeof CREDIT_DESK_SETTING_KEYS)[number], { value: unknown; updatedAt: Date }>
> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: [...CREDIT_DESK_SETTING_KEYS] } },
    select: { key: true, value: true, updatedAt: true },
  });
  return new Map(
    rows.map((row) => [
      row.key as (typeof CREDIT_DESK_SETTING_KEYS)[number],
      { value: row.value, updatedAt: row.updatedAt },
    ]),
  );
}

/** Lightweight gate — cached, single DB read. Defaults to open on failure. */
export async function getCreditDeskClosedGate(): Promise<boolean> {
  if (creditDeskGateCache && Date.now() < creditDeskGateCache.expiresAt) {
    return creditDeskGateCache.closed;
  }
  try {
    const raw = await readSetting(CREDIT_DESK_KEYS.creditDeskStatus);
    const closed = parseCreditDeskStatus(raw) === "closed";
    creditDeskGateCache = { closed, expiresAt: Date.now() + CREDIT_DESK_GATE_CACHE_TTL_MS };
    return closed;
  } catch (error) {
    console.error("[credit-desk] Failed to read Credit Desk gate; defaulting to OPEN", error);
    return false;
  }
}

export async function getCreditDeskState(): Promise<CreditDeskState> {
  if (creditDeskFullCache && Date.now() < creditDeskFullCache.expiresAt) {
    return creditDeskFullCache.value;
  }

  try {
    const settings = await readCreditDeskSettings();
    const status = parseCreditDeskStatus(settings.get(CREDIT_DESK_KEYS.creditDeskStatus)?.value);
    const closedAtRaw = settings.get(CREDIT_DESK_KEYS.creditDeskClosedAt)?.value;
    const updatedByIdRaw = settings.get(CREDIT_DESK_KEYS.creditDeskUpdatedById)?.value;
    const updatedById = parseString(updatedByIdRaw) || null;

    let updatedByUsername: string | null = null;
    if (updatedById) {
      const updater = await prisma.user.findUnique({
        where: { id: updatedById },
        select: { discordUsername: true },
      });
      updatedByUsername = updater?.discordUsername ?? null;
    }

    const latestRow = [...settings.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];
    const updatedAt = latestRow?.updatedAt.toISOString() ?? null;

    const value: CreditDeskState = {
      status,
      closedAt: parseIsoDate(closedAtRaw),
      updatedAt,
      updatedById,
      updatedByUsername,
    };

    creditDeskFullCache = { value, expiresAt: Date.now() + CREDIT_DESK_FULL_CACHE_TTL_MS };
    creditDeskGateCache = {
      closed: status === "closed",
      expiresAt: Date.now() + CREDIT_DESK_GATE_CACHE_TTL_MS,
    };
    return value;
  } catch (error) {
    console.error("[credit-desk] Failed to read Credit Desk state; defaulting to OPEN", error);
    return {
      status: "open",
      closedAt: null,
      updatedAt: null,
      updatedById: null,
      updatedByUsername: null,
    };
  }
}

export async function getCreditDeskSettings(): Promise<CreditDeskSettings> {
  const { requireOperator } = await import("@/server/permissions.service");
  const actor = await requireOperator();
  const state = await getCreditDeskState();
  return { ...state, canEdit: isAdmin(actor) };
}

export async function setCreditDeskStatus(
  actorUserId: string,
  input: { status: CreditDeskStatus; reason: string },
): Promise<CreditDeskState> {
  await requireAdmin();
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) badRequest("Reason is required");
  if (input.status !== "open" && input.status !== "closed") {
    badRequest("Credit Desk status must be open or closed");
  }

  const previous = await getCreditDeskState();
  if (previous.status === input.status) {
    return previous;
  }

  const nowIso = new Date().toISOString();
  const closedAt =
    input.status === "closed"
      ? previous.status === "closed" && previous.closedAt
        ? previous.closedAt
        : nowIso
      : null;

  await Promise.all([
    writeSetting(CREDIT_DESK_KEYS.creditDeskStatus, input.status, actorUserId),
    writeSetting(CREDIT_DESK_KEYS.creditDeskClosedAt, closedAt, actorUserId),
    writeSetting(CREDIT_DESK_KEYS.creditDeskUpdatedById, actorUserId, actorUserId),
  ]);

  clearCreditDeskCache();

  let cancellationSummary:
    | import("@/server/credit-desk-cancel-pending.service").CreditDeskCancellationSummary
    | undefined;

  if (input.status === "closed") {
    const { cancelPendingCreditApplicationsOnCreditDeskClose } = await import(
      "@/server/credit-desk-cancel-pending.service"
    );
    cancellationSummary = await cancelPendingCreditApplicationsOnCreditDeskClose(
      actorUserId,
      trimmedReason,
    );
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  const metadata = {
    previousStatus: previous.status,
    newStatus: input.status,
    actorUserId,
    reason: trimmedReason,
    timestamp: nowIso,
    ...(cancellationSummary
      ? {
          cancelledLoanApplications: cancellationSummary.loanApplications,
          cancelledAltaCardApplications: cancellationSummary.altaCardApplications,
          cancelledAltaCardReviews: cancellationSummary.altaCardReviews,
        }
      : {}),
  };

  await writeAuditLog({
    actorUserId,
    action: input.status === "closed" ? "CREDIT_DESK_CLOSED" : "CREDIT_DESK_OPENED",
    entityType: "PLATFORM",
    entityId: CREDIT_DESK_ENTITY_ID,
    description:
      input.status === "closed"
        ? cancellationSummary &&
            (cancellationSummary.loanApplications > 0 ||
              cancellationSummary.altaCardApplications > 0 ||
              cancellationSummary.altaCardReviews > 0)
          ? "Closed the Credit Desk and cancelled pending credit applications"
          : "Closed the Credit Desk to new applications"
        : "Reopened the Credit Desk for new applications",
    metadata,
  });

  return getCreditDeskState();
}

/** Blocks new credit application submissions when the Credit Desk is closed. */
export async function assertCreditDeskAcceptingApplications(): Promise<void> {
  if (await getCreditDeskClosedGate()) {
    badRequest(CREDIT_DESK_SUBMISSION_BLOCKED);
  }
}

const OPEN_LOAN_STATUSES = ["ACTIVE", "FROZEN"] as const;
const OPEN_CARD_STATUSES = ["PENDING", "ACTIVE", "FROZEN", "LOST", "EXPIRED", "DELINQUENT"] as const;

async function getCustomerCreditProductVisibility(userId: string): Promise<{
  hasLoans: boolean;
  hasCards: boolean;
}> {
  const { loadAltaUserOrThrow } = await import("@/server/bank-account-access.service");
  const { canViewBusinessTreasury } = await import("@/lib/auth/permissions");
  const user = await loadAltaUserOrThrow(userId);
  const treasuryCompanyIds = user.companyMemberships
    .filter((m) => canViewBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);

  const [activeLoanCount, personalCardCount, businessCardCount, employeeCardCount] = await Promise.all([
    prisma.loan.count({
      where: {
        OR: [
          { borrowerUserId: userId },
          { loanApplication: { applicantUserId: userId } },
          ...(treasuryCompanyIds.length ? [{ companyId: { in: treasuryCompanyIds } }] : []),
        ],
        status: { in: [...OPEN_LOAN_STATUSES] },
      },
    }),
    prisma.altaCard.count({
      where: {
        ownerUserId: userId,
        cardType: "PERSONAL",
        status: { in: [...OPEN_CARD_STATUSES] },
      },
    }),
    treasuryCompanyIds.length
      ? prisma.altaCard.count({
          where: {
            cardType: "BUSINESS",
            status: { in: [...OPEN_CARD_STATUSES] },
            companyId: { in: treasuryCompanyIds },
          },
        })
      : Promise.resolve(0),
    prisma.altaEmployeeCard.count({
      where: {
        authorizedUserId: userId,
        status: { in: [...OPEN_CARD_STATUSES] },
      },
    }),
  ]);

  return {
    hasLoans: activeLoanCount > 0,
    hasCards: personalCardCount + businessCardCount + employeeCardCount > 0,
  };
}

export async function getCreditDeskCustomerNav(userId: string): Promise<CreditDeskCustomerNav> {
  const closed = await getCreditDeskClosedGate();
  const { hasLoans, hasCards } = await getCustomerCreditProductVisibility(userId);

  return {
    creditDeskClosed: closed,
    // Open Credit Desk: show product tabs for applications. Closed: only if customer has active products.
    showLendingNav: !closed || hasLoans,
    showAltaCardNav: !closed || hasCards,
    showApplyEntryPoints: !closed,
  };
}
