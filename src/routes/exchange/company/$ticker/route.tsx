import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/exchange/company/$ticker")({
  component: () => <Outlet />,
});
