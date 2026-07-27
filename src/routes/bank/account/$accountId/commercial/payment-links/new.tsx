import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";

/** Thin wrapper — opens the payment link workflow from the dashboard via `?create=1`. */
export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/new")({
  loader: async ({ context, params }) => {
    const commercial = requireCommercialFromRouteContext(context);
    const limits = await fetchCommercialReceivableCreationLimits({ data: commercial.companyId });
    if (!limits.canCreatePaymentLink) {
      throw redirect({
        to: accountCommercialRoutes.paymentLinks,
        params: { accountId: params.accountId },
      });
    }
    throw redirect({
      to: accountCommercialRoutes.paymentLinks,
      params: { accountId: params.accountId },
      search: { create: 1 },
    });
  },
});
