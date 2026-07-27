import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankActivityCenter } from "@/components/bank/activity-center/bank-activity-center";
import { fetchBankActivityCenterBundle } from "@/lib/bank/bank-activity-center.functions";
import {
  parseBankActivityCenterSearch,
  type BankActivityCenterSearch,
} from "@/lib/bank/bank-activity-center-url";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/activity")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): BankActivityCenterSearch =>
    parseBankActivityCenterSearch(search),
  loader: async () => fetchBankActivityCenterBundle({ data: { transactionLimit: 80 } }),
  head: () => ({
    meta: [{ title: "Activity — Alta Bank" }],
  }),
  component: BankActivityPage,
});

function BankActivityPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank"
        title="Activity"
        description="Review transactions, requests, scheduled payments, and AutoPay."
      />
      <BankActivityCenter
        data={data}
        view={search.view}
        accountId={search.accountId}
        transactionId={search.transactionId}
        requestId={search.requestId}
        scheduleId={search.scheduleId}
        approvalId={search.approvalId}
      />
    </>
  );
}
