import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — account list lives on the bank dashboard. */
export const Route = createFileRoute("/bank/accounts")({
  beforeLoad: () => {
    throw redirect({ to: "/bank" });
  },
});
