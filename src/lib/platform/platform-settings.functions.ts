import { createServerFn } from "@tanstack/react-start";
import type { MaintenanceScope } from "@/lib/platform/maintenance-types";

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
    (input: { scope: MaintenanceScope; enabled: boolean; message?: string; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Maintenance mode update");
    const { requireAuth } = await import("@/server/auth.service");
    const { setMaintenanceScope } = await import("@/server/platform-settings.service");
    const user = await requireAuth();
    return setMaintenanceScope(user.id, data);
  });

export const fetchCreditDeskClosedGate = createServerFn({ method: "GET" }).handler(async () => {
  const { getCreditDeskClosedGate } = await import("@/server/platform-settings.service");
  return getCreditDeskClosedGate();
});

export const fetchCreditDeskSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getCreditDeskSettings } = await import("@/server/platform-settings.service");
  return getCreditDeskSettings();
});

export const fetchCreditDeskCustomerNav = createServerFn({ method: "GET" }).handler(async () => {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    return {
      creditDeskClosed: false,
      showLendingNav: true,
      showAltaCardNav: true,
      showApplyEntryPoints: true,
    };
  }
  const { requireAuth } = await import("@/server/auth.service");
  const { getCreditDeskCustomerNav } = await import("@/server/platform-settings.service");
  const user = await requireAuth();
  return getCreditDeskCustomerNav(user.id);
});

export const setCreditDeskStatusOps = createServerFn({ method: "POST" })
  .inputValidator((input: { status: "open" | "closed"; reason: string }) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Credit Desk status change");
    const { requireAuth } = await import("@/server/auth.service");
    const { setCreditDeskStatus } = await import("@/server/platform-settings.service");
    const user = await requireAuth();
    return setCreditDeskStatus(user.id, data);
  });

export const fetchCommercialPlanPlatformSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getCommercialPlatformSettingsView } = await import(
      "@/server/commercial-platform-settings.service"
    );
    return getCommercialPlatformSettingsView();
  },
);

export const setCommercialPlanPlatformSettingsOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      proMonthlyFee: number;
      coreInvoiceMonthlyLimit: number;
      corePaymentLinkMonthlyLimit: number;
      coreTeamMemberLimit: number;
      proBillingGracePeriodDays: number;
      reason: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Commercial plan settings");
    const { requireAuth } = await import("@/server/auth.service");
    const { setCommercialPlatformSettings } = await import(
      "@/server/commercial-platform-settings.service"
    );
    const user = await requireAuth();
    return setCommercialPlatformSettings(user.id, data);
  });
