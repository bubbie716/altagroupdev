import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Passthrough layout — child routes redirect to Terminal. */
export const Route = createFileRoute("/exchange")({
  component: () => <Outlet />,
});
