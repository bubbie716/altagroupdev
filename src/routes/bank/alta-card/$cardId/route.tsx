import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/alta-card/$cardId")({
  component: AltaCardLayout,
});

function AltaCardLayout() {
  return <Outlet />;
}
