import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  BusinessAccountLayout,
  PersonalAccountLayout,
} from "@/components/bank/account-layout";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAccountPageBundle } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/bank/account/$accountId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      return await fetchAccountPageBundle({ data: params.accountId });
    } catch {
      throw redirect({ to: "/bank" });
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.account.accountName ?? "Account"} — Alta Bank` }],
  }),
  component: AccountLayoutRoute,
});

function AccountLayoutRoute() {
  const { account, accounts, businessContext, isBusinessOperating, commercialPayrollEnabled } =
    Route.useLoaderData();

  if (isBusinessOperating && businessContext) {
    return (
      <BusinessAccountLayout
        account={account}
        accounts={accounts}
        businessContext={businessContext}
        commercialPayrollEnabled={commercialPayrollEnabled}
      />
    );
  }

  return <PersonalAccountLayout account={account} accounts={accounts} />;
}
