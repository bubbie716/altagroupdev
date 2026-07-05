import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchAccountCommercialLayout } from "@/lib/bank/account-commercial-loader.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial")({
  loader: async ({ params }) => {
    try {
      return await fetchAccountCommercialLayout({ data: params.accountId });
    } catch {
      throw redirect({
        to: "/bank/account/$accountId",
        params: { accountId: params.accountId },
      });
    }
  },
  component: () => <Outlet />,
});
