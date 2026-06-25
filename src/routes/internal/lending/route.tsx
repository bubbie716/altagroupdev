import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending")({
  component: InternalLendingLayout,
});

function InternalLendingLayout() {
  return <Outlet />;
}
