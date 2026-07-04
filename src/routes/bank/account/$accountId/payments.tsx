import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy redirect — payments content now lives under Commercial. */
export const Route = createFileRoute("/bank/account/$accountId/payments")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/commercial",
      params: { accountId: params.accountId },
    });
  },
});
