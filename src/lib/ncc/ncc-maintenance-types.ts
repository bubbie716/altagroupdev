export const NCC_MAINTENANCE_SETTING_KEYS = {
  enabled: "nccMaintenanceModeEnabled",
  message: "nccMaintenanceModeMessage",
  startedAt: "nccMaintenanceModeStartedAt",
  updatedById: "nccMaintenanceModeUpdatedById",
} as const;

export type NccMaintenanceModeState = {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByUsername: string | null;
};

export type NccMaintenanceModeSettings = NccMaintenanceModeState & {
  canEdit: boolean;
};

export const DEFAULT_NCC_MAINTENANCE_MESSAGE =
  "Newport Clearing Corporation is temporarily offline while scheduled maintenance is performed.";
