import { createServerFn } from "@tanstack/react-start";

export const fetchInternalDashboardMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { getInternalDashboardMetrics } = await import("@/server/internal-dashboard.service");
  return getInternalDashboardMetrics();
});

export const fetchInternalComplianceSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { getInternalComplianceSnapshot } = await import("@/server/internal-dashboard.service");
  return getInternalComplianceSnapshot();
});
