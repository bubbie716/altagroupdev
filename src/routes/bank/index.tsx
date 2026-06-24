import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { AccountCard, OpenAccountCard } from "@/components/bank/account-card";
import { TransactionTable } from "@/components/bank/transaction-table";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin } from "@/lib/bank/api";
import { fetchBankDashboardBundle } from "@/lib/bank/bank.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankDashboardMockContent } from "@/routes/bank/-dashboard-mock";

export const Route = createFileRoute("/bank/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    return fetchBankDashboardBundle();
  },
  head: () => ({
    meta: [{ title: "Bank Like the 1% — Alta Bank" }],
  }),
  component: BankDashboard,
});

function BankDashboard() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Client"
      title="Bank Like the 1%"
      description={
        showMockData
          ? "Your Alta Bank balances, credit access, private status, and recent activity — simulated preview data."
          : "Your Alta Bank relationship overview."
      }
    >
      <BankSubNav />

      {showMockData ? (
        <BankDashboardMockContent />
      ) : !data || data.accounts.length === 0 ? (
        <EmptyBankState />
      ) : (
        <BankDashboardLiveContent data={data} />
      )}
    </PageShell>
  );
}

function BankDashboardLiveContent({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof Route.useLoaderData>>>;
}) {
  const { dashboard, accounts, transactions } = data;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BankStatCard
          label="Total Relationship Value"
          value={florin(dashboard.totalRelationshipValue)}
          className="md:col-span-2 lg:col-span-2"
        />
        <BankStatCard label="Private Status" value={dashboard.privateStatus} />
        <BankStatCard label="Checking Balance" value={florin(dashboard.checkingBalance)} />
        <BankStatCard label="Savings Balance" value={florin(dashboard.savingsBalance)} />
        <BankStatCard label="Reserve Balance" value={florin(dashboard.reserveBalance)} />
        <BankStatCard label="Business Balance" value={florin(dashboard.businessBalance)} />
        <BankStatCard
          label="Pending Reviews"
          value={String(dashboard.pendingDeposits + dashboard.pendingWithdrawals)}
          sub="Deposits + withdrawals"
        />
      </div>

      <Section title="Account Overview" className="mt-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OpenAccountCard />
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              footer="view"
              account={{
                id: a.id,
                name: a.name,
                product: a.product,
                accountNumber: a.accountNumber,
                balance: a.balance,
                status: a.statusLabel,
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Recent Activity" className="mt-10">
        {transactions.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No transactions yet.</p>
        ) : (
          <TransactionTable
            rows={transactions.map((t) => ({
              id: t.referenceCode,
              date: t.createdAt,
              desc: t.description,
              category: t.typeLabel,
              amount: t.type === "withdrawal" ? -t.amount : t.amount,
            }))}
            title=""
          />
        )}
      </Section>
    </>
  );
}
