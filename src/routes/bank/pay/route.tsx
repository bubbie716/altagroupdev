import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/pay")({
  component: () => <Outlet />,
});
