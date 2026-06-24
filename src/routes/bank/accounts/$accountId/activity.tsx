import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/$accountId/activity")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/bank/account/$accountId/activity", params });
  },
});
