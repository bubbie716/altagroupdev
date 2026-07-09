import { createServerFn } from "@tanstack/react-start";

export const fetchNccMaintenanceMode = createServerFn({ method: "GET" }).handler(async () => {
  const { getNccMaintenanceMode } = await import("@/server/ncc-maintenance.service");
  return getNccMaintenanceMode();
});

export const fetchNccMaintenanceModeSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getNccMaintenanceModeSettings } = await import("@/server/ncc-maintenance.service");
  return getNccMaintenanceModeSettings();
});

export const setNccMaintenanceModeOps = createServerFn({ method: "POST" })
  .inputValidator((input: { enabled: boolean; message: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { setNccMaintenanceMode } = await import("@/server/ncc-maintenance.service");
    const user = await requireAuth();
    return setNccMaintenanceMode(user.id, data);
  });
