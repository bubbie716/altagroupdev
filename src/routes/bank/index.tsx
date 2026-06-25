import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { AccountCard, OpenAccountCard } from "@/components/bank/account-card";
import { TransactionTable } from "@/components/bank/transaction-table";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin } from "@/lib/bank/api";
import { fetchBankDashboardBundle } from "@/lib/bank/bank.functions";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
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
      <BankStatStrip
        items={[
          { label: "Total relationship", value: florin(dashboard.totalRelationshipValue) },
          { label: "Private status", value: dashboard.privateStatus },
          {
            label: "Pending reviews",
            value: String(dashboard.pendingDeposits + dashboard.pendingWithdrawals),
            sub: "Deposits + withdrawals",
          },
          { label: "Accounts", value: String(accounts.length) },
        ]}
      />
      <BankStatStrip
        className="mt-3"
        density="compact"
        items={[
          { label: "Checking", value: florin(dashboard.checkingBalance) },
          { label: "Savings", value: florin(dashboard.savingsBalance) },
          { label: "Reserve", value: florin(dashboard.reserveBalance) },
          { label: "Business", value: florin(dashboard.businessBalance) },
        ]}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OpenAccountCard />
          {accounts.map((a: any) => (
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
          <p className="rounded-md border border-dashed border-border bg-surface-1/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
            <TransactionTable
              rows={transactions.map((t: any) => ({
                id: t.referenceCode,
                date: t.createdAt,
                desc: t.description,
                category: t.typeLabel,
                amount: getSignedBankTransactionAmount(t.type, t.amount),
              }))}
              title=""
            />
          </div>
        )}
      </Section>
    </>
  );
}
