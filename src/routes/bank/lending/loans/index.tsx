"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LendingLoansPage } from "@/components/bank/lending-loans-page";
import { EmptyState } from "@/components/data/empty-state";
import { fetchUserLoans } from "@/lib/bank/lending.functions";
import { splitLoansByServicing } from "@/lib/bank/lending-loans-display";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/lending/loans/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserLoans(),
  head: () => ({
    meta: [{ title: "Loans — Alta Bank Lending" }],
  }),
  component: BankLendingLoans,
});

function BankLendingLoans() {
  const loans = Route.useLoaderData();
  const creditDeskNav = useCreditDeskCustomerNav();
  const { active, previous } = splitLoansByServicing(loans);
  const showApply = creditDeskNav.showApplyEntryPoints;

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Lending"
        title="Loans"
        description="Your active loans, upcoming payments, and loan history."
        action={
          showApply ? (
            <Link
              to="/bank/lending"
              search={{ apply: "1" }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Apply for credit
            </Link>
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
              <Link
                to="/bank/lending"
                search={{ apply: "1" }}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px"
              >
                Apply for credit
              </Link>
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

      {loans.length > 0 && active.length === 0 && previous.length > 0 && showApply ? (
        <div className="mt-10 rounded-xl border border-border bg-surface-1/50 px-5 py-5 text-center sm:px-6 sm:text-left">
          <p className="text-[14px] font-medium">Ready to borrow again?</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Submit a new credit application when you need another loan.
          </p>
          <Link
            to="/bank/lending"
            search={{ apply: "1" }}
            className="mt-4 inline-flex rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Apply for credit
          </Link>
        </div>
      ) : null}
    </>
  );
}
