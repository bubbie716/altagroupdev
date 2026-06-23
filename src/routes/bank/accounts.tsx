import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts")({
  beforeLoad: () => {
    throw redirect({ to: "/bank" });
  },
});
