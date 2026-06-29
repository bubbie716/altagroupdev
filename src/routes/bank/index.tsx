import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
import { AccountOverviewGrid } from "@/components/bank/account-overview-grid";
import { BankAccountTransactions } from "@/components/bank/bank-account-transactions";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import {
  AltaPrivateBankerCard,
  AltaPrivateBenefitsHint,
  AltaPrivateMemberSinceCard,
  AltaPrivateRelationshipSnapshot,
} from "@/components/bank/alta-private/alta-private-client-chrome";
import { florin } from "@/lib/bank/api";
import { fetchBankDashboardBundle } from "@/lib/bank/bank.functions";
import { buildBankBalanceStripItems } from "@/lib/bank/dashboard-balances";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";
import { useAltaPrivateClientContext } from "@/hooks/use-alta-private-client-context";
import { BankDashboardMockContent } from "@/routes/bank/-dashboard-mock";

export const Route = createFileRoute("/bank/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    return fetchBankDashboardBundle();
  },
  head: () => ({
    meta: [{ title: "Banking Overview — Alta Bank" }],
  }),
  component: BankDashboard,
});

function BankDashboard() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();
  const privateClient = useAltaPrivateClientContext();

  return (
    <>
      <BankPageMeta
        eyebrow={privateClient.isMember ? "Alta Bank" : "Alta Bank · Client"}
        title={privateClient.isMember ? privateClient.welcomeBackGreeting : "Banking Overview"}
        subtitle={privateClient.isMember ? "Alta Private Client" : undefined}
        description={
          privateClient.isMember
            ? "Your Alta Bank relationship overview."
            : showMockData
              ? "Your Alta Bank balances, credit access, private status, and recent activity — simulated preview data."
              : "Your Alta Bank relationship overview."
        }
      />
      {showMockData ? (
        <BankDashboardMockContent />
      ) : !data || data.accounts.length === 0 ? (
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
  const privateClient = useAltaPrivateClientContext();

  const topStripItems = privateClient.isMember
    ? [
        { label: "Total relationship", value: florin(dashboard.totalRelationshipValue) },
        {
          label: "Relationship",
          value: privateClient.relationshipTierLabel ?? "—",
          sub: "Alta Private · Active",
        },
        {
          label: "Waiting on Alta",
          value: String(dashboard.pendingDeposits + dashboard.pendingWithdrawals),
          sub: "Deposits and withdrawals",
        },
        { label: "Accounts", value: String(accounts.length) },
      ]
    : [
        { label: "Total relationship", value: florin(dashboard.totalRelationshipValue) },
        { label: "Private status", value: dashboard.privateStatus },
        {
          label: "Waiting on Alta",
          value: String(dashboard.pendingDeposits + dashboard.pendingWithdrawals),
          sub: "Deposits and withdrawals",
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

      {privateClient.isMember ? (
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <AltaPrivateRelationshipSnapshot context={privateClient} />
            <AltaPrivateBenefitsHint context={privateClient} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <AltaPrivateMemberSinceCard context={privateClient} />
            <AltaPrivateBankerCard context={privateClient} />
          </div>
        </div>
      ) : null}

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
