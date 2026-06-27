import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/alta-card/$cardId/")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/alta-card" });
  },
});
