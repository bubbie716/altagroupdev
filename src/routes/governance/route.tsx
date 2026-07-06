import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { GovernanceSubNav } from "@/components/governance/governance-sub-nav";

export const Route = createFileRoute("/governance")({
  component: GovernanceRouteLayout,
});

function GovernanceRouteLayout() {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-background">
      <SiteNav />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pt-14">
        <GovernanceSubNav />
        <Outlet />
      </div>
    </div>
  );
}
