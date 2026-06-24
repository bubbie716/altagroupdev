import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { GovernanceSubNav } from "@/components/governance/governance-sub-nav";

export const Route = createFileRoute("/governance")({
  component: GovernanceRouteLayout,
});

function GovernanceRouteLayout() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-[1400px] px-6 pt-14">
        <GovernanceSubNav />
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
