import { createFileRoute, Outlet } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";
import { InternalShell } from "@/components/internal/console";
import { CreditDeskBanner } from "@/components/internal/credit-desk-banner";
import { fetchCreditDeskSettings } from "@/lib/platform/platform-settings.functions";
import { assertEntityInternalRouteAccess } from "@/lib/internal/entity-internal-scope";

export const Route = createFileRoute("/internal")({
  beforeLoad: async (ctx) => {
    await internalBeforeLoad(ctx);
    assertEntityInternalRouteAccess(ctx.context.site.key, ctx.location.pathname);
  },
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
