import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { loadAccountCommercialLayout } from "@/lib/bank/account-commercial-loader";

export const Route = createFileRoute("/bank/account/$accountId/commercial")({
  loader: async ({ params }) => {
    try {
      return await loadAccountCommercialLayout(params.accountId);
    } catch {
      throw redirect({
        to: "/bank/account/$accountId",
        params: { accountId: params.accountId },
      });
    }
  },
  component: () => <Outlet />,
});
