import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { AccountCard } from "@/components/bank/account-card";
import { TransactionTable } from "@/components/bank/transaction-table";
import { florin, getBankAccounts, getBankDashboard, getRecentActivity } from "@/lib/bank/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/dashboard")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Financial Position — Alta Bank" }],
  }),
  component: BankDashboard,
});

function BankDashboard() {
  const d = getBankDashboard();
  const bankAccounts = getBankAccounts();
  const bankRecentActivity = getRecentActivity();

  return (
    <PageShell
      eyebrow="Alta Bank · Client"
      title="Financial Position"
      description="Your Alta Bank balances, credit access, private status, and recent activity — simulated preview data."
    >
      <BankSubNav />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BankStatCard label="Total Relationship Value" value={florin(d.totalRelationshipValue)} className="md:col-span-2 lg:col-span-2" />
        <BankStatCard label="Credit Available" value={florin(d.creditAvailable)} />
        <BankStatCard label="Private Status" value={d.privateStatus} sub="Alta Private member" />
        <BankStatCard label="Checking Balance" value={florin(d.checkingBalance)} />
        <BankStatCard label="Savings Balance" value={florin(d.savingsBalance)} />
        <BankStatCard label="Reserve Balance" value={florin(d.reserveBalance)} />
        <BankStatCard label="MTD Change" value="+2.14%" accent sub="Relationship assets" />
      </div>

      <Section title="Balance Trend" className="mt-10">
        <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.balanceTrend}>
                <defs>
                  <linearGradient id="bankTrend" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis hide dataKey="t" />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v) => [florin(Number(v)), "Value"]}
                />
                <Area type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={1.8} fill="url(#bankTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="Account Overview" className="mt-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.slice(0, 3).map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      </Section>

      <Section title="Recent Activity" className="mt-10">
        <TransactionTable rows={bankRecentActivity} title="" />
      </Section>
    </PageShell>
  );
}
