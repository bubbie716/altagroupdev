import { createIsomorphicFn } from "@tanstack/react-start";
import type { AltaUser } from "@/lib/auth/types";
import { fetchRootSession } from "@/lib/auth/root-session.functions";
import { fetchRootSessionCached } from "@/lib/auth/root-session-cache";
import type { MaintenanceScopeFlags } from "@/lib/platform/maintenance-types";

export type RootSessionLoadResult = {
  user: AltaUser | null;
  maintenanceScopes: MaintenanceScopeFlags;
};

/** SSR reads the session directly; client uses cached server fn to avoid import-protection issues. */
export const loadRootSession = createIsomorphicFn()
  .server(async (): Promise<RootSessionLoadResult> => {
    const [{ readCurrentUser }, { getMaintenanceScopeFlags }] = await Promise.all([
      import("@/server/auth.service"),
      import("@/server/platform-settings.service"),
    ]);
    const [user, maintenanceScopes] = await Promise.all([
      readCurrentUser(),
      getMaintenanceScopeFlags(),
    ]);
    return { user, maintenanceScopes };
  })
  .client(async (): Promise<RootSessionLoadResult> => {
    return fetchRootSessionCached(fetchRootSession);
  });
