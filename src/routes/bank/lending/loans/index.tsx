"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LendingLoansPage } from "@/components/bank/lending-loans-page";
import { EmptyState } from "@/components/data/empty-state";
import { fetchUserLoans } from "@/lib/bank/lending.functions";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { authBeforeLoad } from "@/lib/auth/guards";
import { withApplySearch } from "@/lib/bank/bank-apply-search";

export const Route = createFileRoute("/bank/lending/loans/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserLoans(),
  head: () => ({
    meta: [{ title: "Loans — Alta Bank Lending" }],
  }),
  component: BankLendingLoans,
});

function ApplyForCreditLink({ className }: { className?: string }) {
  return (
    <Link to="/bank/lending" search={(prev) => withApplySearch(prev)} className={className}>
      Apply for credit
    </Link>
  );
}

function BankLendingLoans() {
  const loans = Route.useLoaderData();
  const creditDeskNav = useCreditDeskCustomerNav();
  const showApply = creditDeskNav.showApplyEntryPoints;

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Lending"
        title="Loans"
        description="Your loans, payments, and history."
        action={
          showApply ? (
            <ApplyForCreditLink className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90" />
          ) : undefined
        }
      />

      {loans.length === 0 ? (
        showApply ? (
          <EmptyState
            title="No loans yet"
            description="When Alta approves a loan for your account, your balances, payment schedules, and history will appear here."
          >
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ApplyForCreditLink className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px" />
              <Link
                to="/bank/lending/applications"
                className="inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-1/70 px-5 py-2.5 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2"
              >
                View applications
              </Link>
            </div>
          </EmptyState>
        ) : (
          <EmptyState
            title="No loans yet"
            description="When Alta approves a loan for your account, your balances, payment schedules, and history will appear here."
            actions={[{ label: "View applications", to: "/bank/lending/applications", variant: "secondary" }]}
          />
        )
      ) : (
        <LendingLoansPage loans={loans} />
      )}

    </>
  );
}
