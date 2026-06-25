import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Section } from "@/components/page-shell";
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
          { label: "Total relationship", value: florin(d.totalRelationshipValue) },
          { label: "Private status", value: d.privateStatus },
          { label: "MTD change", value: "+2.14%", sub: "Relationship assets", accent: true },
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
