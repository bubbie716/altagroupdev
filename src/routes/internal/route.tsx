import { createFileRoute, Outlet } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";
import { InternalShell } from "@/components/internal/console";
import { CreditDeskBanner } from "@/components/internal/credit-desk-banner";
import { fetchCreditDeskSettings } from "@/lib/platform/platform-settings.functions";

export const Route = createFileRoute("/internal")({
  beforeLoad: internalBeforeLoad,
  loader: () => fetchCreditDeskSettings(),
  component: InternalLayout,
});

function InternalLayout() {
  const creditDesk = Route.useLoaderData();

  return (
    <InternalShell>
      {creditDesk.status === "closed" ? <CreditDeskBanner /> : null}
      <Outlet />
    </InternalShell>
  );
}
