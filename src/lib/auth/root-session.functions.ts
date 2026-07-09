import { createServerFn } from "@tanstack/react-start";
import type { AltaUser } from "@/lib/auth/types";
import type { MaintenanceScopeFlags } from "@/lib/platform/maintenance-types";

export type RootSession = {
  user: AltaUser | null;
  maintenanceScopes: MaintenanceScopeFlags;
  nccMaintenanceEnabled: boolean;
};

/** Single round-trip for root route auth + maintenance scope flags. */
export const fetchRootSession = createServerFn({ method: "GET" }).handler(async (): Promise<RootSession> => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { getMaintenanceScopeFlags } = await import("@/server/platform-settings.service");
  const { getNccMaintenanceModeGate } = await import("@/server/ncc-maintenance.service");
  const [user, maintenanceScopes, nccMaintenanceEnabled] = await Promise.all([
    readCurrentUser(),
    getMaintenanceScopeFlags(),
    getNccMaintenanceModeGate(),
  ]);
  return { user, maintenanceScopes, nccMaintenanceEnabled };
});
