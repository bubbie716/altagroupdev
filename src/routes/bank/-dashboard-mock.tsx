import { Section } from "@/components/page-shell";
import { LazyBankDashboardTrendChart } from "@/components/bank/lazy-bank-dashboard-trend-chart";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { AccountCard, OpenAccountCard } from "@/components/bank/account-card";
import { TransactionTable } from "@/components/bank/transaction-table";
import { florin, getBankAccounts, getBankDashboard, getRecentActivity } from "@/lib/bank/api";
import { buildBankBalanceStripItems } from "@/lib/bank/dashboard-balances";

export function BankDashboardMockContent() {
  const d = getBankDashboard();
  const bankAccounts = getBankAccounts();
  const bankRecentActivity = getRecentActivity();

  return (
    <>
      <BankStatStrip
        density="emphasized"
        items={[
          { label: "Total balance", value: florin(d.totalRelationshipValue) },
          { label: "Private status", value: d.privateStatus },
          { label: "MTD change", value: "+2.14%", sub: "Portfolio assets", accent: true },
          { label: "Accounts", value: String(bankAccounts.length) },
        ]}
      />
      <BankStatStrip
        className="mt-3"
        density="emphasized"
        items={buildBankBalanceStripItems(
          {
            ...d,
            enrolledInPrivate: d.privateStatus === "Enrolled",
          },
          florin,
        )}
      />

      <Section title="Balance Trend" className="mt-10">
        <div className="rounded-xl border border-border bg-surface-1/80 p-5">
          <LazyBankDashboardTrendChart data={d.balanceTrend} />
        </div>
      </Section>

      <Section title="Account Overview" className="mt-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OpenAccountCard />
          {bankAccounts.map((a) => (
            <AccountCard key={a.id} footer="view" account={a} />
          ))}
        </div>
      </Section>

      <Section title="Recent Activity" className="mt-10">
        <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
          <TransactionTable rows={bankRecentActivity} title="" showAccount />
        </div>
      </Section>
    </>
  );
}
