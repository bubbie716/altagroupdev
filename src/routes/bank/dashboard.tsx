import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/dashboard")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank",
      search: search as Record<string, unknown>,
    });
  },
});
