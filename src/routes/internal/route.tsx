import { createFileRoute, Outlet } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";
import { InternalShell } from "@/components/internal/console";

export const Route = createFileRoute("/internal")({
  beforeLoad: internalBeforeLoad,
  component: InternalLayout,
});

function InternalLayout() {
  return (
    <InternalShell>
      <Outlet />
    </InternalShell>
  );
}
