import { createFileRoute, useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import {
  BankHomeDashboard,
  BankHomeDashboardError,
} from "@/components/bank/bank-home-dashboard";
import { fetchBankDashboardBundle } from "@/lib/bank/bank.functions";
import { authBeforeLoad } from "@/lib/auth/guards";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export const Route = createFileRoute("/bank/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchBankDashboardBundle(),
  errorComponent: BankDashboardErrorBoundary,
  pendingComponent: BankDashboardPending,
  head: () => ({
    meta: [{ title: "Banking — Alta Bank" }],
  }),
  component: BankDashboard,
});

function BankDashboardPending() {
  return (
    <>
      <BankPageMeta hideTitle title="Banking" />
      <div className="animate-pulse space-y-8" aria-busy="true">
        <div className="h-10 w-48 rounded bg-surface-2" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-surface-2" />
          ))}
        </div>
        <div className="h-40 rounded-xl bg-surface-2" />
      </div>
    </>
  );
}

function BankDashboardErrorBoundary() {
  const router = useRouter();
  return (
    <>
      <BankPageMeta hideTitle title="Banking" />
      <BankHomeDashboardError
        onRetry={() => {
          void invalidateRouteData(router);
        }}
      />
    </>
  );
}

function BankDashboard() {
  const data = Route.useLoaderData();

  return (
    <>
      <BankPageMeta hideTitle title="Banking" />
      <BankHomeDashboard
        data={{
          accounts: data.accounts,
          transactions: data.transactions,
          pendingRequests: data.pendingRequests,
          personalCard: data.personalCard,
          companyCards: data.companyCards,
        }}
      />
    </>
  );
}
