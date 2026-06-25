import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchUserLoanApplications } from "@/lib/bank/lending.functions";
import { LendingApplicationsList } from "@/components/bank/lending-applications-list";

export const Route = createFileRoute("/bank/lending/applications")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserLoanApplications(),
  head: () => ({
    meta: [{ title: "Loan Applications — Alta Bank Lending" }],
  }),
  component: BankLendingApplications,
});

function BankLendingApplications() {
  const applications = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Applications"
      description="Track submitted credit facility requests and operator review outcomes."
    >
      <BankSubNav />
      <LendingSubNav />
      <LendingApplicationsList applications={applications} />
    </PageShell>
  );
}
