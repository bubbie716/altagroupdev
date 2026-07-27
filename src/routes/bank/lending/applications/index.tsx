"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { fetchUserLoanApplications } from "@/lib/bank/lending.functions";
import { LendingApplicationsList } from "@/components/bank/lending-applications-list";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { authBeforeLoad } from "@/lib/auth/guards";
import { withApplySearch } from "@/lib/bank/bank-apply-search";

export const Route = createFileRoute("/bank/lending/applications/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserLoanApplications(),
  head: () => ({
    meta: [{ title: "Loan Applications — Alta Bank Lending" }],
  }),
  component: BankLendingApplications,
});

function BankLendingApplications() {
  const applications = Route.useLoaderData();
  const creditDeskNav = useCreditDeskCustomerNav();
  const showApply = creditDeskNav.showApplyEntryPoints;

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Lending"
        title="Applications"
        description="Track credit applications and review status."
        action={
          showApply ? (
            <Link
              to="/bank/lending"
              search={(prev) => withApplySearch(prev)}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Apply for credit
            </Link>
          ) : undefined
        }
      />
      <LendingApplicationsList applications={applications} />
    </>
  );
}
