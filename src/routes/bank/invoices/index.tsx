import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/invoices/")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/pay/invoices", replace: true });
  },
});
