import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/$accountId/statements")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/bank/account/$accountId/statements", params });
  },
});
