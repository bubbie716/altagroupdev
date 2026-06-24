import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/lending/deal-rooms")({
  component: () => <Outlet />,
});