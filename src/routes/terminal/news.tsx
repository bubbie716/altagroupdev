import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/terminal/news")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal", replace: true });
  },
});
