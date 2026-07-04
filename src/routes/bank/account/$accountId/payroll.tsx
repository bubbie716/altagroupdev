import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy redirect — payroll now lives under Commercial. */
export const Route = createFileRoute("/bank/account/$accountId/payroll")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/commercial/payroll",
      params: { accountId: params.accountId },
    });
  },
});
