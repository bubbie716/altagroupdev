import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchAccountCommercialLayout } from "@/lib/bank/account-commercial-loader.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial")({
  beforeLoad: async ({ params }) => {
    try {
      const commercialLayout = await fetchAccountCommercialLayout({ data: params.accountId });
      return { commercialLayout };
    } catch {
      throw redirect({
        to: "/bank/account/$accountId",
        params: { accountId: params.accountId },
      });
    }
  },
  loader: ({ context }) => context.commercialLayout,
  component: () => <Outlet />,
});
