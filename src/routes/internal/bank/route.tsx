import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/bank")({
  component: InternalBankLayout,
});

function InternalBankLayout() {
  return <Outlet />;
}
