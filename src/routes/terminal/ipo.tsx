import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/terminal/ipo")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal/markets", search: { q: "", filter: "all" }, replace: true });
  },
});
