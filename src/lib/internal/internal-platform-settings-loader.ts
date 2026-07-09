import {
  fetchCommercialPlanPlatformSettings,
  fetchCreditDeskSettings,
  fetchMaintenanceModeSettings,
} from "@/lib/platform/platform-settings.functions";

export async function loadInternalPlatformSettings() {
  const [maintenance, creditDesk, commercialPlans] = await Promise.all([
    fetchMaintenanceModeSettings(),
    fetchCreditDeskSettings(),
    fetchCommercialPlanPlatformSettings(),
  ]);
  return { maintenance, creditDesk, commercialPlans };
}
