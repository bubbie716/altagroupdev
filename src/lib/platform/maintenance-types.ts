export const PLATFORM_SETTING_KEYS = {
  maintenanceModeEnabled: "maintenanceModeEnabled",
  maintenanceModeMessage: "maintenanceModeMessage",
  maintenanceModeStartedAt: "maintenanceModeStartedAt",
  maintenanceModeUpdatedById: "maintenanceModeUpdatedById",
} as const;

export type MaintenanceModeState = {
  enabled: boolean;
  message: string;
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
