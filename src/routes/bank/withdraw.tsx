import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankWithdrawForm } from "@/components/bank/bank-withdraw-form";
import { fetchActiveBankAccounts } from "@/lib/bank/bank.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

type BankWithdrawSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/withdraw")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): BankWithdrawSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: () => fetchActiveBankAccounts(),
  head: () => ({ meta: [{ title: "Withdraw — Alta Bank" }] }),
  component: BankWithdrawPage,
});

function BankWithdrawPage() {
  const accounts = Route.useLoaderData();
  const { accountId } = Route.useSearch();

  return (
    <PageShell
      eyebrow="Alta Bank · Withdrawals"
      title="Request a Withdrawal"
      description="Submit a Florin withdrawal request. Balances are not reduced until an operator approves the request."
    >
      <BankSubNav />
      <BankWithdrawForm accounts={accounts} defaultAccountId={accountId} />
    </PageShell>
  );
}
