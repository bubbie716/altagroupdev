import { createFileRoute, redirect } from "@tanstack/react-router";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

/** Legacy redirect — payments live under Commercial. */
export const Route = createFileRoute("/bank/account/$accountId/payments")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: accountCommercialRoutes.payments,
      params: { accountId: params.accountId },
    });
  },
});
