import type { SiteKey } from "@/config/sites";

export const MAINTENANCE_SCOPES = ["sitewide", "corporate", "bank", "exchange", "terminal"] as const;
export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

export const PLATFORM_SETTING_KEYS = {
  maintenanceModeEnabled: "maintenanceModeEnabled",
  maintenanceModeCorporateEnabled: "maintenanceModeCorporateEnabled",
  maintenanceModeBankEnabled: "maintenanceModeBankEnabled",
  maintenanceModeExchangeEnabled: "maintenanceModeExchangeEnabled",
  maintenanceModeTerminalEnabled: "maintenanceModeTerminalEnabled",
  /** @deprecated Legacy combined markets flag — migrated to exchange/terminal on read. */
  maintenanceModeMarketsEnabled: "maintenanceModeMarketsEnabled",
  maintenanceModeMessage: "maintenanceModeMessage",
  maintenanceModeStartedAt: "maintenanceModeStartedAt",
  maintenanceModeCorporateStartedAt: "maintenanceModeCorporateStartedAt",
  maintenanceModeBankStartedAt: "maintenanceModeBankStartedAt",
  maintenanceModeExchangeStartedAt: "maintenanceModeExchangeStartedAt",
  maintenanceModeTerminalStartedAt: "maintenanceModeTerminalStartedAt",
  /** @deprecated Legacy combined markets timestamp — migrated on read. */
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
  exchange: "Legacy Host Maintenance",
  terminal: "Terminal Maintenance",
};

export const MAINTENANCE_SCOPE_DESCRIPTIONS: Record<MaintenanceScope, string> = {
  sitewide: "All Alta sites (excluding NCC), shared routes, and the Discord bank bot.",
  corporate: "Alta Group corporate site only.",
  bank: "Alta Bank site and banking routes.",
  exchange: "Legacy host compatibility only — product traffic redirects to Alta Terminal.",
  terminal: "Alta Terminal site only.",
};

export function emptyMaintenanceScopeFlags(): MaintenanceScopeFlags {
  return {
    sitewide: false,
    corporate: false,
    bank: false,
    exchange: false,
    terminal: false,
  };
}

export function emptyMaintenanceScopeStartedAt(): Record<MaintenanceScope, string | null> {
  return {
    sitewide: null,
    corporate: null,
    bank: null,
    exchange: null,
    terminal: null,
  };
}

export function isAnyMaintenanceScopeActive(scopes: MaintenanceScopeFlags): boolean {
  return scopes.sitewide || scopes.corporate || scopes.bank || scopes.exchange || scopes.terminal;
}

export function getActiveMaintenanceScopes(scopes: MaintenanceScopeFlags): MaintenanceScope[] {
  return MAINTENANCE_SCOPES.filter((scope) => scopes[scope]);
}

export function isMaintenanceActiveForSite(siteKey: SiteKey, scopes: MaintenanceScopeFlags): boolean {
  if (siteKey === "ncc") return false;
  if (scopes.sitewide) return true;
  if (siteKey === "corporate") return scopes.corporate;
  if (siteKey === "bank") return scopes.bank;
  if (siteKey === "exchange") return scopes.exchange;
  if (siteKey === "terminal") return scopes.terminal;
  return false;
}

export function getMaintenanceScopeForSite(
  siteKey: SiteKey,
  scopes: MaintenanceScopeFlags,
): MaintenanceScope | null {
  if (scopes.sitewide) return "sitewide";
  if (siteKey === "corporate" && scopes.corporate) return "corporate";
  if (siteKey === "bank" && scopes.bank) return "bank";
  if (siteKey === "exchange" && scopes.exchange) return "exchange";
  if (siteKey === "terminal" && scopes.terminal) return "terminal";
  return null;
}

/** Maintenance scopes editable from each site's internal settings page. */
export function maintenanceScopesForInternalSettings(siteKey: SiteKey): MaintenanceScope[] {
  switch (siteKey) {
    case "corporate":
      // Group console can toggle every Alta site scope (NCC uses its own portal).
      return ["sitewide", "corporate", "bank", "terminal", "exchange"];
    case "bank":
      return ["bank"];
    case "exchange":
      return ["exchange"];
    case "terminal":
      return ["terminal"];
    default:
      return [];
  }
}

export function maintenanceTitleForSite(siteKey: SiteKey, scope: MaintenanceScope | null): string {
  if (scope === "sitewide") return "Sitewide Maintenance";
  if (scope) return MAINTENANCE_SCOPE_LABELS[scope];
  if (siteKey === "bank") return "Bank Maintenance";
  if (siteKey === "exchange") return "Legacy Host Maintenance";
  if (siteKey === "terminal") return "Terminal Maintenance";
  if (siteKey === "ncc") return "Platform Maintenance";
  return "Corporate Maintenance";
}
