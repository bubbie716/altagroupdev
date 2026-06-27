import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/alta-card/applications/$applicationId")({
  component: () => <Outlet />,
});
