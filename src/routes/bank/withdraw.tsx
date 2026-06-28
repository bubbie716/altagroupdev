import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankWithdrawForm } from "@/components/bank/bank-withdraw-form";
import { BankRequestsInProgress } from "@/components/bank/bank-requests-in-progress";
import type { BankRequestSubmissionResult } from "@/components/bank/bank-request-submission-ui";
import { fetchActiveBankAccounts, fetchUserBankRequestsInProgress } from "@/lib/bank/bank.functions";
import { WITHDRAW_PAGE_DESCRIPTION } from "@/lib/bank/bank-shared-copy";
import { authBeforeLoad } from "@/lib/auth/guards";

type BankWithdrawSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/withdraw")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): BankWithdrawSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: async () => {
    const [accounts, requestsInProgress] = await Promise.all([
      fetchActiveBankAccounts(),
      fetchUserBankRequestsInProgress({ data: "withdrawal" }),
    ]);
    return { accounts, requestsInProgress };
  },
  head: () => ({ meta: [{ title: "Withdraw — Alta Bank" }] }),
  component: BankWithdrawPage,
});

function BankWithdrawPage() {
  const { accounts, requestsInProgress } = Route.useLoaderData();
  const { accountId } = Route.useSearch();
  const [highlightReferenceCode, setHighlightReferenceCode] = useState<string | null>(null);

  function handleSubmissionSuccess(result: BankRequestSubmissionResult) {
    setHighlightReferenceCode(result.referenceCode);
  }

  return (
    <PageShell
      eyebrow="Alta Bank · Withdrawals"
      title="Request a Withdrawal"
      description={WITHDRAW_PAGE_DESCRIPTION}
    >
      <BankSubNav />
      <BankWithdrawForm
        accounts={accounts}
        defaultAccountId={accountId}
        onSubmissionSuccess={handleSubmissionSuccess}
      />
      <BankRequestsInProgress
        requests={requestsInProgress}
        highlightReferenceCode={highlightReferenceCode}
      />
    </PageShell>
  );
}
