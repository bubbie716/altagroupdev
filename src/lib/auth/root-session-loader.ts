import { createIsomorphicFn } from "@tanstack/react-start";
import type { AltaUser } from "@/lib/auth/types";
import { fetchRootSession } from "@/lib/auth/root-session.functions";
import { fetchRootSessionCached } from "@/lib/auth/root-session-cache";

export type RootSessionLoadResult = {
  user: AltaUser | null;
  maintenanceEnabled: boolean;
};

/** SSR reads the session directly; client uses cached server fn to avoid import-protection issues. */
export const loadRootSession = createIsomorphicFn()
  .server(async (): Promise<RootSessionLoadResult> => {
    const [{ readCurrentUser }, { getMaintenanceModeGate }] = await Promise.all([
      import("@/server/auth.service"),
      import("@/server/platform-settings.service"),
    ]);
    const [user, maintenanceEnabled] = await Promise.all([
      readCurrentUser(),
      getMaintenanceModeGate(),
    ]);
    return { user, maintenanceEnabled };
  })
  .client(async (): Promise<RootSessionLoadResult> => {
    return fetchRootSessionCached(fetchRootSession);
  });
