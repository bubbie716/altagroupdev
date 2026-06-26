import { createServerFn } from "@tanstack/react-start";

export const fetchMaintenanceMode = createServerFn({ method: "GET" }).handler(async () => {
  const { getMaintenanceMode } = await import("@/server/platform-settings.service");
  return getMaintenanceMode();
});

export const fetchMaintenanceModeSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getMaintenanceModeSettings } = await import("@/server/platform-settings.service");
  return getMaintenanceModeSettings();
});

export const setMaintenanceModeOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { enabled: boolean; message: string; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { setMaintenanceMode } = await import("@/server/platform-settings.service");
    const user = await requireAuth();
    return setMaintenanceMode(user.id, data);
  });
