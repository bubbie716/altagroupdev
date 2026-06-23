import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AccountCard } from "@/components/bank/account-card";
import { florin, getBankAccounts } from "@/lib/bank/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/accounts")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Alta Bank Accounts — Alta Group" }],
  }),
  component: BankAccounts,
});

function BankAccounts() {
  const bankAccounts = getBankAccounts();

  return (
    <PageShell
      eyebrow="Alta Bank · Accounts"
      title="Accounts"
      description="Your Alta Bank account structure — personal, business, and private wealth positions. Simulated preview."
    >
      <BankSubNav />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bankAccounts.map((a) => (
          <AccountCard key={a.id} account={a} />
        ))}
      </div>

      <Section title="All Accounts" className="mt-12">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Number</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3">Recent Activity</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts.map((a) => (
                <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-medium">{a.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.type}</td>
                  <td className="px-5 py-3 font-mono text-[12px]">{a.accountNumber}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-[var(--success)]">{a.status}</td>
                  <td className="tabular px-5 py-3 text-right font-medium">{florin(a.balance)}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground">{a.recentActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </PageShell>
  );
}
