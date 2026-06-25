import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { AltaCreditProfilePlaceholder } from "@/components/bank/alta-credit-profile-placeholder";
import { LendingLoansTable } from "@/components/bank/lending-loans-table";
import { EmptyState } from "@/components/data/empty-state";
import { fetchUserLoans } from "@/lib/bank/lending.functions";

export const Route = createFileRoute("/bank/lending/loans/")({
  loader: async () => fetchUserLoans(),
  head: () => ({
    meta: [{ title: "Active Loans — Alta Bank Lending" }],
  }),
  component: BankLendingLoans,
});

function BankLendingLoans() {
  const loans = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Loans"
      description="Approved credit facilities and servicing summary."
    >
      <BankSubNav />
      <LendingSubNav />

      {loans.length === 0 ? (
        <EmptyState
          eyebrow="Alta Bank · Lending"
          title="No loans on file"
          description="Approved credit facilities and their servicing summary will appear here once a loan is originated."
          actions={[{ label: "Apply for credit", to: "/bank/lending/apply" }]}
        />
      ) : (
        <LendingLoansTable loans={loans} />
      )}

      <AltaCreditProfilePlaceholder className="mt-12" />
    </PageShell>
  );
}
