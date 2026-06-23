import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/bank" });
  },
});
