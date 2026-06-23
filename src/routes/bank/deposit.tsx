import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankDepositForm } from "@/components/bank/bank-deposit-form";
import { fetchActiveBankAccounts } from "@/lib/bank/bank.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

type BankDepositSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/deposit")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): BankDepositSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: () => fetchActiveBankAccounts(),
  head: () => ({ meta: [{ title: "Deposit — Alta Bank" }] }),
  component: BankDepositPage,
});

function BankDepositPage() {
  const accounts = Route.useLoaderData();
  const { accountId } = Route.useSearch();

  return (
    <PageShell
      eyebrow="Alta Bank · Deposits"
      title="Submit a Deposit"
      description="Request a Florin deposit with screenshot proof. Deposits remain pending until manually reviewed."
    >
      <BankSubNav />
      <BankDepositForm accounts={accounts} defaultAccountId={accountId} />
    </PageShell>
  );
}
