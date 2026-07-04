import { createFileRoute } from "@tanstack/react-router";
import { redirectLegacyCommercialRoute } from "@/lib/bank/account-commercial-loader";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/analytics")({
  beforeLoad: authBeforeLoad,
  loader: async ({ location }) => {
    await redirectLegacyCommercialRoute(location.searchStr, { kind: "analytics" });
  },
});
