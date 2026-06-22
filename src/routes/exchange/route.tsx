import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/exchange")({
  component: ExchangeLayout,
});

function ExchangeLayout() {
  return <Outlet />;
}
