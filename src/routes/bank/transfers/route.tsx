import { createFileRoute, Outlet } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/transfers")({
  beforeLoad: authBeforeLoad,
  component: () => <Outlet />,
});
