import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankDepositForm } from "@/components/bank/bank-deposit-form";
import { BankRequestsInProgress } from "@/components/bank/bank-requests-in-progress";
import type { BankRequestSubmissionResult } from "@/components/bank/bank-request-submission-ui";
import { fetchActiveBankAccounts, fetchUserBankRequestsInProgress } from "@/lib/bank/bank.functions";
import { authBeforeLoad } from "@/lib/auth/guards";
import { DEPOSIT_PAGE_DESCRIPTION } from "@/lib/bank/bank-shared-copy";

type BankDepositSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/deposit")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): BankDepositSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: async () => {
    const [accounts, requestsInProgress] = await Promise.all([
      fetchActiveBankAccounts(),
      fetchUserBankRequestsInProgress({ data: "deposit" }),
    ]);
    return { accounts, requestsInProgress };
  },
  head: () => ({ meta: [{ title: "Deposit — Alta Bank" }] }),
  component: BankDepositPage,
});

function BankDepositPage() {
  const { accounts, requestsInProgress } = Route.useLoaderData();
  const { accountId } = Route.useSearch();
  const [highlightReferenceCode, setHighlightReferenceCode] = useState<string | null>(null);

  function handleSubmissionSuccess(result: BankRequestSubmissionResult) {
    setHighlightReferenceCode(result.referenceCode);
  }

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Deposits"
      title="Submit a Deposit"
      description={DEPOSIT_PAGE_DESCRIPTION}
     />
<BankDepositForm
        accounts={accounts}
        defaultAccountId={accountId}
        onSubmissionSuccess={handleSubmissionSuccess}
      />
      <BankRequestsInProgress
        requests={requestsInProgress}
        highlightReferenceCode={highlightReferenceCode}
        showProof
      />
    </>
  );
}
