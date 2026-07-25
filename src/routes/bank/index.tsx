import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { AccountOverviewGrid } from "@/components/bank/account-overview-grid";
import { BankAccountTransactions } from "@/components/bank/bank-account-transactions";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin } from "@/lib/bank/api";
import { fetchBankDashboardBundle } from "@/lib/bank/bank.functions";
import { buildBankBalanceStripItems } from "@/lib/bank/dashboard-balances";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchBankDashboardBundle(),
  head: () => ({
    meta: [{ title: "Banking Overview — Alta Bank" }],
  }),
  component: BankDashboard,
});

function BankDashboard() {
  const data = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Client"
        title="Banking Overview"
        description="Your Alta Bank overview."
      />
      {!data || data.accounts.length === 0 ? (
        <EmptyBankState />
      ) : (
        <BankDashboardLiveContent data={data} />
      )}
    </>
  );
}

function BankDashboardLiveContent({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof Route.useLoaderData>>>;
}) {
  const { dashboard, accounts, transactions } = data;

  const topStripItems = [
    { label: "Total balance", value: florin(dashboard.totalRelationshipValue) },
    {
      label: "Pending deposits and withdrawals",
      value: String(dashboard.pendingDeposits + dashboard.pendingWithdrawals),
    },
    { label: "Accounts", value: String(accounts.length) },
  ];

  return (
    <>
      <BankStatStrip density="emphasized" items={topStripItems} />
      <BankStatStrip
        className="mt-3"
        density="emphasized"
        items={buildBankBalanceStripItems(dashboard, florin)}
      />

      <Section
        title="Account Overview"
        className="mt-10"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {accounts.length} active
          </span>
        }
      >
        <AccountOverviewGrid accounts={accounts} />
      </Section>

      <Section title="Recent Activity" className="mt-10">
        {transactions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-surface-1/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1">
            <BankAccountTransactions transactions={transactions} showAccount />
          </div>
        )}
      </Section>
    </>
  );
}
