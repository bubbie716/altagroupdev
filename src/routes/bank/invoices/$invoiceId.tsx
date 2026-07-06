import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/invoices/$invoiceId")({
  beforeLoad: ({ params, location }) => {
    throw redirect({
      to: "/bank/pay/invoices/$invoiceId",
      params: { invoiceId: params.invoiceId },
      search: location.search,
      replace: true,
    });
  },
});
