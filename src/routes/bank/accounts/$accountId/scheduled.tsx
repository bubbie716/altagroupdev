import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/$accountId/scheduled")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/activity",
      search: { view: "scheduled", accountId: params.accountId },
      replace: true,
    });
  },
});
