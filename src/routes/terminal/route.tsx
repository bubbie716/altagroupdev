import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/terminal")({
  component: TerminalLayout,
});

function TerminalLayout() {
  return <Outlet />;
}
