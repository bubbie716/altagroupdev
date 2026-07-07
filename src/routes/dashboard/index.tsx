import { createFileRoute } from "@tanstack/react-router";
import { NccDashboardPage } from "@/components/ncc/ncc-dashboard-page";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Operations Console — Newport Clearing Corporation" }],
  }),
  component: NccDashboardPage,
});
