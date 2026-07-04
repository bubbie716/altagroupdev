import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy redirect — merchant invoices live under Commercial. */
export const Route = createFileRoute("/bank/account/$accountId/invoices")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/commercial/invoices",
      params: { accountId: params.accountId },
    });
  },
});
