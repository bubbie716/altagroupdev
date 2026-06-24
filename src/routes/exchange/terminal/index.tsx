import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/exchange/terminal/")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal", replace: true });
  },
});
