import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy redirect — merchant invoices are linked from the Payments tab. */
export const Route = createFileRoute("/bank/account/$accountId/invoices")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/payments",
      params: { accountId: params.accountId },
    });
  },
});
