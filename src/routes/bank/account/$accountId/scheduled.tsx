import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/account/$accountId/scheduled")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/transfers/intrabank",
      search: { accountId: params.accountId },
    });
  },
});
