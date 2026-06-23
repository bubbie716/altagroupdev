import { createFileRoute, Outlet } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/internal")({
  beforeLoad: internalBeforeLoad,
  component: InternalLayout,
});

function InternalLayout() {
  return <Outlet />;
}
