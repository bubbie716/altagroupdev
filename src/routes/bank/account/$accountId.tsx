import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import {
  BankAccountActionCard,
  BankAccountPlaceholderCard,
  BankAccountTransactions,
} from "@/components/bank/bank-account-transactions";
import { florin } from "@/lib/bank/api";
import { fetchUserBankAccountDetail } from "@/lib/bank/bank.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/account/$accountId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      return await fetchUserBankAccountDetail({ data: params.accountId });
    } catch {
      throw redirect({ to: "/bank" });
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.accountName ?? "Account"} — Alta Bank` }],
  }),
  component: BankAccountDetailPage,
});

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[12px] sm:max-w-md sm:text-right">{value}</span>
    </div>
  );
}

function BankAccountDetailPage() {
  const account = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Account"
      title={account.accountName}
      description={`${account.accountTypeLabel} · ${account.accountNumber}`}
    >
      <BankSubNav />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={account.statusLabel} />
        <span className="font-mono text-[11px] text-muted-foreground">
          Opened {account.createdAt.slice(0, 10)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <BankStatCard label="Current Balance" value={florin(account.balance)} accent />
        <BankStatCard label="Deposits This Month" value={florin(account.depositsThisMonth)} />
        <BankStatCard label="Withdrawals This Month" value={florin(account.withdrawalsThisMonth)} />
        <BankStatCard
          label="Net Change"
          value={`${account.netChangeThisMonth >= 0 ? "+" : ""}${florin(account.netChangeThisMonth)}`}
        />
        <BankStatCard label="Available Balance" value={florin(account.availableBalance)} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Account information">
          <Card className="!p-5">
            <ProfileRow label="Account name" value={account.accountName} />
            <ProfileRow label="Account number" value={account.accountNumber} />
            <ProfileRow label="Routing number" value={account.routingNumber} />
            <ProfileRow label="Account type" value={account.accountTypeLabel} />
            <ProfileRow label="Owner" value={account.ownerLabel} />
            <ProfileRow label="Status" value={account.statusLabel} />
          </Card>
        </Section>

        <Section title="Quick actions">
          <div className="grid gap-4">
            <BankAccountActionCard
              title="Deposit"
              description="Submit a deposit request for this account."
              to="/bank/deposit"
              search={{ accountId: account.id }}
              label="Make deposit"
            />
            <BankAccountActionCard
              title="Withdraw"
              description="Request a withdrawal from this account."
              to="/bank/withdraw"
              search={{ accountId: account.id }}
              label="Request withdrawal"
            />
          </div>
        </Section>
      </div>

      <Section title="Recent activity" className="mt-10">
        <BankAccountTransactions transactions={account.recentTransactions} />
      </Section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Statements">
          <BankAccountPlaceholderCard
            title="Account statements"
            message="Statements will be available in a future release."
          />
        </Section>

        <Section title="Notices">
          <BankAccountPlaceholderCard title="Account notices" message="No active notices." />
        </Section>
      </div>
    </PageShell>
  );
}
