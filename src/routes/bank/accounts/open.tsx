import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/open")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/open" });
  },
});
