import { createFileRoute } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankRouteLayout } from "@/components/bank/bank-page-layout";
import { fetchAltaPrivateClientContext } from "@/lib/bank/alta-private.functions";
import { EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT } from "@/lib/bank/alta-private-client.types";

export const Route = createFileRoute("/bank")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    try {
      return { privateClientContext: await fetchAltaPrivateClientContext() };
    } catch (error) {
      console.error("[bank] Failed to load Alta Private client context", error);
      return { privateClientContext: EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT };
    }
  },
  component: BankLayoutRoute,
});

function BankLayoutRoute() {
  const { privateClientContext } = Route.useLoaderData();
  return <BankRouteLayout privateClientContext={privateClientContext} />;
}
