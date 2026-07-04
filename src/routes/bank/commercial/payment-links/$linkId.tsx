import { createFileRoute } from "@tanstack/react-router";
import { redirectLegacyCommercialRoute } from "@/lib/bank/account-commercial-loader";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/payment-links/$linkId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params, location }) => {
    await redirectLegacyCommercialRoute(location.searchStr, {
      kind: "payment-link",
      linkId: params.linkId,
    });
  },
});
