import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending/deal-rooms")({
  component: () => <Outlet />,
});
