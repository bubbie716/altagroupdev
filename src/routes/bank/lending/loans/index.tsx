import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LendingLoansPage } from "@/components/bank/lending-loans-page";
import { EmptyState } from "@/components/data/empty-state";
import { fetchUserLoans } from "@/lib/bank/lending.functions";
import { splitLoansByServicing } from "@/lib/bank/lending-loans-display";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

export const Route = createFileRoute("/bank/lending/loans/")({
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
      />

      {loans.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="When Alta approves a loan for your account, your balances, payment schedules, and history will appear here."
          actions={
            showApply
              ? [
                  { label: "Apply for credit", to: "/bank/lending/apply", variant: "primary" },
                  { label: "View applications", to: "/bank/lending/applications", variant: "secondary" },
                ]
              : undefined
          }
        />
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
            to="/bank/lending/apply"
            className="mt-4 inline-flex rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Apply for credit
          </Link>
        </div>
      ) : null}
    </>
  );
}
