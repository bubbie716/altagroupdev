import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankActivityCenter } from "@/components/bank/activity-center/bank-activity-center";
import { fetchBankActivityCenterBundle } from "@/lib/bank/bank-activity-center.functions";
import {
  parseBankActivityCenterSearch,
  type BankActivityCenterSearch,
} from "@/lib/bank/bank-activity-center-url";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/activity")({
  validateSearch: (search: Record<string, unknown>): Omit<BankActivityCenterSearch, "accountId"> => {
    const parsed = parseBankActivityCenterSearch(search);
    return {
      view: parsed.view,
      transactionId: parsed.transactionId,
      requestId: parsed.requestId,
      scheduleId: parsed.scheduleId,
      approvalId: parsed.approvalId,
    };
  },
  loader: async ({ params }) =>
    fetchBankActivityCenterBundle({
      data: { accountId: params.accountId, transactionLimit: 80 },
    }),
  component: AccountActivityPage,
});

function AccountActivityPage() {
  const { account } = AccountRoute.useLoaderData();
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <Section title="Account activity">
      <BankActivityCenter
        data={data.accounts.length > 0 ? data : { ...data, accounts: [account] }}
        view={search.view}
        lockAccountId={account.id}
        transactionId={search.transactionId}
        requestId={search.requestId}
        scheduleId={search.scheduleId}
        approvalId={search.approvalId}
        basePath="/bank/account/$accountId/activity"
      />
    </Section>
  );
}
