import { createFileRoute } from "@tanstack/react-router";
import { redirectLegacyCommercialRoute } from "@/lib/bank/account-commercial-loader";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/invoices/$invoiceId/edit")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params, location }) => {
    await redirectLegacyCommercialRoute(location.searchStr, {
      kind: "invoice-edit",
      invoiceId: params.invoiceId,
    });
  },
});
