import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/accounts/$accountId/representatives")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/bank/account/$accountId/representatives", params });
  },
});
