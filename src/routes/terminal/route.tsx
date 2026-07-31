import { createFileRoute, Outlet } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { TerminalAppShell } from "@/components/terminal/terminal-app-shell";
import { ProductConsentRouteGate } from "@/components/legal/product-consent-route-gate";
import { fetchTerminalHome } from "@/lib/terminal/terminal.functions";

export const Route = createFileRoute("/terminal")({
  beforeLoad: authBeforeLoad,
  staleTime: 30_000,
  loader: async () => {
    try {
      const home = await fetchTerminalHome();
      return {
        mode: home.mode,
        marketStatus: home.dashboard.marketStatus,
      };
    } catch {
      return {
        mode: "unavailable" as const,
        marketStatus: null,
      };
    }
  },
  component: TerminalLayoutRoute,
});

function TerminalLayoutRoute() {
  const { mode, marketStatus } = Route.useLoaderData();
  return (
    <TerminalAppShell mode={mode} marketStatus={marketStatus}>
      <ProductConsentRouteGate sourceSite="terminal" theme="terminal">
        <Outlet />
      </ProductConsentRouteGate>
    </TerminalAppShell>
  );
}
