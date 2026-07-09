import { createIsomorphicFn } from "@tanstack/react-start";
import type { AltaUser } from "@/lib/auth/types";
import { fetchRootSession } from "@/lib/auth/root-session.functions";
import { fetchRootSessionCached } from "@/lib/auth/root-session-cache";
import type { MaintenanceScopeFlags } from "@/lib/platform/maintenance-types";

export type RootSessionLoadResult = {
  user: AltaUser | null;
  maintenanceScopes: MaintenanceScopeFlags;
  nccMaintenanceEnabled: boolean;
};

/** SSR reads the session directly; client uses cached server fn to avoid import-protection issues. */
export const loadRootSession = createIsomorphicFn()
  .server(async (): Promise<RootSessionLoadResult> => {
    const [{ readCurrentUser }, { getMaintenanceScopeFlags }, { getNccMaintenanceModeGate }] =
      await Promise.all([
        import("@/server/auth.service"),
        import("@/server/platform-settings.service"),
        import("@/server/ncc-maintenance.service"),
      ]);
    const [user, maintenanceScopes, nccMaintenanceEnabled] = await Promise.all([
      readCurrentUser(),
      getMaintenanceScopeFlags(),
      getNccMaintenanceModeGate(),
    ]);
    return { user, maintenanceScopes, nccMaintenanceEnabled };
  })
  .client(async (): Promise<RootSessionLoadResult> => {
    return fetchRootSessionCached(fetchRootSession);
  });
