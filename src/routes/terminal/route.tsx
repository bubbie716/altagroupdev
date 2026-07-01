import { createFileRoute } from "@tanstack/react-router";
import { TerminalRouteLayout } from "@/components/terminal/terminal-layout";

export const Route = createFileRoute("/terminal")({
  component: TerminalRouteLayout,
});
