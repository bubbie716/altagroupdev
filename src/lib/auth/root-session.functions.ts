import { createServerFn } from "@tanstack/react-start";
import type { AltaUser } from "@/lib/auth/types";

export type RootSession = {
  user: AltaUser | null;
  maintenanceEnabled: boolean;
};

/** Single round-trip for root route auth + maintenance gate. */
export const fetchRootSession = createServerFn({ method: "GET" }).handler(async (): Promise<RootSession> => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { getMaintenanceModeGate } = await import("@/server/platform-settings.service");
  const [user, maintenanceEnabled] = await Promise.all([readCurrentUser(), getMaintenanceModeGate()]);
  return { user, maintenanceEnabled };
});
