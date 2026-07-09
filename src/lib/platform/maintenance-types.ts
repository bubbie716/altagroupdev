import type { SiteKey } from "@/config/sites";

export const MAINTENANCE_SCOPES = ["sitewide", "corporate", "bank", "markets"] as const;
export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

export const PLATFORM_SETTING_KEYS = {
  maintenanceModeEnabled: "maintenanceModeEnabled",
  maintenanceModeCorporateEnabled: "maintenanceModeCorporateEnabled",
  maintenanceModeBankEnabled: "maintenanceModeBankEnabled",
  maintenanceModeMarketsEnabled: "maintenanceModeMarketsEnabled",
  maintenanceModeMessage: "maintenanceModeMessage",
  maintenanceModeStartedAt: "maintenanceModeStartedAt",
  maintenanceModeCorporateStartedAt: "maintenanceModeCorporateStartedAt",
  maintenanceModeBankStartedAt: "maintenanceModeBankStartedAt",
  maintenanceModeMarketsStartedAt: "maintenanceModeMarketsStartedAt",
  maintenanceModeUpdatedById: "maintenanceModeUpdatedById",
} as const;

export type MaintenanceScopeFlags = Record<MaintenanceScope, boolean>;

export type MaintenanceModeState = {
  scopes: MaintenanceScopeFlags;
  /** True when any maintenance scope is active. */
  enabled: boolean;
  activeScopes: MaintenanceScope[];
  message: string;
  scopeStartedAt: Record<MaintenanceScope, string | null>;
  /** @deprecated Prefer scopeStartedAt for the active scope on a site. */
  startedAt: string | null;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByUsername: string | null;
};

export type MaintenanceModeSettings = MaintenanceModeState & {
  canEdit: boolean;
};

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Alta is temporarily offline while scheduled maintenance is performed.";

export const MAINTENANCE_SCOPE_LABELS: Record<MaintenanceScope, string> = {
  sitewide: "Sitewide Maintenance",
  corporate: "Corporate Maintenance",
  bank: "Bank Maintenance",
  markets: "Markets Maintenance",
};

export const MAINTENANCE_SCOPE_DESCRIPTIONS: Record<MaintenanceScope, string> = {
  sitewide: "All Alta sites, shared routes, and the Discord bank bot.",
  corporate: "Alta Group corporate site only.",
  bank: "Alta Bank site and banking routes.",
  markets: "Alta Exchange and Alta Terminal sites.",
};

export function emptyMaintenanceScopeFlags(): MaintenanceScopeFlags {
  return {
    sitewide: false,
    corporate: false,
    bank: false,
    markets: false,
  };
}

export function emptyMaintenanceScopeStartedAt(): Record<MaintenanceScope, string | null> {
  return {
    sitewide: null,
    corporate: null,
    bank: null,
    markets: null,
  };
}

export function isAnyMaintenanceScopeActive(scopes: MaintenanceScopeFlags): boolean {
  return scopes.sitewide || scopes.corporate || scopes.bank || scopes.markets;
}

export function getActiveMaintenanceScopes(scopes: MaintenanceScopeFlags): MaintenanceScope[] {
  return MAINTENANCE_SCOPES.filter((scope) => scopes[scope]);
}

export function isMaintenanceActiveForSite(siteKey: SiteKey, scopes: MaintenanceScopeFlags): boolean {
  if (scopes.sitewide) return true;
  if (siteKey === "corporate") return scopes.corporate;
  if (siteKey === "bank") return scopes.bank;
  if (siteKey === "exchange" || siteKey === "terminal") return scopes.markets;
  if (siteKey === "ncc") return scopes.sitewide;
  return false;
}

export function getMaintenanceScopeForSite(
  siteKey: SiteKey,
  scopes: MaintenanceScopeFlags,
): MaintenanceScope | null {
  if (scopes.sitewide) return "sitewide";
  if (siteKey === "corporate" && scopes.corporate) return "corporate";
  if (siteKey === "bank" && scopes.bank) return "bank";
  if ((siteKey === "exchange" || siteKey === "terminal") && scopes.markets) return "markets";
  if (siteKey === "ncc" && scopes.sitewide) return "sitewide";
  return null;
}

export function maintenanceTitleForSite(siteKey: SiteKey, scope: MaintenanceScope | null): string {
  if (scope === "sitewide") return "Sitewide Maintenance";
  if (scope) return MAINTENANCE_SCOPE_LABELS[scope];
  if (siteKey === "bank") return "Bank Maintenance";
  if (siteKey === "exchange") return "Exchange Maintenance";
  if (siteKey === "terminal") return "Terminal Maintenance";
  if (siteKey === "ncc") return "Platform Maintenance";
  return "Corporate Maintenance";
}
