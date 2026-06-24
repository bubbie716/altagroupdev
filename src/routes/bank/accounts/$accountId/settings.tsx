import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/$accountId/settings")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/bank/account/$accountId/settings", params });
  },
});
